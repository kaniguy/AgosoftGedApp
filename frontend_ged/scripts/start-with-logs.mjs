import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createPrependTee } from "./log-utils.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logFile = join(root, "logs_frontend");
const { tee, flush } = createPrependTee(logFile);

const child = spawn("npm", ["run", "start"], {
  cwd: root,
  shell: true,
  env: process.env,
});

child.stdout.on("data", tee);
child.stderr.on("data", tee);

child.on("close", (code) => {
  flush();
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  tee(`[${new Date().toISOString()}] [ERROR] [start] ${err.message}\n`);
  flush();
  process.exit(1);
});
