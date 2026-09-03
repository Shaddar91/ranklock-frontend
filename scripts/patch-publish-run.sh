#!/usr/bin/env bash
#Publish runner: reads the patch-watch journal, fills wave-1/wave-2 content via
#patch-content-fill.mjs, gates it, and stops for one owner approval per wave.
set -euo pipefail
shopt -s nullglob

#$0 is the invocation path, not the resolved target — via the ~/.local/bin
#symlink that's outside the repo, so the real file path must be resolved first.
REPO_ROOT="$(git -C "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" rev-parse --show-toplevel)"
cd "$REPO_ROOT"

#package.json requires node >=22.12.0; default PATH node is older, so borrow
#node22's bin dir (which also carries its own npm) when the symlink exists.
if [[ -x "$HOME/.local/bin/ranklock-node22" ]]; then
  NODE22_BIN="$(dirname "$(readlink -f "$HOME/.local/bin/ranklock-node22")")"
  PATH="$NODE22_BIN:$PATH"
fi

STATE_DIR="${RANKLOCK_PATCH_CONTENT_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/ranklock-patch-content}"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/ranklock-patch-content"
RUNS_DIR="$STATE_DIR/runs"
WATERMARK_FILE="$STATE_DIR/publish-watermark.json"
PENDING_FILE="$STATE_DIR/pending.json"
SECRETS_FILE="$CONFIG_DIR/secrets.env"
WATCH_UNIT="deadlock-patch-watch.service"
JOURNAL_WINDOW="36 hours ago"
DEPLOY_WORKFLOW_SUFFIX="deploy.yml"
EX_NOT_READY=75
POLL_TRIES=15
POLL_INTERVAL=60

log_event() {
  local event="$1"; shift
  python3 -c '
import json, sys, datetime
fields = {}
for kv in sys.argv[2:]:
    k, _, v = kv.partition("=")
    fields[k] = v
fields["event"] = sys.argv[1]
fields["ts"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
print(json.dumps(fields, sort_keys=True))
' "$event" "$@"
}

#Telegram's API only accepts the token in the URL (same tradeoff notify.py
#documents); never traced with set -x, never logged, absent falls back to stdout.
notify() {
  local text="$1"
  if [[ -r "$SECRETS_FILE" ]]; then
    local token chat_id
    token="$(grep '^TELEGRAM_BOT_TOKEN=' "$SECRETS_FILE" | head -1 | cut -d= -f2-)"
    chat_id="$(grep '^TELEGRAM_OWNER_ID=' "$SECRETS_FILE" | head -1 | cut -d= -f2-)"
    if [[ -n "$token" && -n "$chat_id" ]]; then
      if curl -sS --fail --max-time 20 -X POST "https://api.telegram.org/bot${token}/sendMessage" \
          --data-urlencode "chat_id=${chat_id}" --data-urlencode "text=${text}" -o /dev/null; then
        log_event notify channel=telegram delivered=true
        return 0
      fi
      log_event notify channel=telegram delivered=false
    fi
  fi
  printf '%s\n' "$text"
  log_event notify channel=stdout delivered=true
}

json_get() {
  python3 -c '
import json, sys
path, key = sys.argv[1], sys.argv[2]
default = sys.argv[3] if len(sys.argv) > 3 else ""
try:
    with open(path) as fh:
        d = json.load(fh)
except Exception:
    print(default); sys.exit(0)
cur = d
for part in key.split("."):
    if isinstance(cur, dict) and part in cur and cur[part] is not None:
        cur = cur[part]
    else:
        print(default); sys.exit(0)
print(cur if isinstance(cur, str) else json.dumps(cur))
' "$1" "$2" "${3:-}"
}

pending_files() {
  python3 -c '
import json, sys
d = json.load(open(sys.argv[1]))
for f in d.get("files", []):
    print(f)
' "$PENDING_FILE"
}

watermark_get() {
  if [[ -f "$WATERMARK_FILE" ]]; then
    json_get "$WATERMARK_FILE" published_at
  fi
}

watermark_set() {
  local value="$1" current
  current="$(watermark_get)"
  if [[ -n "$current" && "$value" < "$current" ]]; then
    return 0
  fi
  python3 -c '
import json, os, sys
path, value = sys.argv[1], sys.argv[2]
tmp = path + ".tmp"
with open(tmp, "w") as fh:
    json.dump({"published_at": value}, fh)
    fh.write("\n")
os.chmod(tmp, 0o600)
os.replace(tmp, path)
' "$WATERMARK_FILE" "$value"
}

pending_clear() {
  rm -f "$PENDING_FILE"
}

#Only the generator's own target directory; excludes untracked/foreign files
#so a stray file never rides along into git add.
touched_files() {
  git status --porcelain -- src/content/blog | while IFS= read -r line; do
    case "$line" in "??"*) continue ;; esac
    local path="${line:3}"
    case "$path" in *" -> "*) path="${path#* -> }" ;; esac
    printf '%s\n' "$path"
  done
}

#The watcher wraps each signal as {"event":"notification","record":{"kind":...}} —
#never a top-level "kind" — so this reads the nested record, not the envelope.
next_patch_record() {
  local journal_output
  if ! journal_output="$(journalctl --user -u "$WATCH_UNIT" --since "$JOURNAL_WINDOW" -o cat 2>/dev/null)"; then
    log_event journal_read_failed unit="$WATCH_UNIT"
    return 0
  fi
  printf '%s' "$journal_output" | python3 -c '
import json, sys
watermark = sys.argv[1]
best = None
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        outer = json.loads(line)
    except Exception:
        continue
    if outer.get("event") != "notification":
        continue
    record = outer.get("record") or {}
    if record.get("kind") != "patch_released":
        continue
    published = record.get("published_at")
    if not published:
        continue
    if watermark and published <= watermark:
        continue
    if best is None or published < best["published_at"]:
        best = record
if best is not None:
    print(json.dumps(best))
' "$(watermark_get)"
}

rollback_and_fail() {
  local patch_id="$1" stage="$2"; shift 2
  local -a files=("$@")
  if [[ "${#files[@]}" -gt 0 ]]; then
    git checkout -- "${files[@]}"
  fi
  log_event gate_fail patch_id="$patch_id" stage="$stage"
  notify "$(printf 'Patch %s: %s FAILED. Working tree restored, nothing pending.' "$patch_id" "$stage")"
}

run_gates_or_rollback() {
  local patch_id="$1"; shift
  local -a files=("$@")
  if ! npm run gate; then rollback_and_fail "$patch_id" gate "${files[@]}"; return 1; fi
  if ! npm run type-check; then rollback_and_fail "$patch_id" type-check "${files[@]}"; return 1; fi
  if ! npm test; then rollback_and_fail "$patch_id" test "${files[@]}"; return 1; fi
  return 0
}

#Metadata (changed_count/thin/published_at) comes from the run record when one
#exists; wave 2's deferred-partial case can leave files touched with no record
#yet, so every field here degrades to blank rather than failing the stage.
stage_pending() {
  local patch_id="$1" wave="$2"; shift 2
  local -a files=("$@")
  local changed_count="" thin="" published_at=""
  local run_record="$RUNS_DIR/${patch_id}-w${wave}.json"
  if [[ -f "$run_record" ]]; then
    changed_count="$(json_get "$run_record" changed_count)"
    thin="$(json_get "$run_record" thin)"
  fi
  local w1="$RUNS_DIR/${patch_id}-w1.json"
  [[ -f "$w1" ]] && published_at="$(json_get "$w1" t0_real)"

  python3 -c '
import json, os, sys, datetime
out_path, patch_id, wave, changed_count, thin, published_at = sys.argv[1:7]
files = sys.argv[7:]
pending = {
    "patch_id": patch_id,
    "wave": int(wave),
    "changed_count": int(changed_count) if changed_count.isdigit() else None,
    "thin": True if thin == "true" else (False if thin == "false" else None),
    "published_at": published_at or None,
    "files": sorted(files),
    "created_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}
tmp = out_path + ".tmp"
with open(tmp, "w") as fh:
    json.dump(pending, fh, indent=2, sort_keys=True)
    fh.write("\n")
os.chmod(tmp, 0o600)
os.replace(tmp, out_path)
' "$PENDING_FILE" "$patch_id" "$wave" "$changed_count" "$thin" "$published_at" "${files[@]}"

  local thin_note="" file_list
  [[ "$thin" == "true" ]] && thin_note=" (THIN)"
  file_list="$(printf '%s, ' "${files[@]}")"
  file_list="${file_list%, }"
  notify "$(printf 'Patch %s wave %s ready%s: %s change(s). Files: %s. Review: git -C %s diff | Ship: ranklock-patch-publish approve' \
    "$patch_id" "$wave" "$thin_note" "${changed_count:-?}" "$file_list" "$REPO_ROOT")"
  log_event stage_pending patch_id="$patch_id" wave="$wave" changed_count="${changed_count:-?}"
}

#Whole-repo, unscoped: the approval gate is the hardest step to reverse, so it
#refuses on ANY foreign dirty file, not just ones outside the blog directory.
pending_matches_tree() {
  git status --porcelain | python3 -c '
import json, sys
pending = json.load(open(sys.argv[1]))
expected = set(pending.get("files", []))
actual = set()
for line in sys.stdin:
    line = line.rstrip("\n")
    if not line:
        continue
    path = line[3:]
    if " -> " in path:
        path = path.split(" -> ", 1)[1]
    actual.add(path)
if expected != actual:
    missing = expected - actual
    extra = actual - expected
    if missing:
        print("missing (pending but not modified): %s" % ", ".join(sorted(missing)), file=sys.stderr)
    if extra:
        print("extra (modified but not pending): %s" % ", ".join(sorted(extra)), file=sys.stderr)
    sys.exit(1)
' "$PENDING_FILE"
}

#gh is a snap wrapper only (confirmed absent from PATH); the repo is public so
#unauthenticated REST is sufficient for a few polls and needs no token file.
poll_deploy() {
  local sha="$1" slug status="" conclusion="" attempt=0 result
  slug="$(git remote get-url origin | sed -E 's#^git@github\.com:##; s#^https://github\.com/##; s#\.git$##')"
  while [[ "$attempt" -lt "$POLL_TRIES" ]]; do
    attempt=$((attempt + 1))
    result="$(curl -sS --max-time 20 -H 'Accept: application/vnd.github+json' \
        "https://api.github.com/repos/${slug}/actions/runs?head_sha=${sha}&per_page=10" 2>/dev/null \
      | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("", ""); sys.exit(0)
for run in d.get("workflow_runs", []):
    if run.get("path", "").endswith(sys.argv[1]):
        print(run.get("status") or "", run.get("conclusion") or "")
        break
else:
    print("", "")
' "$DEPLOY_WORKFLOW_SUFFIX")"
    read -r status conclusion <<<"$result"
    [[ "$status" == "completed" ]] && break
    sleep "$POLL_INTERVAL"
  done
  if [[ "$status" == "completed" ]]; then
    printf '%s\n' "${conclusion:-unknown}"
  else
    printf 'timeout\n'
  fi
}

cmd_prepare() {
  if [[ -f "$PENDING_FILE" ]]; then
    log_event prepare_skip reason=pending_exists
    return 0
  fi
  local record
  record="$(next_patch_record)"
  if [[ -z "$record" ]]; then
    log_event prepare_noop reason=no_new_patch_released
    return 0
  fi
  local tmp; tmp="$(mktemp)"
  printf '%s' "$record" > "$tmp"
  local published_at; published_at="$(json_get "$tmp" published_at)"

  log_event prepare_start published_at="$published_at"
  local rc=0
  node scripts/patch-content-fill.mjs --wave 1 --record "$tmp" || rc=$?
  rm -f "$tmp"
  if [[ "$rc" -ne 0 ]]; then
    log_event prepare_fail stage=fill wave=1 rc="$rc" published_at="$published_at"
    notify "$(printf 'Wave 1 fill FAILED for patch dated %s (exit %s).' "$published_at" "$rc")"
    return 1
  fi

  local -a touched
  readarray -t touched < <(touched_files)
  if [[ "${#touched[@]}" -eq 0 ]]; then
    log_event prepare_noop reason=fill_produced_no_changes published_at="$published_at"
    return 0
  fi

  local run_record
  run_record="$(grep -lF "\"t0_real\": \"${published_at}\"" "$RUNS_DIR"/*-w1.json 2>/dev/null | head -1)"
  if [[ -z "$run_record" ]]; then
    git checkout -- "${touched[@]}"
    log_event prepare_fail stage=fill wave=1 reason=run_record_not_found published_at="$published_at"
    notify "$(printf 'Wave 1 fill for patch dated %s produced changes but no run record — rolled back.' "$published_at")"
    return 1
  fi
  local patch_id; patch_id="$(json_get "$run_record" patch_id)"

  run_gates_or_rollback "$patch_id" "${touched[@]}" || return 1
  stage_pending "$patch_id" 1 "${touched[@]}"
}

cmd_approve() {
  if [[ ! -f "$PENDING_FILE" ]]; then
    log_event approve_refuse reason=no_pending_record
    echo "approve: no pending record — nothing to ship" >&2
    return 1
  fi
  if ! pending_matches_tree; then
    log_event approve_refuse reason=tree_mismatch
    echo "approve: working tree does not match the pending record exactly — refusing to stage" >&2
    return 1
  fi

  local patch_id wave published_at
  patch_id="$(json_get "$PENDING_FILE" patch_id)"
  wave="$(json_get "$PENDING_FILE" wave)"
  published_at="$(json_get "$PENDING_FILE" published_at)"
  local -a files
  readarray -t files < <(pending_files)

  local f
  for f in "${files[@]}"; do
    git add -- "$f"
  done
  git commit -m "content: ${patch_id} wave ${wave}"
  local sha; sha="$(git rev-parse HEAD)"

  #Commit is the point of no return: clear pending and advance the watermark
  #here so a later push failure can never strand the seam in a stuck state.
  pending_clear
  [[ -n "$published_at" ]] && watermark_set "$published_at"
  log_event approve_committed patch_id="$patch_id" wave="$wave" sha="$sha"

  if ! git push origin master; then
    log_event approve_push_failed patch_id="$patch_id" wave="$wave" sha="$sha"
    notify "$(printf 'Patch %s wave %s committed (%s) but PUSH FAILED — master is ahead locally, push by hand.' "$patch_id" "$wave" "$sha")"
    return 1
  fi

  local conclusion; conclusion="$(poll_deploy "$sha")"
  log_event deploy_conclusion patch_id="$patch_id" wave="$wave" sha="$sha" conclusion="$conclusion"
  notify "$(printf 'Patch %s wave %s pushed (%s). Deploy: %s' "$patch_id" "$wave" "$sha" "$conclusion")"
}

cmd_reject() {
  if [[ ! -f "$PENDING_FILE" ]]; then
    log_event reject_refuse reason=no_pending_record
    echo "reject: no pending record — nothing to reject" >&2
    return 1
  fi
  local patch_id wave published_at
  patch_id="$(json_get "$PENDING_FILE" patch_id)"
  wave="$(json_get "$PENDING_FILE" wave)"
  published_at="$(json_get "$PENDING_FILE" published_at)"
  local -a files
  readarray -t files < <(pending_files)

  if [[ "${#files[@]}" -gt 0 ]]; then
    git checkout -- "${files[@]}"
  fi
  pending_clear
  [[ -n "$published_at" ]] && watermark_set "$published_at"
  log_event reject patch_id="$patch_id" wave="$wave"
  notify "$(printf 'Patch %s wave %s rejected — drafts restored, will not be re-proposed.' "$patch_id" "$wave")"
}

cmd_wave2() {
  if [[ -f "$PENDING_FILE" ]]; then
    log_event wave2_skip reason=pending_exists
    return 0
  fi

  local -a candidates=()
  local w1 base patch_id
  for w1 in "$RUNS_DIR"/*-w1.json; do
    base="$(basename "$w1")"
    patch_id="${base%-w1.json}"
    [[ -e "$RUNS_DIR/${patch_id}-w2.json" ]] && continue
    candidates+=("$patch_id")
  done
  if [[ "${#candidates[@]}" -eq 0 ]]; then
    log_event wave2_noop reason=no_eligible_patches
    return 0
  fi
  readarray -t candidates < <(printf '%s\n' "${candidates[@]}" | sort)

  local failures=0
  for patch_id in "${candidates[@]}"; do
    if [[ -f "$PENDING_FILE" ]]; then
      log_event wave2_defer patch_id="$patch_id" reason=pending_created_this_tick
      break
    fi
    local t0_real; t0_real="$(json_get "$RUNS_DIR/${patch_id}-w1.json" t0_real)"
    if [[ -z "$t0_real" ]]; then
      log_event wave2_fail patch_id="$patch_id" reason=no_t0_in_run_record
      failures=1
      continue
    fi

    local tmp; tmp="$(mktemp)"
    python3 -c 'import json, sys; print(json.dumps({"kind": "patch_released", "published_at": sys.argv[1]}))' "$t0_real" > "$tmp"
    local rc=0
    node scripts/patch-content-fill.mjs --wave 2 --record "$tmp" || rc=$?
    rm -f "$tmp"

    if [[ "$rc" -eq "$EX_NOT_READY" ]]; then
      log_event wave2_not_ready patch_id="$patch_id"
      continue
    fi
    if [[ "$rc" -ne 0 ]]; then
      log_event wave2_fail patch_id="$patch_id" stage=fill rc="$rc"
      notify "$(printf 'Patch %s: wave 2 fill FAILED (exit %s).' "$patch_id" "$rc")"
      failures=1
      continue
    fi

    local -a touched
    readarray -t touched < <(touched_files)
    if [[ "${#touched[@]}" -eq 0 ]]; then
      log_event wave2_noop patch_id="$patch_id" reason=no_changes_yet
      continue
    fi
    if ! run_gates_or_rollback "$patch_id" "${touched[@]}"; then
      failures=1
      continue
    fi
    stage_pending "$patch_id" 2 "${touched[@]}"
  done
  [[ "$failures" -eq 0 ]]
}

cmd_status() {
  local wm; wm="$(watermark_get)"
  echo "watermark: ${wm:-none}"

  if [[ -f "$PENDING_FILE" ]]; then
    echo "pending: patch $(json_get "$PENDING_FILE" patch_id) wave $(json_get "$PENDING_FILE" wave) ($(json_get "$PENDING_FILE" changed_count) changes)"
  else
    echo "pending: none"
  fi

  echo "wave-2 eligibility:"
  local any=0 w1 base patch_id
  for w1 in "$RUNS_DIR"/*-w1.json; do
    any=1
    base="$(basename "$w1")"
    patch_id="${base%-w1.json}"
    if [[ -e "$RUNS_DIR/${patch_id}-w2.json" ]]; then
      echo "  $patch_id: wave 2 done"
    else
      echo "  $patch_id: wave 2 eligible"
    fi
  done
  [[ "$any" -eq 0 ]] && echo "  (no patches on record)"
  return 0
}

main() {
  install -d -m 700 "$STATE_DIR" "$RUNS_DIR"
  local verb="${1:-}"
  case "$verb" in
    prepare) cmd_prepare ;;
    approve) cmd_approve ;;
    reject)  cmd_reject ;;
    wave2)   cmd_wave2 ;;
    status)  cmd_status ;;
    *)
      echo "usage: $(basename "$0") {prepare|approve|reject|wave2|status}" >&2
      return 2
      ;;
  esac
}

main "$@"
