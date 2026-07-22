import fs from "node:fs";
import path from "node:path";

const candidates = [
  path.join("node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
  path.join(
    "node_modules",
    "react-pdf",
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.min.mjs"
  ),
];

const source = candidates.find((candidate) => fs.existsSync(candidate));
if (!source) {
  console.warn("[copy-pdf-worker] pdf.worker.min.mjs introuvable — ignore.");
  process.exit(0);
}

fs.mkdirSync("public", { recursive: true });
fs.copyFileSync(source, path.join("public", "pdf.worker.min.mjs"));
console.log(`[copy-pdf-worker] Copié depuis ${source}`);
