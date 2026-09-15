// Parity check: the extension's scope matcher must agree with scripts/path_scope.sh.
// Two Gate 2 implementations that disagree are worse than one.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = mkdtempSync(path.join(tmpdir(), "parity-"));
const bundle = path.join(out, "parsers.mjs");

execFileSync("npx", ["esbuild", "src/parsers.ts", "--format=esm", "--bundle", `--outfile=${bundle}`], {
  cwd: path.join(root, "vscode-extension"),
  stdio: ["ignore", "ignore", "inherit"],
});

const { pathMatchesGlob, parsePathMd } = await import(bundle);

const cases = [
  ["scripts/gate_enforce.sh", "scripts/**"],
  ["scripts/nested/deep/x.sh", "scripts/**"],
  ["scripts/x.sh", "scripts/"],
  ["scriptsfoo/x.sh", "scripts/**"],
  ["vscode-extension/src/gates.ts", "vscode-extension/src/*.ts"],
  ["vscode-extension/src/a/b.ts", "vscode-extension/src/*.ts"],
  ["PATH.md", "PATH.md"],
  ["docs/PATH.md", "PATH.md"],
  ["a/b/foo.md", "**/foo.md"],
  ["foo.md", "**/foo.md"],
  ["src/a.ts", "src/?.ts"],
  ["src/ab.ts", "src/?.ts"],
  ["READMExmd", "README.md"],
  ["a+b/c.ts", "a+b/*.ts"],
  ["x/y/z", "**"],
];

let fails = 0;
for (const [file, glob] of cases) {
  const ts = pathMatchesGlob(file, glob);
  const sh =
    execFileSync("bash", [
      "-c",
      `source "${root}/scripts/path_scope.sh"; scope_path_matches "$1" "$2" && echo yes || echo no`,
      "_",
      file,
      glob,
    ]).toString().trim() === "yes";
  if (ts === sh) {
    console.log(`  ok   ${file} vs ${glob} -> ${ts ? "match" : "nomatch"} (both)`);
  } else {
    console.log(`  FAIL ${file} vs ${glob} -> ts=${ts} sh=${sh}`);
    fails++;
  }
}

// The fenced schema example in PATH.md must never be parsed as a real step.
const parsed = parsePathMd(
  ["# PATH", "", "## Step Schema", "```", "- [x] `EXAMPLE` fenced.", "      allowed_paths: nope/**", "```", "", "## Step List", "- [x] `P1` real.", "      allowed_paths: alpha/**", "      forbidden_paths: alpha/secret", "", "## Current Pointer", "- `active_step`: `P1`"].join("\n")
);
const ids = parsed.steps.map((s) => s.id);
if (ids.length === 1 && ids[0] === "P1") {
  console.log("  ok   fenced example not parsed as a step");
} else {
  console.log(`  FAIL fenced example leaked: ${JSON.stringify(ids)}`);
  fails++;
}
if (parsed.steps[0].allowedPaths.join() === "alpha/**" && parsed.steps[0].forbiddenPaths.join() === "alpha/secret") {
  console.log("  ok   allowed_paths/forbidden_paths attached to the step");
} else {
  console.log("  FAIL scope fields not attached");
  fails++;
}

rmSync(out, { recursive: true, force: true });
console.log("-----------------------------------------");
console.log(fails === 0 ? "Extension parity: PASS" : `Extension parity: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
