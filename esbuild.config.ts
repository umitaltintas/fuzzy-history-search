import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "fs";

const watch = process.argv.includes("--watch");

const buildOptions: esbuild.BuildOptions = {
  entryPoints: [
    { in: "src/background/index.ts", out: "background" },
    { in: "src/ui/popup/popup.ts", out: "ui/popup" },
    { in: "src/ui/overlay/overlay.ts", out: "ui/overlay" },
  ],
  bundle: true,
  format: "iife",
  outdir: "dist",
  target: "es2022",
  logLevel: "info",
};

function copyStatic() {
  mkdirSync("dist/ui", { recursive: true });
  mkdirSync("dist/icons", { recursive: true });

  cpSync("manifest.json", "dist/manifest.json");
  cpSync("icons", "dist/icons", { recursive: true });
  cpSync("src/ui/popup/index.html", "dist/ui/index.html");
  cpSync("src/ui/popup/popup.css", "dist/ui/ui.css");
  cpSync("LICENSE", "dist/LICENSE");
}

async function main() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    copyStatic();
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await esbuild.build(buildOptions);
    copyStatic();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
