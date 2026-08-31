//Player identity band (C5) — ported from the prototype PlayerHeader (pages2),
//re-wired to the live /players/:id + /players/:id/heroes data. Everything shown
//is served: rank emblem from `badge`, win-rate/matches from the profile, form
//dots from the recent matches' winner flags, top heroes from the hero ledger.
//The "Top N%" chip only renders when /performance served a percentile over a
//big-enough sample (MIN_PERCENTILE_SAMPLE), and the
//"My Stats" chip only when the signed-in viewer owns this account (auth branch).
import { Chip, GameIcon, FormDots, Icon, RankBadge } from '../ui/index';
import ShareLinkButton from '../ui/ShareLinkButton';
import { resolveAsset } from '../../../lib/assets';
import { cssVars } from '../../../lib/cssVars';
import { count, pct } from '../../../lib/format';
import { getRank, rankFromBadge, subLabel } from '../../../lib/ranks';
import type { HeroLedgerRow, PlayerProfileResponse } from '../../../types/api';

interface PlayerHeaderProps {
  player: PlayerProfileResponse;
  heroes: HeroLedgerRow[] | undefined;
  formWins: boolean[];
  topPercentile: number | null;
  isOwner: boolean;
}

//Momentum verdict → chip tone. The backend labels the last-10 record "hot"
//(≥60% wins), "slumping" (≤40%), or "neutral" (analytics::form_label).
const FORM_TONE: Record<string, 'win' | 'loss' | 'neutral'> = {
  hot: 'win',
  slumping: 'loss',
  neutral: 'neutral',
};

export default function PlayerHeader({ player, heroes, formWins, topPercentile, isOwner }: PlayerHeaderProps) {
  const rk = rankFromBadge(player.badge);
  const rankColor = rk ? getRank(rk.tier).color : 'var(--brass-edge)';
  const topHeroes = [...(heroes ?? [])].sort((a, b) => b.matches - a.matches).slice(0, 3);
  const main = topHeroes[0];
  //recent_form is on the wire from GET /players/:id (infallible by contract);
  //surface it as a chip alongside the ordered last-10 form dots (§A.4).
  const form = player.recent_form;

  return (
    <div className="brass-frame" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
      {main?.icon_url && <div className="ph-art" style={{ backgroundImage: `url(${resolveAsset(main.icon_url)})` }} />}
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />
      <div className="ph-grid">
        {/* identity */}
        <div className="flex" style={{ alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative' }}>
            <GameIcon kind="hero" name={main?.hero_name ?? player.steam_name} src={main?.icon_url} size={84} />
            {rk && (
              <div style={{ position: 'absolute', right: -14, bottom: -12 }}>
                <RankBadge tier={rk.tier} sub={rk.sub} size={52} />
              </div>
            )}
          </div>
          <div>
            <div className="flex" style={{ alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <h1 className="display" style={{ fontSize: 32, fontWeight: 700 }}>
                {player.steam_name}
              </h1>
              {isOwner && (
                <span className="chip gold">
                  <Icon name="spark" size={12} /> My Stats
                </span>
              )}
              {topPercentile != null && (
                <span className="chip gold">
                  <Icon name="trophy" size={12} /> Top {topPercentile}%
                </span>
              )}
              <ShareLinkButton url={`https://ranklock.app/players/${player.account_id}/`} />
            </div>
            <div className="flex" style={{ alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {rk && (
                <span className="display" style={cssVars({ color: rankColor }, { fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap' })}>
                  {subLabel(rk.tier, rk.sub)}
                </span>
              )}
              <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>
                {count(player.matches)} matches
              </span>
              <span className="faint" style={{ fontSize: 13 }}>·</span>
              <span className="mono faint" style={{ fontSize: 12 }}>
                ID {player.account_id}
              </span>
            </div>
            <div className="flex" style={{ marginTop: 10, alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {formWins.length > 0 && <FormDots form={formWins} />}
              {form.total > 0 && (
                <Chip tone={FORM_TONE[form.label] ?? 'neutral'} title={`Last ${form.total} games`}>
                  Recent form: {form.wins}W–{form.losses}L · {form.label}
                </Chip>
              )}
            </div>
          </div>
        </div>

        {/* win-rate summary (centre) */}
        <div className="ph-mid">
          <div className="label-xs" style={{ marginBottom: 6 }}>
            Win rate
          </div>
          <div className="display" style={{ fontSize: 30, fontWeight: 700, color: player.win_rate != null && player.win_rate >= 50 ? 'var(--win)' : 'var(--text)' }}>
            {pct(player.win_rate)}
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {count(player.wins)} W lifetime
          </div>
        </div>

        {/* top heroes */}
        <div>
          <div className="label-xs" style={{ marginBottom: 9 }}>
            Top heroes
          </div>
          {topHeroes.length > 0 ? (
            <div className="flex" style={{ gap: 10 }}>
              {topHeroes.map((h) => (
                <div key={h.hero_id} className="tile" style={{ padding: '8px 10px', textAlign: 'center', width: 74 }}>
                  <GameIcon kind="hero" name={h.hero_name} src={h.icon_url} size={40} />
                  <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: (h.win_rate ?? 0) >= 50 ? 'var(--win)' : 'var(--loss)' }}>
                    {pct(h.win_rate, 0)}
                  </div>
                  <div className="faint" style={{ fontSize: 10 }}>
                    {count(h.matches)}g
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="faint" style={{ fontSize: 12 }}>
              No hero ledger yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
