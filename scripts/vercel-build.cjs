const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { execFileSync } = require("child_process");

const root = process.cwd();
const zipPath = path.join(root, "rubiks-app-main.zip");
const extractedRoot = path.join(root, "rubiks-app-main");

if (!fs.existsSync(zipPath)) throw new Error("rubiks-app-main.zip not found");

for (const name of ["app", "components", "lib", "public", "types", "next.config.mjs", "postcss.config.js", "tailwind.config.ts", "tsconfig.json", "components.json"]) {
  fs.rmSync(path.join(root, name), { recursive: true, force: true });
}

if (!fs.existsSync(extractedRoot)) {
  new AdmZip(zipPath).extractAllTo(root, true);
}

const sourceFiles = ["app", "components", "lib", "public", "types"];
for (const name of sourceFiles) {
  fs.cpSync(path.join(extractedRoot, name), path.join(root, name), { recursive: true });
}

for (const name of ["next.config.mjs", "postcss.config.js", "tailwind.config.ts", "tsconfig.json", "components.json"]) {
  fs.copyFileSync(path.join(extractedRoot, name), path.join(root, name));
}

execFileSync(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "build"], { stdio: "inherit" });
