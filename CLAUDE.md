# HelloDesk — Instructions for Claude Code

Read this file **and** `SRS.md` (same folder) before doing anything else in
this project. SRS.md is the single source of truth for requirements, locked
decisions (§0), architecture, and build progress (§9). This file is
working-rules + session-handoff — it is not a spec duplicate.

You have direct read/write/execute access to this project folder. Use it:
read files yourself, run commands yourself, check real output yourself.
Don't ask the user to paste back things you can check directly.

---

## What this project is

HelloDesk: a lightweight Chrome extension (Manifest V3) + Firebase Realtime
Database app that shows a small dev team who's online, what they're working
on, and daily work hours. Full spec in SRS.md. Small, single-purpose tool —
not a platform. Don't propose scope beyond SRS.md §7 (Future Enhancements)
unless the user explicitly reopens something.

---

## RESOLVED: the CSP/gstatic bottleneck (2026-07-28)

The previous session's "confirmed self-contained, no live gstatic
references" claim about the vendored SDK files was **wrong** — a grep for
`gstatic.com` matched, but nobody checked *where* in the file. Re-verified
from scratch this session by reading the actual first lines of each file:

- `firebase-auth.js` and `firebase-database.js` both opened with a live ESM
  `import { ... } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js"`.
  ES module imports resolve independently of where the importing file itself
  was loaded from — vendoring the file locally does nothing to stop its own
  `import` statement from reaching out to gstatic.com, and MV3's default
  `script-src 'self'` CSP blocks exactly that request. This was the entire
  bug.
- `firebase-app.js` itself was genuinely fine — its two `gstatic.com` string
  matches are inert version-label metadata (`name$q`, a `Logger(...)` tag),
  not runtime requests. That part of the old claim was correct.
- Fix applied: both live import lines rewritten to `from "./firebase-app.js"`
  (relative path within `lib/firebase/`). Verified `firebase-app.js` actually
  exports every name each file imports from it
  (`_getProvider`, `_isFirebaseServerApp`, `_registerComponent`,
  `registerVersion`, `getApp`, `SDK_VERSION`) before making the change.
- The DevTools "Sources tab only shows popup.html/popup.css" symptom was
  never independently confirmed as the actual cause — it's plausible that
  was just DevTools not yet having paused on/loaded the module graph, which
  can look sparse until you interact with the page. No loading/caching bug
  was found or needed to explain the console error; the gstatic import
  explains it completely.

**Still needs a manual check** (see "Next verification step" below) — the
fix is applied and reasoned through, but neither of us has watched it load
clean in an actual Chrome window yet.

---

## Next verification step (do this first, in your own Chrome)

1. Go to `chrome://extensions`, enable Developer Mode (top-right toggle) if
   not already on.
2. If HelloDesk is already listed: click **Remove** on every entry named
   HelloDesk (there may be duplicates from earlier attempts).
3. Click **Load unpacked**, and select the `hellodesk-m3` folder directly
   (the one containing `manifest.json` at its top level, not a parent or
   child folder).
4. Click the HelloDesk icon in the toolbar to open the popup. Right-click
   inside the popup → **Inspect** to open its DevTools.
5. In the **Console** tab: confirm there is no red CSP/gstatic error. You
   should see the onboarding form (Name + Team ID fields) instead of a
   blank or stuck "Loading..." popup.
6. Enter any Name and a Team ID, click **Join Team**. Confirm it moves past
   the form to the main view (Status buttons + Team list), instead of
   showing the red error banner.
7. Report back exactly what you see (a clean load, or the exact new error
   text) — don't paraphrase, paste the literal console text if anything
   shows up in red.

If step 5 or 6 still shows an error, paste it verbatim rather than
describing it — the exact wording matters for diagnosis.

---

## Standing working rules (apply every session)

**Verification, not assumption:**
- Don't assume the contents of a file, script, config, or the live
  extension state — read it yourself (you have file access), or run a
  command yourself and check real output. Don't guess.
- Don't hallucinate file paths, function names, API responses, or command
  output.
- If uncertain whether something exists or is in a given state, check it
  directly rather than presenting an assumption as fact.
- If two explanations are plausible, say so explicitly instead of picking
  one and presenting it as settled.

**Execution boundaries:**
- You have direct access to this project folder — read, write, and run
  commands as needed to make progress. You do not need to ask permission for
  routine local dev actions (reading files, running build/lint commands,
  editing project files, git operations within this repo).
- If a command or action would touch a shared/remote/production resource (a
  live Firebase project, a deployed rule set, publishing/deploying
  anything, etc.), stop and get explicit confirmation before doing it.
- Browser-side verification (loading the unpacked extension, checking
  DevTools) still requires the user's hands — you can give exact steps for
  that, or ask them to paste back console/network output, since you can't
  drive their Chrome browser yourself.

- Never regenerate a whole file/folder for a milestone deliverable when a
  targeted edit will do. For every file touched: state the exact path,
  whether it's new (full content) or an edit (clear before/after), and keep
  edits scoped to what's needed.
- When giving manual browser verification/testing steps, give literal
  numbered steps with exact menu names/buttons/paths — not "check X and see
  what happens."

**Change discipline:**
- Keep diffs minimal and targeted. Don't refactor, rename, or "clean up"
  beyond the specific fix requested.
- One-line fixes get one-line changes.
- Flag anything risky, ambiguous, or out-of-scope instead of quietly
  deciding for the user.

**Communication style:**
- The user is slower with git/tooling — spell out exact commands and steps,
  don't assume shorthand knowledge, when something does need to happen in
  their browser.
- Don't re-explain or re-ask about things already established in SRS.md or
  this file.
- When something is confirmed fixed/done, log it in SRS.md §9 and this
  file's "Current state" section — as a targeted edit, not a full file
  regeneration, unless actually creating a file for the first time.
- Don't pad answers with unnecessary caveats or repeat the question back.

**Session-specific to this project:**
- At the start of a new session, read the actual project files directly
  (you have access) rather than reconstructing them from the SRS
  description or from what a past chat log says was built. Descriptions
  drift from actual code; only the real file is real.
- Investigated-but-not-fixed items get logged in SRS.md §9's
  "known-but-not-fixed" list, so they aren't re-investigated from scratch
  later. Add the bottleneck above there once it's resolved (or update it if
  it's still open at session end).

---

## Current state (update as milestones land — patch this, don't regenerate)

- **Design:** Approved via Claude Design. Matches SRS.md §5 as written — no
  deltas to reconcile.
- **Milestone 1 (Firebase project setup):** Done. Project `hellodesk-dev`,
  region `asia-southeast1`, Anonymous Auth enabled, Realtime Database
  created, draft security rules published (shape per SRS §4.4 — not yet
  simulator-tested, do that before it holds real team data).
- **Milestone 2 (Extension scaffold):** Done. `manifest.json` (MV3,
  `storage` permission only, no background service worker), dark-theme
  popup shell per SRS §5.3.
- **Milestone 3 (Onboarding):** Code written — Name + Team ID form,
  anonymous sign-in, admin-check-then-write, initial profile write to
  `teams/{teamId}/users/{uid}/profile`, session caching via
  `chrome.storage.local`. Firebase SDK v12.16.0 vendored locally into
  `lib/firebase/`. The CSP/gstatic bug that blocked this (see "RESOLVED"
  above) has been fixed by rewriting two live `import` statements to
  relative local paths. **Reasoned through and fixed, but still needs the
  manual browser check above before being fully trusted.**
- **Milestones 4–9: all built this session.**
  - Milestone 4 (Status management) — `js/status.js`: Available/Away/Sign
    Off buttons, optional per-status text fields, writes via
    `ServerValue.TIMESTAMP`, logs `status_change`/`working_on_update`
    entries per FR-5.1.
  - Milestone 5 (Presence/connections) — `js/presence.js`: connection
    counter under `connections/{connId}` + `onDisconnect().remove()`, sets
    profile offline when the connections node empties out. Runs only in the
    popup's script context (no background worker), so closing the popup —
    not just the whole browser — currently drops presence; flagged as a
    known simplification, not silently fixed, since building around it
    means a persistent background script, which is out of v1's scope (§2.4).
  - Milestone 6 (Real-time team view) — `js/team-view.js`: live `onValue`
    listener rendering the team list; "Today's Totals" is lazy-loaded on
    expand (reads all members' logs, so deferred until asked for, per
    NFR-1).
  - Milestone 7 (History view) — `js/history.js` + `js/day-utils.js`:
    per-day navigable history, expandable available-intervals with
    `workingOn` updates, day-boundary bucketing per §1.3/§5.5's example.
  - Milestone 8 (Manage Team) — `js/manage-team.js`: admin-only member list
    + hard delete remove (§0), Leave Team for any user. FR-7.3
    (removed-user redirect to onboarding) is wired in `js/popup.js` via a
    listener on the user's own profile path.
  - Milestone 9 (Styling pass) — `css/popup.css` extended to cover all of
    the above with the existing §5 dark palette; no new color roles
    introduced.
  - `js/popup.js` was rewritten to orchestrate all of the above (previously
    only handled onboarding vs. a Milestone-4-placeholder signed-in view).
- **Known limitations flagged (not bugs, not fixed, logged for later):**
  - Admin-assignment race: "first user becomes admin" is a read-then-write,
    not a Firebase transaction. Two people joining a brand-new team at the
    exact same instant could both get `isAdmin: true`. Low risk at this team
    size.
  - No timeout/fallback in `popup.js`: if a cached session exists but
    Firebase Auth's persisted session never resolves, the popup sits on
    "Loading..." indefinitely with no fallback to re-onboard.
  - Day-boundary math in `js/day-utils.js` uses the *viewing* browser's
    local time for every team member, since no per-user timezone is stored
    in the data model — an approximation of §1.3's "per-user local time,"
    not literal.
  - Presence drops on popup close, not just browser close (see Milestone 5
    note above) — inherent to the no-background-worker architecture, not a
    bug to silently work around.
  - Security rules (§4.4) are still the Milestone 1 draft — **not written
    as real rule syntax or tested in the Firebase simulator yet.** This
    touches the live Firebase project, so it needs your explicit go-ahead
    before being done (see "Execution boundaries" above).
- **Icons:** `icons/icon16.png`, `icon48.png`, `icon128.png` are in place,
  generated from the user's real `HelloDesk-Icon.png` artwork. The
  `HelloDesk-logo.png` wordmark is NOT used anywhere in the extension by
  design — SRS §5.1 states typography (styled `<h1>` text) is the branding,
  no logo image needed. Keep it that way unless the user reopens this.
- **Next up:** Do the manual browser verification above. If clean, all nine
  v1 milestones are functionally done — remaining open items are the
  flagged limitations above, plus writing/testing real Firebase security
  rules (needs the user's console access and sign-off before touching the
  live project).
- **Verified working end-to-end (2026-07-28):** user confirmed onboarding
  succeeded after publishing the rules fix below. Milestone 3 is genuinely
  done, not just "should work."
- **Security rules fix (2026-07-28):** the user's originally-published
  rules required `data.child(auth.uid).exists()` to read
  `teams/{teamId}/users` — a chicken-and-egg deadlock that blocked every
  first-time joiner (including the team's very first member). Also, the
  write rule only allowed `auth.uid === $uid`, which would have blocked
  Milestone 8's admin-remove-another-member feature. Fixed rules (relaxed
  read to any authenticated user — consistent with SRS §2.5's
  security-by-obscurity Team ID model — and added an admin-write OR clause)
  are published and working; saved to `firebase.rules.json` in the repo as
  the source of truth for this project and as a starting point for anyone
  else's Firebase project via SETUP.md.
- **Repo/publishing setup (2026-07-28):** project is now a git repo, ready
  to push to GitHub. `js/firebase-config.js` (real Firebase keys) is
  gitignored — never committed. `js/firebase-config.example.js` is the
  committed template; anyone cloning the repo copies it and fills in their
  own Firebase project's values (see `SETUP.md`). Note: Firebase's
  client-side config values aren't secret by Firebase's own security model
  (protection comes from database rules, not from hiding `apiKey` etc.) —
  gitignoring it here is about letting other teams plug in their own
  project cleanly, not about preventing a real leak.

---

## Locked decisions — do not re-litigate (full rationale in SRS.md §0)

- Background notifications (FR‑4): deferred, not in v1.
- Cloud Function offline-detection hardening: cut for v1, `onDisconnect()`
  only.
- Admin remove (FR‑7.1): hard delete, not archive.
- Day boundary: per-user local time, default 06:00 — not a single global
  instant.

---

## Project structure (as of Milestone 3)

```
hellodesk-m3/
├── manifest.json
├── popup.html
├── css/
│   └── popup.css            (dark terminal theme, §5 — covers all views)
├── js/
│   ├── firebase-config.js   (real Firebase project config, already wired in)
│   ├── firebase-init.js     (initializes app/auth/db from vendored SDK)
│   ├── onboarding.js        (Name+TeamID form, sign-in, profile write)
│   ├── status.js            (Milestone 4: status buttons + fields)
│   ├── presence.js          (Milestone 5: connections + onDisconnect)
│   ├── team-view.js         (Milestone 6: live team list + today's totals)
│   ├── day-utils.js         (shared day-boundary/format helpers, M6+M7)
│   ├── history.js           (Milestone 7: per-day history navigation)
│   ├── manage-team.js       (Milestone 8: admin remove + leave team)
│   └── popup.js             (orchestrates all of the above)
├── lib/
│   └── firebase/
│       ├── firebase-app.js       (vendored SDK v12.16.0, self-contained)
│       ├── firebase-auth.js      (vendored SDK v12.16.0, patched to
│       │                          import firebase-app.js via relative path)
│       └── firebase-database.js  (same patch as firebase-auth.js)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## What the user has that isn't in this repo checkout

- Real logo/icon source assets (`HelloDesk-Icon.png`, `HelloDesk-logo.png`)
  — icons already generated and placed; logo intentionally unused (see
  above).
- The actual Firebase console state (rules, data, auth users) — only
  visible to the user directly; ask for screenshots/console output if you
  need to confirm current live state rather than assuming.
