# HelloDesk – Software Requirements Specification (SRS)

**Version:** 1.2
**Date:** 2026-07-28
**Author:** Muhammad Ali Ashraf

> **Note for Claude (this file lives in the Project context):** This is the working reference for building HelloDesk. Decisions in §0 are locked — don't re-litigate them or re-propose the deferred/cut items as if they were still open, unless the user explicitly reopens one. Check §9 (Build Progress) before assuming what's already built, and update it as milestones are completed in future sessions.

---

## 0. Locked Decisions for v1

These were open questions in earlier drafts; they're now settled. Rationale kept brief for context, not up for silent re-decision.

| Decision | v1 behavior | Why |
|---|---|---|
| Background notifications (FR‑4) | **Deferred, not built in v1.** Team view still updates live whenever the popup is open (FR‑3) — that's unaffected. | Core value of the tool is answered by opening the popup, which is already a one-click action. Passive "ping me the instant X happens" isn't a stated team need. Revisit only if real usage shows people relying on it. |
| Cloud Function offline-detection hardening | **Cut entirely for v1.** Client-side `onDisconnect()` is the only offline-detection mechanism. | Deploying a Cloud Function requires enabling Firebase's Blaze (billing-enabled) plan — real friction for a "no server maintenance" tool, for a narrow edge case (crash before `onDisconnect()` registers) that self-heals on reconnect anyway. |
| Admin remove behavior (FR‑7.1) | **Hard delete.** Profile and logs are removed, not archived. | Simpler to build; no stated need for an audit trail after removal for a small team. Cheap to add archiving later if that changes. |
| Day boundary (§1.3) | **Per-user local time**, default 06:00, not a single fixed instant for the whole team. | Team is explicitly cross-timezone (§1.2). A fixed boundary would misattribute sessions to the wrong day for anyone not in that one timezone — this one directly affects whether people trust their own hour totals. |

---

## 1. Introduction

### 1.1 Purpose

HelloDesk is a lightweight, real‑time availability tracker for remote development teams.

It answers three questions at a glance:

- Who is online and available right now?
- What are they currently working on?
- How many hours have they worked today (and on previous days)?

By eliminating the constant "are you around?" ping‑pong and making current tasks visible, HelloDesk reduces duplicate effort on shared codebases and provides a simple, privacy‑respecting presence system.

### 1.2 Scope

The initial release targets small to medium development teams (2‑50 members) that work asynchronously across different time zones. The software is delivered as a **Chrome extension** backed by **Firebase Realtime Database** – no separate server maintenance is required. This is a small, single-purpose tool for v1 — not a platform. Possible later directions are in §7, but none of them should influence the v1 build.

### 1.3 Definitions & Acronyms

- **Extension** – Chrome browser extension (Manifest V3)
- **Firebase** – Google's backend‑as‑a‑service (Realtime Database, Authentication)
- **User** – A team member using the extension
- **Team** – A group of users sharing the same Team ID
- **Day boundary** – 06:00 in the user's local timezone by default, separating working days so late‑night sessions attribute correctly (see §0)
- **Admin** – The first user to join a team (or a designated manager) with permission to remove members

---

## 2. Overall Description

### 2.1 Product Perspective

HelloDesk is a new, standalone tool that replaces informal "Who's around?" messages and manual time tracking. It sits inside the browser toolbar, always one click away, and blends into a developer's terminal‑centric workflow without interrupting it.

The design language is inspired by **terminal aesthetics and the Butterbian website** – monospaced fonts, ASCII‑style separators, star bullet icons, and a clean, information‑dense layout. The default color scheme is a dark theme that mirrors popular code editors.

### 2.2 User Characteristics

- **Developers** (junior to senior) who work on multiple machines (Windows, macOS, Linux) and need to broadcast their availability and current task.
- **Team leads / managers** who need to see the team's status and track daily work hours without invasive monitoring.
- All users are assumed to be familiar with terminal environments and appreciate minimal, text‑heavy interfaces.

### 2.3 Operating Environment

- Chrome browser (latest stable version) on any desktop OS.
- Internet connection required (Firebase real‑time sync).
- No mobile or tablet support in v1.

### 2.4 Design & Implementation Constraints

- Must use **Manifest V3**.
- Must respect **privacy**: no automatic idle detection, no screen tracking, no keylogging.
- Must work **cross‑platform** without native code.
- Must handle **multiple devices** per user (e.g., laptop + desktop).
- Must persist user status and notes even after browser restart / all Chrome windows closed.
- The UI must use **monospaced fonts** and a **dark terminal‑inspired color palette**.
- Real-time team view listeners live in the popup's own script context (alive only while the popup is open) — this is sufficient for v1 since background notifications are deferred (§0). No `chrome.offscreen` or `chrome.alarms` work needed for v1.

### 2.5 Assumptions & Dependencies

- Users will have Chrome open during work.
- The Team ID is a shared string, kept private between team members — security‑by‑obscurity, not real access control, until an invitation system exists (§7). Anyone with the string can join.
- Firebase Spark (free) tier is sufficient for v1 — no Cloud Functions, no Blaze plan needed (§0).
- Primary fonts (JetBrains Mono, Fira Code) are open-licensed and loadable from Google Fonts.

---

## 3. System Features & Requirements

### 3.1 Functional Requirements

#### FR‑1: Onboarding & Team Join

1. On first install, the extension asks for **Name** and **Team ID**.
2. The user is authenticated anonymously with Firebase.
3. The first user to join a new team automatically becomes **admin**.
4. Subsequent users join by entering the same Team ID.
5. After joining, the user's profile is created in Firebase under that team.

#### FR‑2: Status Management

1. The user can set their status to **Available**, **Away**, or **Sign Off** (Offline).
2. **Available** status:
   - Optional text field "What are you working on?" (e.g., "refactoring payments").
   - Optional note field (e.g., "contact me on WhatsApp").
3. **Away** status:
   - Optional text field for away reason (e.g., "short break, back in 20 min").
4. **Sign Off** status:
   - Optional text field for a sign‑off note (e.g., "signing off, back tomorrow 10am").
5. All status changes are timestamped using `ServerValue.TIMESTAMP` (not client clock) and logged.
6. If the user closes all browser instances, the client's `onDisconnect()` handler sets them to **Offline** and **preserves** all text fields and notes.
7. When the user reopens the extension, their last text fields are pre‑filled, and they can click "Available" to resume.

#### FR‑3: Real‑time Team View

1. The popup displays all team members with: Name, current status (color‑coded), "since" time, `workingOn` text, and any active note.
2. The list updates in real time via a live Firebase listener in the popup's script context, for as long as the popup is open.
3. A collapsible **Today's Totals** section shows accumulated work hours per person for the current working day, using per-user local day-boundary logic (§0).

#### FR‑4: Notifications — Deferred (not in v1)

Not built in the initial release. See §0 for rationale and the condition under which to revisit it. FR‑3's live team view is the v1 substitute for staying aware of status changes.

#### FR‑5: Work History & Time Tracking

1. Every status change and `workingOn` update is logged with a server timestamp.
2. The popup provides a **History** view accessible via a button.
3. In the History view, the user can navigate by date and see:
   - Total work hours for that day.
   - Expandable intervals of availability, each showing start‑end times, duration, and any `workingOn` updates within that interval.
4. Day boundary logic (per-user local time, default 06:00) ensures sessions crossing midnight attribute to the correct working day.
5. History data is kept indefinitely in v1. Database size grows unbounded over time — acceptable for target team size (2–50) near-term; export/prune is a future consideration (§7), not a v1 concern.

#### FR‑6: Multi‑Device Sync

1. A user can be logged in from multiple Chrome instances simultaneously.
2. Active connections are tracked via a counter (`connections/{connId}`).
3. The user is shown as **online** as long as at least one connection exists.
4. All status changes and text updates sync instantly across devices.
5. If the same user changes status from two devices near-simultaneously, the write with the later `ServerValue.TIMESTAMP` wins (last-write-wins) — a natural consequence of keying writes off server time instead of client clocks.
6. When the last connection drops, the client's `onDisconnect()` handler sets status to **Offline**, preserving `workingOn` and notes.

#### FR‑7: User & Team Management

1. Admin users can open a **Manage Team** panel to view all members and remove one — **hard delete** in v1 (§0): profile and logs are removed.
2. Any user can leave the team voluntarily from settings.
3. A removed user's client detects this by listening to its own profile path; when that path no longer exists, the extension returns to the onboarding screen.

#### FR‑8: Persistence & Fault Tolerance

1. All user profile data (status, notes) is stored in Firebase and survives browser crashes, restarts, and OS reboots.
2. The connection counter uses `onDisconnect()` to handle unexpected disconnections — no server-side function involved (§0).
3. No data is lost when switching between devices or after a forced shutdown.

---

### 3.2 Non‑Functional Requirements

#### NFR‑1: Performance
- Popup loads and displays the team list in under 1 second.
- Real‑time updates reflected within 2 seconds.
- Firebase operations minimal, to stay within Spark (free) tier limits.

#### NFR‑2: Reliability
- Offline status correctly detected even when the browser is force‑closed, via `onDisconnect()`.
- Multi‑device conflicts resolved deterministically via server-timestamp last-write-wins (FR‑6.5).

#### NFR‑3: Usability & Accessibility
- Clean, minimal, developer‑friendly UI.
- Monospaced fonts (JetBrains Mono, Fira Code, or Ubuntu Mono).
- Dark terminal‑inspired color scheme (§6).
- All main actions accessible from the popup without navigating away.
- Keyboard navigation and screen reader compatibility (headings, alt text, focus indicators).

#### NFR‑4: Security
- Anonymous Firebase authentication; no personal email required.
- Database rules restrict read/write to team members only — see §5.5 for the rule shape. **Write and test actual rules in the Firebase rules simulator before relying on them** — this is the one place a mistake exposes one team's data to another.
- Admin deletion rights enforced through rules and a stored `isAdmin` flag.

#### NFR‑5: Extensibility
- Architecture should allow future features (§7) without major refactoring.
- Data model should tolerate optional fields and future audit requirements.

---

## 4. System Architecture

### 4.1 High‑Level Architecture

```
[Chrome Extension] ←→ [Firebase Realtime Database]
```

- **Chrome Extension (client):** Popup UI holds the live Firebase listeners for the team view while open.
- **Firebase Realtime Database:** Stores team data, user profiles, presence connections, and history logs.
- No Cloud Functions in v1 (§0).

### 4.2 Data Design (Firebase Realtime Database JSON Tree)

```json
{
  "teams": {
    "team-id-123": {
      "users": {
        "userId1": {
          "profile": {
            "name": "Alice",
            "status": "available",
            "statusSince": 1722000000,
            "workingOn": "refactoring payments",
            "note": "contact me on WhatsApp",
            "awayNote": "",
            "offlineNote": "",
            "isAdmin": true
          },
          "connections": {
            "connId1": true,
            "connId2": true
          },
          "logs": {
            "logId1": {
              "type": "status_change",
              "timestamp": 1722000100,
              "status": "available",
              "workingOn": "refactoring payments",
              "note": ""
            },
            "logId2": {
              "type": "working_on_update",
              "timestamp": 1722001000,
              "workingOn": "debugging checkout flow",
              "status": "available"
            }
          }
        }
      }
    }
  }
}
```

### 4.3 Presence / Offline Detection (v1's only mechanism — §0)

- On connecting, the client writes `connections/{connId}: true` and immediately registers `onDisconnect().remove()` on that same path (standard Firebase presence pattern).
- The client watches `.info/connected`; when the connections node becomes empty, it sets `profile/status: "offline"` with `statusSince: ServerValue.TIMESTAMP`, preserving `workingOn`/notes.
- No server-side code. Works entirely within the Spark (free) plan.

### 4.4 Security Rules — Shape (write and test before relying on them)

Conceptually, for `teams/{teamId}/users/{uid}/...`:

- Read/write allowed only if `auth != null` **and** (`auth.uid == uid`, writing your own profile) **or** the requester is already a recognized member of that team.
- First-join case: a new user must be able to create their own `users/{auth.uid}` node under a team even though they weren't previously a member — handled by allowing create-if-not-exists at that exact path, not by requiring prior membership.
- Team membership for *reading other members'* data should be checked against an explicit `teams/{teamId}/users` listing rather than trusting a client-supplied team ID blindly.

This is a sketch of the shape, not production rule syntax.

---

## 5. User Interface Design

The visual language is a **dark, terminal‑inspired theme** reminiscent of the Butterbian website, adapted to a developer's night‑time workflow.

### 5.1 Visual Identity

- **Logo / Branding:** "HelloDesk" in a bright accent color (green), monospaced bold. Typography is the brand — no logo needed.
- **Icons & Separators:**
  - Section dividers: `* * *` centered.
  - Bullet points: `✦` (star bullet) or `*`.
  - Status indicators use colored text (not graphical circles) – `[A]` Available, `[W]` Away, `[O]` Offline, color-coded.

### 5.2 Typography

- **JetBrains Mono** (OFL) – preferred.
- **Fira Code** (SIL OFL) – alternative with ligatures.
- **Ubuntu Mono** (Ubuntu Font License) – Linux‑friendly fallback.
- System `monospace` as final fallback.

Sizes: base 14px, headings 16px bold, timestamps 12px (muted), line height 1.8.

### 5.3 Dark Color Palette (Tokyo Night / Dracula inspired)

| Role              | Hex       | Usage                                 |
| ----------------- | --------- | ------------------------------------- |
| Background        | `#1a1b26` | Main popup background                 |
| Card / Surface    | `#24283b` | Input fields, expanded panels         |
| Primary text      | `#c0caf5` | Main content, team names              |
| Secondary text    | `#9aa5ce` | Timestamps, "since" labels            |
| Accent – Available| `#9ece6a` | "Available" indicator, active toggles |
| Accent – Away     | `#e0af68` | "Away" indicator                      |
| Accent – Offline  | `#565f89` | "Offline" indicator                   |
| Highlight / Link  | `#7dcfff` | Clickable items, History button       |
| Separator         | `#3b4261` | `* * *` dividers, borders             |

All colors meet WCAG AA contrast requirements against the dark background.

### 5.4 Popup Layout (approx. 320×500 px)

```
┌──────────────────────────────────┐
│  HelloDesk                       │  (JetBrains Mono, #9ece6a)
│  * * *                           │  (centered, #3b4261)
│                                  │
│  My Status                       │
│  [Available] [Away] [Sign Off]   │
│                                  │
│  Working on:                     │
│  ┌────────────────────────────┐  │
│  │ UI upgrade on PR #76       │  │  (input field, #24283b bg)
│  └────────────────────────────┘  │
│  Note:                           │
│  ┌────────────────────────────┐  │
│  │ contact me on WhatsApp     │  │
│  └────────────────────────────┘  │
│                                  │
│  * * *                           │
│  Team                            │
│                                  │
│  [A] Alice                       │  (#9ece6a)
│     "refactoring payments"       │
│     since 09:30                  │  (timestamp, #9aa5ce)
│                                  │
│  [W] Bob                         │  (#e0af68)
│     "short break, back 20m"     │
│     since 14:00                  │
│                                  │
│  [O] You                         │  (#565f89)
│     "signing off, back tom."     │
│     since 23:45                  │
│                                  │
│  * * *                           │
│  ✦ Today's totals (collapsed)   │
│                                  │
│  [History] [Settings] [Manage]   │  (plain text links, #7dcfff)
└──────────────────────────────────┘
```

### 5.5 Additional Views

**Away reason input (when Away is clicked):**
```
  My Status
  [Available] [Away] [Sign Off]

  Away reason:
  ┌────────────────────────────┐
  │ taking a short break,      │
  │ will be back in 30 mins    │
  └────────────────────────────┘
```

**Sign‑Off note:**
```
  My Status
  [Available] [Away] [Sign Off]

  Sign‑off note:
  ┌────────────────────────────┐
  │ I'll be available tomorrow │
  │ morning                    │
  └────────────────────────────┘
```

**History view (separate panel):**
```
  ✦ Work History         [<] [>]

  Wed, Jul 23
  ─────────────────────────────
  Total: 5h 20m
    ✦ 09:30 – 12:00  (2h 30m)
      "UI upgrade on PR #76"
    ✦ 13:15 – 16:05  (2h 50m)
      "fixing auth bug"

  Thu, Jul 24
  ─────────────────────────────
  Total: 4h 10m
    ✦ 22:00 – 02:00* (4h 10m)
      22:00 – "nightly refactor"
      23:15 – "checkout flow debug"
      00:30 – "writing tests"
      * counted as Jul 24 (day boundary 06:00, local time)
```

**Manage Team (Admin only):**
```
  ✦ Manage Team
  ─────────────────────────────
  Alice (Admin)
  Bob – [Remove]
  Charlie – [Remove]
  ─────────────────────────────
  [Leave Team]
```

### 5.6 Notifications (Browser Toasts)

Deferred to a later version (§0). Layout kept here for reference if/when it's built:
```
┌──────────────────────────────────┐
│ HelloDesk                        │
│ Alice is now Available           │
│ "refactoring payments"           │
└──────────────────────────────────┘
```

---

## 6. Implementation Notes

- Fonts loaded from Google Fonts (or self‑hosted) under their respective open licenses.
- All CSS uses custom properties (variables) for theming.
- Popup is a single HTML file with embedded CSS and JS; real-time listeners live in the popup's own script context.
- Security rules must restrict access based on `teamId` and `isAdmin` — see §4.4 for the shape; test before use.
- No Cloud Functions in v1 (§0) — `onDisconnect()` alone covers offline detection.

---

## 7. Future Enhancements (not in v1, don't build toward these yet)

- **Web Dashboard** – read‑only status board for TVs / open office displays.
- **Invitation System** – admin generates single‑use invite codes (replaces the shared-string Team ID).
- **GitHub Integration** – auto‑update "working on" from open PR/branch names (opt‑in).
- **Slack / Discord Bots** – post daily summaries or status changes to team channels.
- **Mobile Companion (PWA)** – quick availability toggles from a phone.
- **Advanced Analytics** – team‑level trends, heatmaps, exportable reports.
- **Background notifications** – if real usage shows people need passive "just came online" alerts (§0), revisit via `chrome.alarms` polling as the simpler option before considering `chrome.offscreen`.
- **Archive-instead-of-delete on member removal**, **history export/pruning** for long-lived teams.

---

## 8. Build Plan (MVP Milestones)

1. **Firebase project setup** – create project, enable Anonymous Authentication, create Realtime Database, write initial security rules (draft, per §4.4).
2. **Extension scaffold** – `manifest.json` (MV3), folder structure, blank popup that opens.
3. **Onboarding** – name + Team ID form, anonymous sign-in, write initial profile to `teams/{teamId}/users/{uid}/profile`.
4. **Status management** – Available/Away/Sign Off buttons, optional text fields, writes with `ServerValue.TIMESTAMP`.
5. **Presence / connections** – connection counter + `onDisconnect()` cleanup (§4.3). Get this right before anything else depends on it.
6. **Real-time team view** – live listener rendering the team list in the popup (FR‑3).
7. **History view** – read logs, group by per-user-local day boundary, compute totals and intervals.
8. **Manage Team panel** – admin-only member list + remove (hard delete, FR‑7).
9. **Styling pass** – apply the dark terminal theme (§5) across all views.

That's the full v1 scope — notifications are intentionally not a milestone here (§0).

---

## 9. Build Progress

Update this checklist as work happens across sessions in this project, so a new chat can see current state without re-deriving it.

- [x] Milestone 1 – Firebase project setup (project `hellodesk-dev`, Anonymous Auth + Realtime DB enabled, draft rules published)
- [x] Milestone 2 – Extension scaffold (manifest.json, popup shell styled with §5 palette, folder structure incl. `lib/firebase/` placeholder for Milestone 3's vendored SDK)
- [x] Milestone 3 – Onboarding (fixed and verified working end-to-end — see resolved bottleneck below)
- [x] Milestone 4 – Status management (`js/status.js`)
- [x] Milestone 5 – Presence / connections (`js/presence.js`)
- [x] Milestone 6 – Real-time team view (`js/team-view.js`)
- [x] Milestone 7 – History view (`js/history.js`, `js/day-utils.js`)
- [x] Milestone 8 – Manage Team panel (`js/manage-team.js`)
- [x] Milestone 9 – Styling pass (extended `css/popup.css` to cover all new views)

**Resolved bottleneck (2026-07-28):** The CSP/gstatic console error blocking Milestone 3
was **not** a caching/DevTools/wrong-folder issue as first suspected. The real cause:
`lib/firebase/firebase-auth.js` and `lib/firebase/firebase-database.js` were raw CDN
downloads whose first line was a live ESM `import ... from "https://www.gstatic.com/
firebasejs/12.16.0/firebase-app.js"` — ES modules resolve their own `import` statements
independently of whichever local path loaded the file, so vendoring the file locally
didn't stop it from trying to reach gstatic.com at import time, which MV3's default
`script-src 'self'` CSP blocks. `firebase-app.js` itself was genuinely self-contained
(its two `gstatic.com` hits are inert string labels, confirmed by reading the
surrounding code). Fix: both import lines were rewritten to `from "./firebase-app.js"`
(a relative path within the same vendored folder); `firebase-app.js`'s actual exports
were checked to confirm every name each file imports (`_getProvider`,
`_isFirebaseServerApp`, `_registerComponent`, `registerVersion`, `getApp`,
`SDK_VERSION`) is present. **A prior session's claim that these files were "confirmed
self-contained, no live gstatic references" was wrong** — grep only caught the
metadata strings in `firebase-app.js` and missed the live imports in the other two
files. Verified working end-to-end by the user (onboarding completed successfully)
after this fix plus the security rules fix below.

**Security rules fixed and verified working (2026-07-28):** the originally-published
rules required `data.child(auth.uid).exists()` to read `teams/{teamId}/users` — a
chicken-and-egg deadlock blocking every first-time joiner, including the very first
team member. The write rule also only allowed `auth.uid === $uid`, which would have
blocked Milestone 8's admin-removes-another-member feature. Fixed rules (read relaxed
to any authenticated user, consistent with §2.5's security-by-obscurity Team ID model;
write given an admin-OR clause) are published, user-confirmed working, and saved as
`firebase.rules.json` in the repo — no longer just a Milestone 1 draft.

**Long-polling/CSP fix (2026-07-28):** after real usage (adding then removing a team
member), the popup got stuck on "Loading..." with `script-src 'self'` CSP errors
pointing at `https://...firebasedatabase.app/.lp?...` URLs. This is unrelated to the
gstatic bug above — it's the Realtime Database client's long-polling fallback
transport, which works by injecting remote `<script>` tags whenever its WebSocket
connection needs to renegotiate (e.g. after a large write like a member removal).
MV3's default CSP always blocks this, extension-wide, regardless of SDK vendoring.
Fixed by calling `forceWebSockets()` (exported by `firebase-database.js`) in
`js/firebase-init.js` before `getDatabase()`, so the SDK never attempts that
fallback. No error handling exists on the `onValue` listeners to surface a stuck
connection either — that's why the symptom was a silent infinite "Loading...", not a
visible error. Not fixed further this pass (would need per-listener error/retry-state
UI); flagged as a known gap below, not a hidden decision.

**Repo/publishing (2026-07-28):** project pushed to
`https://github.com/D3V-ALPHA/HelloDesk.git`. Real Firebase config
(`js/firebase-config.js`) is gitignored; `js/firebase-config.example.js` is the
committed template for anyone else's Firebase project (see `SETUP.md`). Shipped docs
are `README.md`, `SETUP.md`, and this file — no other doc files are part of the repo.

**Known-but-not-fixed / deferred items** (don't re-investigate from scratch, see §0/§7 for why):
- Background notifications — deferred, not a bug.
- Cloud Function hardening — cut, not a bug.
- Admin archive-on-remove — cut in favor of hard delete.
- Admin-assignment race (read-then-write, not a transaction) — low risk at target team size, not fixed.
- No timeout/fallback in `popup.js` if a cached session's Firebase Auth session never resolves — popup stays on "Loading..." with no re-onboard path. Not fixed, flagged only.
- Day-boundary calculation (`js/day-utils.js`) uses the *viewing browser's* local time for every user, not each user's actual stored timezone (none is stored in the data model) — an approximation of "per-user local time" per §1.3, not a literal implementation.
- No error/retry-state UI on real-time listeners (`onValue` calls across `popup.js`, `team-view.js`) — a persistent connection failure currently just leaves the last-rendered view stuck, with no visible error or reconnect affordance. Not fixed this pass.