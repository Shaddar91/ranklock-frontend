//JSONL logging and process exits for the patch-content fill generator.
export const EX_NOT_READY = 75;

export function log(event) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...event }));
}

export function fail(message, code = 1) {
  console.error(`patch-content-fill: ${message}`);
  process.exit(code);
}

export function notReady(reason) {
  log({ event: 'wave2-not-ready', reason });
  console.error(`WAVE2 NOT READY: ${reason}`);
  process.exit(EX_NOT_READY);
}
