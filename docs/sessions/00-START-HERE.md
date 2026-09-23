# KinderBase — Claude Code handoff

## Setup (once)

1. Copy this folder into the repo:
   - `DECISIONS.md` → `docs/DECISIONS.md`
   - `kb-full.html` → `docs/prototypes/kb-full.html`
   - `01-ENGINE.md` … `06-DEMO-SANDBOX.md` → `docs/sessions/`
2. Add this to the top of `CLAUDE.md`:

```
## Source of truth
- docs/DECISIONS.md overrides the original brief wherever they conflict.
- docs/prototypes/kb-full.html is the executable spec for the mobile app.
  Open it in a browser and match its layout, copy, states, and interactions.
  Use the persona switcher and clock on the right to see every role.
- Session prompts live in docs/sessions/. Do one session at a time.
- Update BUILD.md at the end of every session.
```

3. Before Session 1, finish the student profile prompt through **Part 4** — its shared components (Card, Tab, Chip, Badge, Modal, Toast, PencilField) are reused by everything below. **(Done — full Students module A–G in the KinderBase repo.)**

---

## Kickoff prompt — paste this at the start of each session

Replace `NN-NAME` with the session file.

```
Read docs/DECISIONS.md, then docs/sessions/NN-NAME.md. That session file is
your task for this conversation — nothing outside it.

Open docs/prototypes/kb-full.html in a browser and use it as the spec for
anything on screen. When the prototype and the session file disagree, the
session file wins; when the session file and DECISIONS.md disagree, stop
and ask me.

Before writing code:
1. Tell me what already exists in the repo that this session touches.
2. List the migrations you'll add and anything you'll change in existing ones.
3. List any assumption you're making that isn't written down.

Then build it. Run the tests. Finish with: what's done, what isn't, anything
you discovered that should go in BUILD.md, and the "Done when" checklist from
the session file with each item marked.
```

---

## Session order

| # | File | What you get | Rough size |
|---|---|---|---|
| 1 | `01-ENGINE.md` | Staffing engine, clock, schema, 26 tests, `/dev/staffing` | 1 session |
| 2 | `02-CLASSROOM.md` | Mobile shell, active room, full Classroom tab | 1–2 sessions |
| 3 | `03-TODAY-ME.md` | Priorities, Today, Me, score changes | 1 session |
| 4 | `04-ADMIN-MOBILE.md` | Admin app, approvals, Preview/Cover, float assignment | 1–2 sessions |
| 5 | `05-MESSAGING.md` | Team + Families, translation, quiet hours | 1–2 sessions |
| 6 | `06-DEMO-SANDBOX.md` | `/demo` phone simulator with role switcher | 1 session |

## Decide before the session that needs it

- **Session 1:** Are Assistant Teachers lead-qualified? Does one child under 2 keep a mixed group at full ratio at nap? (Engine currently assumes yes to both.) Confirm the §D(1) reading — 4+ toddlers in a mixed group needs 3 staff — and the 18-month center band.
- **Session 2:** Speech-to-text provider for native (Capacitor plugin is the default suggestion).
- **Session 5:** Translation provider.
- **Session 6:** Demo domain, and the passcode you'll give partners.
