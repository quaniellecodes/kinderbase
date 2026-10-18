# KinderBase — Parent app decisions

Companion to `DECISIONS.md`. Everything here governs the family-facing app. Where the two conflict, this file wins for parent surfaces and `DECISIONS.md` wins everywhere else.

Written before any parent code exists, because two of these — the visibility model and the sign-in contract — are expensive to change later and dangerous to get wrong.

---

## 1. A parent is a different principal, not a user with fewer permissions

This is the single most important line in the document.

- Parent access is **deny by default**. A parent sees their own children and nothing else. Every parent-facing query starts from "which children belong to this guardian" and joins outward — never "fetch the classroom, then filter."
- A parent must never see: staffing or ratio state, compliance alerts, teacher scores or growth, time logs and punches, approvals, internal staff channels, lesson-plan drafts, other children's names, photos, or notes.
- **Another child appearing in a photo is not a leak; another child's name is.** Captions, tags, and observation text are scrubbed to the viewing family's child. If a note mentions a second child, it does not go to the feed.
- Write the parent policies adversarially and test them that way: a guardian with a child in Infant A should fail every attempt to read Toddler B, including through a guessed id. Those tests belong in the suite, not in a checklist.
- Guardians have **permission levels**. Authorized pickup is not the same as account access, which is not the same as editing a child's record. Grandma can collect and see the feed without editing medical information.

## 2. Progress — what parents see, and when

The differentiator, and the part most likely to cause harm if rushed.

- **Observations are live. Ratings are not.** Observations — a photo or note a teacher tagged to an ELOF goal — appear as they happen. That is what makes progress feel real-time, because it is.
- **Checkpoint ratings publish three times a year, deliberately.** A rating saved by a teacher is not visible to a family until the checkpoint is released, with the teacher's narrative attached. No auto-publish on save.
- **Releasing a checkpoint is its own permission**, granted or revoked per person by an admin — so a director can hold it, hand it to the instructional lead, or take it back without changing anyone's role.
- **No scores, percentiles, norms, or comparisons to other children.** Show which domains got attention and what was seen. Never a percentage of "complete", never "ahead" or "behind".
- **Screenings never auto-publish.** A screening outcome — especially `refer` — is a conversation a director has with a family. The app may say a screening was completed; it does not deliver the result.
- Be honest about quiet areas. "Nothing recorded in physical development this month" is useful and truthful. Inventing a number to fill a chart is not.
- **Teachers are told what families can see.** Parent-visible ratings create pressure to inflate; that pressure destroys the data you need for grants and accreditation. Internal scoring and family-facing narrative stay separate surfaces.

## 3. Sign-in is two steps, and only the second one counts

A parent tapping a button in the parking lot must never change a classroom's ratio.

```
parent signs in       ->  child is ARRIVING   (not counted, not in the room)
  kiosk PIN, or the app from the parking lot — same state either way
  shows on the teacher's roster as a pending row

teacher confirms      ->  child is PRESENT    (counted toward ratio, in that room)

parent signs out      ->  child is GONE       (removed from the count)
  kiosk or app; no separate release step
```

- **The staffing engine only ever counts `PRESENT`.** Arriving children are visible to the teacher as pending, never in the ratio.
- **An arriving child who is not confirmed gets chased, on an hour's grace.** The first hour of the day is often a consolidated room waiting for staff and children, so a pending row sitting for forty minutes is normal, not a fault. After an hour the teacher is reminded; still unconfirmed after that, it reaches the director's heads-up. A pending row never rolls into the next day.
- The clock runs from the sign-in, not from the start of the day, so a child arriving at 10:30 gets the same hour.
- This also covers morning consolidation honestly: children can be arriving into a room that is still merged, and the teacher confirms them into whichever room they actually land in.

Two ways in, both producing `ARRIVING`:

- **Kiosk with a family PIN.** A guardian enters their own 4-digit code and sees their children, as families already expect from Procare. **Search by name** is the fallback when someone forgets their code.
- **The app, from the parking lot**, geofenced to the property. Location is an input, not proof: geofences drift and can be spoofed, which is exactly why app sign-in produces `ARRIVING` and never `PRESENT`.
- **One PIN per person, used for both sign-in and pickup.**
- Store an auditable record: who, when, method, device, and location accuracy where location was used.
- **Sign-out is a single step.** No separate teacher release.
- **Sign-out requires the geofence too.** Out of range, the app offers directions to the kiosk rather than a button that works from the sofa. After closing time, see §3b.
- The teacher's roster shows the child leaving, and a teacher can undo a sign-out if the child is still with them.
- A family must never be unable to collect their child because a device failed. The front desk is always a valid path.
- Pickup by someone other than a guardian follows the existing authorized-pickup and custody rules. **Custody restrictions block at the point of release, loudly.**

## 3b. Late pickup and fees

- **During normal hours**, a parent may sign out from the app within the geofence.
- **After closing time, a fee-bearing pickup needs the door** — the kiosk, or the teacher confirming the handover. Geofence data is recorded as evidence but is not sufficient on its own once money depends on the minute.
- **Nothing is charged automatically.** A late pickup creates a **proposed fee** in the admin's approval queue. Actions: **Approve · Adjust · Waive**. A waiver takes a reason, kept.
- Families see a fee only once it is approved.
- Waivers and adjustments are audited: who, when, why.
- **Policy is a center setting, taken from the enrollment agreement** — grace period, per-minute or per-block, per child or per family, cap, compounding.
- **Closing time comes from the calendar**, not a constant (early-close days, holidays, per-center hours).
- Parents see the closing time during the afternoon, and an approved fee arrives with its context (collected 6:12 · 12 minutes late · recorded at the kiosk · $24).
- **Show the cost beside the revenue** — late pickups, fees approved/waived, and the staff hours they cost.

## 3c. The journey belongs to the family

**Within the organisation — build it now.** A move between a group's centers carries the full journey: observations, milestones, released checkpoints, room moves. Same operator, same policies, same consents.

**A family archive — build it.** When a child leaves any KinderBase center, the family keeps a **read-only journey** of what they already received.

**Center-to-center transfer — not built.** If it ever ships, it is parent-initiated, per item, and reviewed — never a sync.

**What never travels (beyond the family's own archive):** screenings/referrals/documented concerns; incidents and behaviour notes; photos containing other children; ratings as live assessment data.

**The identity model is a Phase 1 decision.** A child is a **person with a family account**; enrollment is a **center-scoped relationship** with dates. Cheap now, miserable to retrofit.

## 4. Messaging and calls

- Parent threads are **per child**, not per parent. Both guardians see the same thread, including in separated households.
- **Quiet hours apply to outbound messages to families** (6:30 PM – 7:00 AM by default, per center).
- Directors can read family threads, and **the thread says so**.
- **No live calling in v1** (Maryland all-party consent). **Async voice messages** in the existing thread give most of the value.
- **No parent-to-parent direct messages.** A parent community, if it ships, is class-level, opt-in, admin-moderated, never DMs.

## 5. Consent gates content

- **Photo consent is per child and checked at render, not only at post.** A child without consent never appears in a family-facing photo — including in another family's feed.
- Consent is a record with a date and who gave it, not a boolean someone toggled. Withdrawing consent hides existing photos going forward.
- Birthday visibility, directory visibility, and field-trip permissions are their own consents, not implied by enrollment.

## 6. What the app owes a family every day

- An **end-of-day digest** is the default experience, not a stream. Sent at a **fixed hour the admin sets**, per center, switchable off. Never tied to when the last child leaves.
- Absence reporting is first-class — one tap, reaches tomorrow's staffing.
- Incident reports reach parents with an **acknowledgment**, part of the record OCC expects.
- Documents and consents are signable in the app, with a copy the family can keep.

## 7. Separate app, shared codebase

- One repository, a `/p` route group, a second Capacitor configuration producing a separately branded binary.
- **One account across both.** What differs is which contexts the binary exposes (see §7b).
- **Mobile only for v1.** A responsive web fallback exists; no parent desktop surface.
- Parent branding (name, logo, colours) comes from the center record, same as kiosk branding.

## 7b. People who are both staff and parents

**One identity, many memberships.** The switcher moves between **contexts**, not accounts.

- The **staff app** includes a parent context for that person's own children.
- The **parent app** never includes staff context.
- **The active context must be unmistakable.** A persistent indicator, a different accent, the sending identity shown before any message.
- Context decides behaviour: **quiet hours** follow the context; **notifications are labelled**; **switching is audited**.

**Where a staff member must not use staff powers on their own child:**
- Never the **teacher of record** for their own child's checkpoint ratings or screenings.
- Do not **post observations** about their own child from the staff context.
- Their own child's **internal records** are reached through the parent context, even with classroom access. Access from the staff context is logged.

## 7c. Seeing what a family sees

**The sample family — for "how does this look?"** Every center has a seeded demo child, visible only to admins, with realistic content. **Excluded from everything operational** — ratios, enrollment counts, meal counts, reports, the staffing engine. Clearly marked as sample data inside the view.

**Emulation — for "this specific family says something is wrong".** A director opens a named guardian's view.
- **Read-only, no exceptions.** Every write refused, including marking anything read.
- **Loudly visible** while active — a persistent bar naming the guardian and the child, with an exit.
- **Always audited** (who emulated whom, when, how long); a guardian can ask whether anyone viewed their account.
- **Permission-gated** to owner and director, revocable like the checkpoint-release permission.

**Teacher emulation is lighter** — the existing room-level Preview mode, no named individual.

## 8. Build order

**Phase 1 — earn the daily open.** Activity feed and digest · announcements · calendar · menu · child/guardian info · authorized pickups · absence reporting · messaging with quiet hours · documents and consents.

**Phase 2 — the differentiator.** Observations and progress · checkpoint release · lesson plan view · home activities with photo upload · two-step sign-in. **Billing UI ships with Phase 2** against a processor integration.

**Phase 3.** Async voice · parent community.

Release to another operator is **Phase 1 and 2 together, never Phase 1 alone.**

## 9. Decided

1. Sign-in: kiosk family PIN + search-by-name, and geofenced app sign-in. Both produce `ARRIVING`.
2. Arriving children appear on the teacher's roster as a pending row.
3. Checkpoint release is a per-person permission.
4. Billing: build the UI, integrate a processor for the money.
5. One thread per child, including separated households.
6. Digest at a fixed hour set by the admin, switchable off.
7. One PIN per person, used for both sign-in and pickup.
8. No release step; sign-out removes from the count; a teacher can undo it.
9. Unconfirmed arrivals are chased; never carried overnight.
10. No digest on an absent day.
11. An hour's grace on unconfirmed arrivals, from the sign-in.
12. The geofence gates sign-out as well as sign-in.
13. Late fees are proposed, never charged automatically (Approve · Adjust · Waive, reason kept).
14. After closing time, sign-out happens at the door.
15. Families keep a read-only archive; journeys follow children between centers in the same organisation. Transfer to another operator is not built.
16. **A child is a person with a family account**; enrollment is a dated, center-scoped relationship. Decided in Phase 1 because it cannot be retrofitted.
17. A seeded sample family per center, excluded from every operational count; named-guardian emulation is read-only, audited, owner/director only.
18. One identity, many memberships, with a context switcher. The staff app carries a parent context; the parent app never carries staff context. A staff member is never the assessor of record for their own child.

## 10. Still open

Nothing blocking. Open items will come out of building Phase 1.
