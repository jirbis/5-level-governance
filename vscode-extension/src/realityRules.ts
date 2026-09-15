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

export function artifactLines(trackedFiles: string[]): string[] {
  return trackedFiles.filter((f) => f.length > 0).map((f) => `- \`${f}\``);
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
export function realityStaleness(reality: string, trackedFiles: string[]): Staleness {
  const recorded = recordedArtifacts(reality);
  if (recorded === null) {
    return {
      stale: true,
      reason: "REALITY.md has no generated artifacts region; run `make reality`",
    };
  }

  const expected = ["## Existing Artifacts", ...artifactLines(trackedFiles)];
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
