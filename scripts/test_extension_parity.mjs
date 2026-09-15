// Parity check: the extension's scope matcher must agree with scripts/path_scope.sh.
// Two Gate 2 implementations that disagree are worse than one.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = mkdtempSync(path.join(tmpdir(), "parity-"));
const bundle = path.join(out, "parsers.mjs");

execFileSync("npx", ["esbuild", "src/parsers.ts", "--format=esm", "--bundle", `--outfile=${bundle}`], {
  cwd: path.join(root, "vscode-extension"),
  stdio: ["ignore", "ignore", "inherit"],
});

const realityBundle = path.join(out, "realityRules.mjs");
execFileSync("npx", ["esbuild", "src/realityRules.ts", "--format=esm", "--bundle", `--outfile=${realityBundle}`], {
  cwd: path.join(root, "vscode-extension"),
  stdio: ["ignore", "ignore", "inherit"],
});

const traceBundle = path.join(out, "traceRules.mjs");
execFileSync("npx", ["esbuild", "src/traceRules.ts", "--format=esm", "--bundle", `--outfile=${traceBundle}`], {
  cwd: path.join(root, "vscode-extension"),
  stdio: ["ignore", "ignore", "inherit"],
});

const { pathMatchesGlob, parsePathMd } = await import(bundle);
const { prefixViolation, hasApprovedEntry } = await import(traceBundle);
const { realityStaleness } = await import(realityBundle);

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

// TRACE append-only: the two implementations must agree on verdict, and on
// whether the divergence is a truncation or an in-place rewrite.
const traceCases = [
  ["a\nb\n", "a\nb\nc\n", "pass"],
  ["a\nb\n", "a\nb\n", "pass"],
  ["", "anything\n", "pass"],
  ["a\nb\n", "a\n", "truncated"],
  ["a\nb\n", "", "truncated"],
  ["a\nb\n", "a\nX\nc\n", "diverges"],
  ["a\nb\nc\n", "a\nZ\nc\nd\n", "diverges"],
  // shorter *and* different: an edited entry, not a dropped one
  ["a\nbb\n", "a\nX\n", "diverges"],
  ["a\nbb\n", "a\nb\n", "diverges"],
];

for (const [prev, next, want] of traceCases) {
  const ts = prefixViolation(Buffer.from(prev), Buffer.from(next));
  const dir = mkdtempSync(path.join(tmpdir(), "trace-"));
  writeFileSync(path.join(dir, "prev"), prev);
  writeFileSync(path.join(dir, "next"), next);
  const shOut = execFileSync("bash", [
    "-c",
    `source "${root}/scripts/trace_append_only.sh"; { _trace_is_prefix "$1/prev" "$1/next" && echo __PASS__; } || true`,
    "_",
    dir,
  ]).toString().trim();
  rmSync(dir, { recursive: true, force: true });

  const tsMsg = ts === null ? "__PASS__" : ts;
  const tsKind = ts === null ? "pass" : ts.startsWith("truncated") ? "truncated" : "diverges";

  // Compare the exact wording, not just the verdict: two gates that describe
  // the same finding differently are already drifting apart.
  if (tsMsg === shOut && tsKind === want) {
    console.log(`  ok   trace ${JSON.stringify(prev)} -> ${JSON.stringify(next)} = ${want} :: ${shOut}`);
  } else {
    console.log(`  FAIL trace ${JSON.stringify(prev)} -> ${JSON.stringify(next)}: ts="${tsMsg}" sh="${shOut}" want=${want}`);
    fails++;
  }
}

// DECISIONS: the approval rule must read identically in both runtimes.
const entry = (target, approver) =>
  `\n### D9 — 2026-02-02 — t\n- \`type\`: ARCHITECTURAL\n- \`target_file\`: \`${target}\`\n- \`approved_by\`: ${approver}\n`;

const decisionCases = [
  ["approved LAW entry", entry("LAW.md", "a@b.c"), true],
  ["empty approval", entry("LAW.md", ""), false],
  ["placeholder approval", entry("LAW.md", "<who>"), false],
  ["TBD approval", entry("LAW.md", "TBD"), false],
  ["approved entry about another file", entry("CLAUDE.md", "a@b.c"), false],
  ["nothing appended", "", false],
  ["target and approval in different entries", entry("LAW.md", "") + entry("README.md", "a@b.c"), false],
];

for (const [label, section, want] of decisionCases) {
  const ts = hasApprovedEntry(section, "LAW.md");
  const dir = mkdtempSync(path.join(tmpdir(), "dec-"));
  writeFileSync(path.join(dir, "section"), section);
  const sh = execFileSync("bash", [
    "-c",
    `source "${root}/scripts/decision_log.sh"; _decisions_has_approved_entry LAW.md < "$1/section"`,
    "_",
    dir,
  ]).toString().trim() === "OK";
  rmSync(dir, { recursive: true, force: true });

  if (ts === sh && ts === want) {
    console.log(`  ok   decisions ${label} -> ${want} (both)`);
  } else {
    console.log(`  FAIL decisions ${label}: ts=${ts} sh=${sh} want=${want}`);
    fails++;
  }
}

// REALITY staleness: both runtimes must agree on the verdict and the wording.
const realityBlock = (files) =>
  `# REALITY\n\n<!-- generated:artifacts -->\n## Existing Artifacts\n${files
    .map((f) => "- \`" + f + "\`")
    .join("\n")}\n<!-- /generated:artifacts -->\n\n## Open Risks\n- kept\n`;

const realityCases = [
  ["current", realityBlock(["a.txt", "b/c.txt"]), ["a.txt", "b/c.txt"], false],
  ["unrecorded file", realityBlock(["a.txt"]), ["a.txt", "new.txt"], true],
  ["recorded but absent", realityBlock(["a.txt", "gone.txt"]), ["a.txt"], true],
  ["no markers at all", "# REALITY\n\n## Existing Artifacts\n- `a.txt`\n", ["a.txt"], true],
];

for (const [label, reality, tracked, wantStale] of realityCases) {
  const ts = realityStaleness(reality, tracked);
  const dir = mkdtempSync(path.join(tmpdir(), "real-"));
  execFileSync("git", ["-C", dir, "init", "-q"]);
  execFileSync("git", ["-C", dir, "config", "user.email", "t@t.t"]);
  execFileSync("git", ["-C", dir, "config", "user.name", "t"]);
  writeFileSync(path.join(dir, "REALITY.md"), reality);
  for (const f of tracked) {
    const full = path.join(dir, f);
    execFileSync("mkdir", ["-p", path.dirname(full)]);
    writeFileSync(full, "x");
  }
  // stage exactly the tracked set so `git ls-files` matches the case
  execFileSync("git", ["-C", dir, "add", "--", ...tracked]);
  const shOut = execFileSync("bash", [
    "-c",
    `source "${root}/scripts/reality_gen.sh"; { reality_is_current "$1" && echo __CURRENT__; } || true`,
    "_",
    dir,
  ]).toString().trim();
  rmSync(dir, { recursive: true, force: true });

  const shStale = shOut !== "__CURRENT__";
  const tsMsg = ts.stale ? ts.reason : "__CURRENT__";
  if (ts.stale === shStale && ts.stale === wantStale && tsMsg === shOut) {
    console.log(`  ok   reality ${label} -> ${wantStale ? "stale" : "current"} :: ${shOut}`);
  } else {
    console.log(`  FAIL reality ${label}: ts="${tsMsg}" sh="${shOut}" wantStale=${wantStale}`);
    fails++;
  }
}

rmSync(out, { recursive: true, force: true });
console.log("-----------------------------------------");
console.log(fails === 0 ? "Extension parity: PASS" : `Extension parity: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
