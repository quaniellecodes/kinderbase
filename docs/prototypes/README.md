# Prototypes

## `kb-full.html` — executable spec for the mobile app

A single self-contained HTML file: the teacher, float, and director mobile apps with the
staffing engine, a persona switcher, and a clock, plus the outer demo frame. Open it in a
browser and use the right-hand panel to switch personas (Maria / Soo Kim / Laura / You) and
the clock (9:12 AM / 12:05 PM nap) to see every role and state.

It is the **UI source of truth** for Sessions 2–6 (layout, copy, states, interactions). The
`ENGINE` `<script>` section (`rule`, `evalRoom`, `breakCheck`, `projection`, `suggestMove`) is
the reference behavior for the Session-1 TypeScript engine — but note the prototype's inline
`band()` uses a 12-month cutoff, which is a **known prototype bug**: `DECISIONS.md` §3 and
`01-ENGINE.md` are authoritative (18-month center band). When the prototype and a session file
disagree, the session file wins; when the session file and `DECISIONS.md` disagree, stop and ask.

> The file is large; keep it verbatim from the design handoff. If it is not present here, drop
> the uploaded `kb-full.html` into this folder unchanged.
