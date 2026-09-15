/**
 * Pure REALITY rules, free of vscode imports so they can be bundled and diffed
 * against the shell implementation in scripts/reality_gen.sh.
 *
 * REALITY is meant to be the artifact truth, but a hand-written list drifts.
 * What a machine can observe is generated; judgement stays hand-written and is
 * preserved between the markers' boundaries.
 */
export const ARTIFACTS_OPEN = "<!-- generated:artifacts -->";
export const ARTIFACTS_CLOSE = "<!-- /generated:artifacts -->";

/**
 * Above this many files, list directories with counts instead of every path: an
 * artifact nobody can read is not a record. Must match REALITY_FILE_LIMIT in
 * scripts/reality_gen.sh, or the two gates disagree on large workspaces.
 */
export const REALITY_FILE_LIMIT = 200;

export function artifactLines(
  trackedFiles: string[],
  limit: number = REALITY_FILE_LIMIT
): string[] {
  const files = trackedFiles.filter((f) => f.length > 0);
  if (files.length <= limit) {
    return files.map((f) => `- \`${f}\``);
  }

  // Same collapse as the shell generator: a count per directory, sorted.
  const counts = new Map<string, number>();
  for (const f of files) {
    const parts = f.split("/");
    const dir = parts.length === 1 ? "." : parts.slice(0, -1).join("/");
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  return [
    `- ${files.length} tracked files; listed by directory because the tree exceeds ${limit} entries.`,
    "",
    ...[...counts.entries()]
      .map(([dir, n]) => `- \`${dir}/\` — ${n} file(s)`)
      .sort(),
  ];
}

/** The content currently sitting between the artifact markers. */
export function recordedArtifacts(reality: string): string[] | null {
  const lines = reality.split("\n");
  const start = lines.findIndex((l) => l.startsWith(ARTIFACTS_OPEN));
  if (start === -1) {
    return null;
  }
  const end = lines.findIndex((l, i) => i > start && l.startsWith(ARTIFACTS_CLOSE));
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

export interface Staleness {
  stale: boolean;
  reason?: string;
}

/**
 * Compare the recorded artifact region against what generation would produce.
 *
 * Only the artifact region is compared. The snapshot carries the generation
 * date and HEAD, which move for reasons that are not drift; requiring them to
 * be current would turn every commit into a stale-REALITY failure.
 */
export function realityStaleness(
  reality: string,
  trackedFiles: string[],
  limit: number = REALITY_FILE_LIMIT
): Staleness {
  const recorded = recordedArtifacts(reality);
  if (recorded === null) {
    return {
      stale: true,
      reason: "REALITY.md has no generated artifacts region; run `make reality`",
    };
  }

  const expected = ["## Existing Artifacts", ...artifactLines(trackedFiles, limit)];
  if (recorded.join("\n") === expected.join("\n")) {
    return { stale: false };
  }

  const strip = (l: string) => l.replace(/^- /, "").replace(/`/g, "");
  const recordedSet = new Set(recorded);
  const expectedSet = new Set(expected);
  const unrecorded = expected.filter((l) => l.startsWith("- ") && !recordedSet.has(l)).slice(0, 5);
  const absent = recorded.filter((l) => l.startsWith("- ") && !expectedSet.has(l)).slice(0, 5);

  let reason = "REALITY.md is stale; run `make reality`";
  if (unrecorded.length > 0) {
    reason += ` — unrecorded: ${unrecorded.map(strip).join(" ")}`;
  }
  if (absent.length > 0) {
    reason += ` — recorded but absent: ${absent.map(strip).join(" ")}`;
  }
  return { stale: true, reason };
}

export const SNAPSHOT_OPEN = "<!-- generated:snapshot -->";
export const SNAPSHOT_CLOSE = "<!-- /generated:snapshot -->";

/**
 * Replace the content between a marker pair, leaving everything else untouched.
 * Returns null when the markers are absent: a caller must not fall back to
 * rewriting the file, because the hand-written sections are the whole point of
 * generating only part of it.
 */
export function splice(
  content: string,
  open: string,
  close: string,
  block: string[]
): string | null {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => l.startsWith(open));
  if (start === -1) {
    return null;
  }
  const end = lines.findIndex((l, i) => i > start && l.startsWith(close));
  if (end === -1) {
    return null;
  }
  return [...lines.slice(0, start + 1), ...block, ...lines.slice(end)].join("\n");
}

export interface SnapshotFacts {
  date: string;
  workspaceName: string;
  activeStep: string;
  headSha: string;
  treeState: string;
}

export function snapshotLines(facts: SnapshotFacts): string[] {
  return [
    "## Current State Snapshot",
    `- Generated: \`${facts.date}\``,
    `- Workspace root: \`${facts.workspaceName}\``,
    `- Active PATH step: \`${facts.activeStep}\``,
    `- HEAD at generation: \`${facts.headSha}\``,
    `- Working tree at generation: \`${facts.treeState}\``,
  ];
}

/**
 * Refresh only the generated regions of REALITY.md. Returns null when the file
 * has no such regions, so the caller can refuse rather than overwrite.
 */
export function renderReality(
  current: string,
  facts: SnapshotFacts,
  trackedFiles: string[],
  limit: number = REALITY_FILE_LIMIT
): string | null {
  const withSnapshot = splice(current, SNAPSHOT_OPEN, SNAPSHOT_CLOSE, snapshotLines(facts));
  if (withSnapshot === null) {
    return null;
  }
  return splice(withSnapshot, ARTIFACTS_OPEN, ARTIFACTS_CLOSE, [
    "## Existing Artifacts",
    ...artifactLines(trackedFiles, limit),
  ]);
}
