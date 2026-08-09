import { prependLog } from "../src/lib/prependLog.js";

export function createPrependTee(logFile) {
  let buffer = "";

  function tee(chunk) {
    process.stdout.write(chunk);
    buffer += chunk.toString();
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      prependLog(logFile, `${part}\n`);
    }
  }

  function flush() {
    if (buffer) {
      prependLog(logFile, `${buffer}\n`);
      buffer = "";
    }
  }

  return { tee, flush };
}
