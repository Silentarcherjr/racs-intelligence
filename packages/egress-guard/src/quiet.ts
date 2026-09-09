/**
 * Suppresses one specific, harmless Node warning.
 *
 * kafkajs 2.2.4 computes a negative timeout on Node >= 24, and Node prints a
 * three-line `TimeoutNegativeWarning` with a stack trace every time a client
 * connects. It changes nothing, but on a demo recording three stack traces
 * scrolling past at startup make a working system look broken.
 *
 * Adding a "warning" listener does NOT replace Node's default printer, so the
 * default has to be removed first. Everything except this one warning is then
 * re-emitted, so a real problem still surfaces.
 */
export function quietKafkaTimeoutWarning(): void {
  process.removeAllListeners("warning");
  process.on("warning", (w: Error) => {
    if (w.name === "TimeoutNegativeWarning") return;
    console.warn(w.stack ?? `${w.name}: ${w.message}`);
  });
}
