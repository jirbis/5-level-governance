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

const shardBundle = path.join(out, "shardRules.mjs");
execFileSync("npx", ["esbuild", "src/shardRules.ts", "--format=esm", "--bundle", `--outfile=${shardBundle}`], {
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
const { hasApprovedEntry } = await import(traceBundle);
const { realityStaleness } = await import(realityBundle);
const { shardSlug, immutabilityViolation, isEntry, statesGateEvidence } = await import(shardBundle);

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
  // stage exactly the intended set; REALITY.md itself stays untracked and is
  // excluded from the case's expected list, so add it to .gitignore
  writeFileSync(path.join(dir, ".gitignore"), "REALITY.md\n.gitignore\n");
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

// Shard rules: slugs must agree, or the two runtimes name the same entry
// differently and the record forks.
const slugCases = [
  "SCOPE ENFORCEMENT: bind PATH steps!",
  "CI GATE",
  "  ///  ",
  "Ünicode and    spaces",
  "trailing---dashes---",
];
for (const label of slugCases) {
  const ts = shardSlug(label);
  const sh = execFileSync("bash", [
    "-c",
    `source "${root}/scripts/shard_store.sh"; shard_slug "$1"`,
    "_",
    label,
  ]).toString().trim();
  if (ts === sh) {
    console.log(`  ok   slug ${JSON.stringify(label)} -> ${JSON.stringify(ts)} (both)`);
  } else {
    console.log(`  FAIL slug ${JSON.stringify(label)}: ts=${JSON.stringify(ts)} sh=${JSON.stringify(sh)}`);
    fails++;
  }
}

const statusCases = [
  ["A", "trace/x.md", undefined, null],
  ["M", "trace/x.md", undefined, "modified: trace/x.md"],
  ["D", "trace/x.md", undefined, "deleted: trace/x.md"],
  ["R100", "trace/x.md", "trace/y.md", "renamed: trace/x.md -> trace/y.md"],
];
for (const [status, a, b, want] of statusCases) {
  const got = immutabilityViolation(status, a, b);
  if (got === want) {
    console.log(`  ok   status ${status} -> ${want ?? "admissible"}`);
  } else {
    console.log(`  FAIL status ${status}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    fails++;
  }
}

const entryCases = [
  ["trace/2026-01-01-a.md", "trace", true],
  ["trace/README.md", "trace", false],
  ["trace/sub/x.md", "trace", true],
  ["decisions/x.md", "trace", false],
];
for (const [p_, dir, want] of entryCases) {
  if (isEntry(p_, dir) === want) {
    console.log(`  ok   isEntry ${p_} in ${dir}/ -> ${want}`);
  } else {
    console.log(`  FAIL isEntry ${p_} in ${dir}/ -> ${!want}`);
    fails++;
  }
}

// The legacy CODIFY spelling still counts as evidence in both runtimes.
for (const [text, want] of [
  ["gate_1=PASS, gate_2=PASS", true],
  ["Gate1=PASS, Gate2=PASS", true],
  ["gate_1=PASS only", false],
  ["no evidence at all", false],
]) {
  if (statesGateEvidence(text) === want) {
    console.log(`  ok   evidence ${JSON.stringify(text)} -> ${want}`);
  } else {
    console.log(`  FAIL evidence ${JSON.stringify(text)} -> ${!want}`);
    fails++;
  }
}

rmSync(out, { recursive: true, force: true });
console.log("-----------------------------------------");
console.log(fails === 0 ? "Extension parity: PASS" : `Extension parity: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
