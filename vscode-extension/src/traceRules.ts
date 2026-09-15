/**
 * Pure append-only rule for TRACE.md, kept free of vscode imports so it can be
 * bundled and diffed against the shell implementation in scripts/.
 *
 * Every version of TRACE.md must have the previous version as an exact byte
 * prefix. An absent file counts as empty content, so deletion surfaces as
 * truncation through the same check rather than needing a separate code path.
 */
export function prefixViolation(prev: Buffer, next: Buffer): string | null {
  if (prev.length === 0) {
    return null;
  }

  // Look for an in-place rewrite before reporting size. An edited entry usually
  // also changes the length, and calling that "truncated" would read as if
  // entries had been dropped.
  const common = Math.min(prev.length, next.length);
  let at = 0;
  while (at < common && prev[at] === next[at]) {
    at += 1;
  }
  if (at < common) {
    const line = prev.subarray(0, at).toString("utf-8").split("\n").length;
    return `diverges at byte ${at + 1}, line ${line}`;
  }
  if (next.length < prev.length) {
    return `truncated from ${prev.length} to ${next.length} bytes`;
  }
  return null;
}
