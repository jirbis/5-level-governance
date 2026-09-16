// Integration: a workspace scaffolded by the extension's templates must satisfy
// the shell gate. The parity suite compares helper functions; this compares the
// two halves of the product as a user meets them — init writes, the gate reads.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

let fails = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const no = (m) => { console.log(`  FAIL ${m}`); fails++; };
const out = mkdtempSync(path.join(tmpdir(), "init-"));
const bundle = path.join(out, "templates.mjs");
const ioBundle = path.join(out, "realityIo.mjs");

for (const [src, dest] of [["src/templates.ts", bundle], ["src/realityIo.ts", ioBundle]]) {
  execFileSync("npx", ["esbuild", src, "--format=esm", "--bundle", "--platform=node", `--outfile=${dest}`], {
    cwd: path.join(root, "vscode-extension"),
    stdio: ["ignore", "ignore", "inherit"],
  });
}
const t = await import(bundle);
const io = await import(ioBundle);

const ws = mkdtempSync(path.join(tmpdir(), "ws-"));

// A real project: source in a subdirectory, an ignored build directory, and the
// gate scripts, which must live in the workspace to find their own root. The
// nested file is the point - init once listed only the root directory, so
// src/app.ts went unrecorded and the workspace failed its own first gate.
mkdirSync(path.join(ws, "scripts"), { recursive: true });
const gateScripts = ["gate_enforce.sh", "path_scope.sh", "decision_log.sh", "reality_gen.sh", "shard_store.sh"];
for (const f of gateScripts) {
  writeFileSync(path.join(ws, "scripts", f), readFileSync(path.join(root, "scripts", f)));
}
mkdirSync(path.join(ws, "src", "deep"), { recursive: true });
writeFileSync(path.join(ws, "src", "app.ts"), "export const x = 1;\n");
writeFileSync(path.join(ws, "src", "deep", "nested.ts"), "export const y = 2;\n");
writeFileSync(path.join(ws, "README.md"), "# a project\n");
writeFileSync(path.join(ws, ".gitignore"), "build/\n");
mkdirSync(path.join(ws, "build"), { recursive: true });
writeFileSync(path.join(ws, "build", "ignored.js"), "// ignored\n");

execFileSync("git", ["-C", ws, "init", "-q"]);
execFileSync("git", ["-C", ws, "config", "user.email", "t@t.t"]);
execFileSync("git", ["-C", ws, "config", "user.name", "t"]);
execFileSync("git", ["-C", ws, "add", "-A"]);
execFileSync("git", ["-C", ws, "commit", "-qm", "project"]);

// Init as extension.ts does it, including the scanner's root-only file list:
// the point is that regenerateReality must correct for it.
const vars = {
  workspaceName: path.basename(ws),
  date: "2026-09-15",
  projectGoal: "ship a thing",
  outOfScope: "everything else",
  existingFiles: ["README.md", ".gitignore"],
};
for (const f of t.GOVERNANCE_FILES) {
  writeFileSync(path.join(ws, f), t.getTemplate(f, vars), "utf-8");
}
for (const d of t.GOVERNANCE_DIRS) {
  mkdirSync(path.join(ws, d), { recursive: true });
}
for (const seed of t.getSeedFiles(vars)) {
  writeFileSync(path.join(ws, seed.path), seed.content, "utf-8");
}
io.regenerateReality(ws);

const listed = readFileSync(path.join(ws, "REALITY.md"), "utf-8");
for (const nested of ["src/app.ts", "src/deep/nested.ts", "scripts/gate_enforce.sh"]) {
  listed.includes(nested) ? ok(`init records the nested file ${nested}`) : no(`init missed ${nested}`);
}
listed.includes("build/ignored.js") ? no("init recorded an ignored file") : ok("init skips ignored files");

execFileSync("git", ["-C", ws, "add", "-A"]);
execFileSync("git", ["-C", ws, "commit", "-qm", "init governance"]);

const gate = (mode) => {
  try {
    return { rc: 0, out: execFileSync("bash", [path.join(ws, "scripts", "gate_enforce.sh"), mode], {
      encoding: "utf-8", env: { ...process.env, GOVERNANCE_DIFF_BASE: "HEAD" },
    }) };
  } catch (e) {
    return { rc: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
};

console.log("== a scaffolded workspace meets the gate ==");

for (const d of t.GOVERNANCE_DIRS) {
  existsSync(path.join(ws, d)) ? ok(`init creates ${d}/`) : no(`init did not create ${d}/`);
}
existsSync(path.join(ws, `trace/${vars.date}-init.md`))
  ? ok("init seeds the first trace entry") : no("no seeded trace entry");

const g2 = gate("gate2");
// Gate 1 is expected to fail on a fresh init: PATH still carries <set ...>
// placeholders by design. Gate 2 must pass, or init ships a broken workspace.
if (g2.rc === 0) ok("Gate 2 passes on a freshly initialized workspace");
else no(`Gate 2 failed on a fresh init:\n${g2.out.split("\n").filter((l) => l.startsWith("FAIL")).join("\n")}`);

for (const needle of [
  "PASS: directory exists: trace/",
  "PASS: directory exists: decisions/",
  "PASS: no unmigrated legacy records",
  "PASS: REALITY.md matches the tree",
  "state gate_1 and gate_2",
]) {
  g2.out.includes(needle) ? ok(`gate reports: ${needle.replace("PASS: ", "")}`) : no(`gate did not report: ${needle}`);
}

console.log();
console.log("== the emitted instructions match the emitted layout ==");
const claude = t.getTemplate("CLAUDE.md", vars);
/TRACE\.md|DECISIONS\.md/.test(claude)
  ? no("CLAUDE.md template still names the removed single-file records")
  : ok("CLAUDE.md template names the record directories, not the removed files");
claude.includes("trace/") ? ok("CLAUDE.md template points at trace/") : no("CLAUDE.md template omits trace/");

const reality = t.getTemplate("REALITY.md", vars);
for (const seeded of ["trace/README.md", "decisions/README.md", `trace/${vars.date}-init.md`]) {
  reality.includes(seeded) ? ok(`REALITY template lists ${seeded}`) : no(`REALITY template omits ${seeded}`);
}
/`TRACE\.md`|`DECISIONS\.md`/.test(reality)
  ? no("REALITY template lists files init never creates")
  : ok("REALITY template lists no nonexistent files");

rmSync(ws, { recursive: true, force: true });
rmSync(out, { recursive: true, force: true });
console.log("-----------------------------------------");
console.log(fails === 0 ? "Init integration: PASS" : `Init integration: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
