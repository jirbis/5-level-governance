### D3 — 2026-09-15 — The append-only records become directories

- `type`: ARCHITECTURAL
- `target_file`: `CLAUDE.md`
- `change`: `TRACE.md` and `DECISIONS.md` are replaced by `trace/` and `decisions/`, one file per entry; append-only becomes per-file immutability, enforced by Gate 2 against the git history.
- `evidence`: a single append-only file is correct but not usable in a team. Two agents, or two branches, appending on the same day collide on the last line of the same file every time, which was recorded as the last open risk blocking parallel work. One file per entry removes the conflict by construction, and the rule gets sharper: instead of "the new content must have the old as a prefix", an entry that existed at the base must be byte-identical now — a per-file question git already answers.
- `approved_by`: gregory.kneller@gmail.com
- `approved_at`: 2026-09-15
