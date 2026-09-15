### D1 — 2026-09-15 — Declared scope is a precondition of admissibility
- `type`: ARCHITECTURAL
- `target_file`: `LAW.md`
- `change`: added the Non-Negotiable "No change is admissible outside a scope declared in `PATH.md`", and the Forbidden item "Changing files outside the scope declared for the active step".
- `evidence`: `TRACE.md` 2026-09-15 SCOPE ENFORCEMENT — "No silent scope expansion" had been doctrine since the repository was created while neither Gate 2 implementation looked at what actually changed; the rule became enforceable once Gate 2 began matching the git diff against declared `allowed_paths`.
- `approved_by`: gregory.kneller@gmail.com
- `approved_at`: 2026-09-15

