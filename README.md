<div align="center">

# ⚡ HelloDesk

**A lightweight, real-time availability tracker for remote dev teams.**

Who's online. What they're working on. How many hours they've logged today.
No pings, no standups, no invasive monitoring.

`Chrome Extension (MV3)` · `Firebase Realtime Database` · `Anonymous Auth` · `Zero servers to maintain`

</div>

---

```
$ HelloDesk
* * *

My Status
[Available] [Away] [Sign Off]

Working on:
┌────────────────────────────┐
│ UI upgrade on PR #76        │
└────────────────────────────┘

* * *
Team

[A] Alice        since 09:30
   "refactoring payments"
[W] Bob          since 14:00
   "short break, back 20m"
[O] You          since 23:45
   "signing off, back tom."
```

---

## Table of Contents

- [What is this](#what-is-this)
- [Features](#features)
- [Architecture](#architecture)
- [How presence detection works](#how-presence-detection-works)
- [Onboarding flow](#onboarding-flow)
- [Status lifecycle](#status-lifecycle)
- [Data model](#data-model)
- [History & day-boundary logic](#history--day-boundary-logic)
- [Security model](#security-model)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Design system](#design-system)
- [Build status](#build-status)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Getting started](#getting-started)
- [Contributing](#contributing)

---

## What is this

HelloDesk answers three questions at a glance, for teams that work
asynchronously across time zones:

1. **Who's online and available right now?**
2. **What are they currently working on?**
3. **How many hours have they worked today (and on previous days)?**

It replaces the informal "who's around?" ping-pong and manual time tracking
with a one-click popup — no dashboards to check, no separate app to run, no
backend to deploy or pay for.

```mermaid
mindmap
  root((HelloDesk))
    Presence
      Live status per teammate
      Multi-device aware
      onDisconnect auto-offline
    Focus
      "What are you working on?"
      Notes / contact info
      Away & sign-off reasons
    Time
      Per-day work totals
      Expandable session intervals
      Per-user local day boundary
    Team
      Shared Team ID
      Admin removes members
      Hard delete, no audit trail
```

---

## Features

| | Feature | Notes |
|---|---|---|
| 🟢 | **Live status** | Available / Away / Sign Off, color-coded, updates in real time while the popup is open |
| 📝 | **"What are you working on?"** | Free-text field visible to the whole team |
| 💬 | **Contextual notes** | Away reasons, sign-off notes, contact hints |
| 🖥️ | **Multi-device presence** | Online as long as *any* device has an active connection |
| 🔌 | **Crash-safe offline detection** | `onDisconnect()` fires even on a force-quit browser |
| 🕒 | **Daily work totals** | Auto-computed from timestamped status logs |
| 📅 | **Full history view** | Browse any past day, see session intervals and what you worked on |
| 🌍 | **Per-user day boundaries** | A 2am session in Manila doesn't corrupt a colleague's day in Lisbon |
| 👤 | **Anonymous auth** | No email, no password, no personal data required to join |
| 🛠️ | **Admin controls** | First joiner becomes admin, can remove teammates |
| 🎨 | **Terminal aesthetic** | Monospaced, dark, ASCII dividers — built for people who live in a terminal |
| ☁️ | **Zero server maintenance** | Runs entirely on Firebase's free Spark tier — no Cloud Functions, no billing plan |

---

## Architecture

HelloDesk is deliberately thin: a Chrome popup talking straight to Firebase.
There is no backend server, no API layer, and (per a locked v1 decision) no
Cloud Functions.

```mermaid
graph TB
    subgraph "Device A"
        PA["Chrome Extension Popup<br/>(popup.html + JS, MV3)"]
    end
    subgraph "Device B (same user or teammate)"
        PB["Chrome Extension Popup"]
    end
    subgraph "Firebase (Spark / free tier)"
        Auth["Firebase Authentication<br/>(Anonymous)"]
        RTDB[("Realtime Database<br/>teams/{teamId}/users/{uid}")]
    end

    PA -- "signInAnonymously()" --> Auth
    PB -- "signInAnonymously()" --> Auth
    PA <-- "live listeners<br/>(status, logs, connections)" --> RTDB
    PB <-- "live listeners" --> RTDB
    PA -. "onDisconnect().remove()<br/>registered on connect" .-> RTDB
    PB -. "onDisconnect().remove()" .-> RTDB

    style Auth fill:#24283b,stroke:#7dcfff,color:#c0caf5
    style RTDB fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style PA fill:#1a1b26,stroke:#e0af68,color:#c0caf5
    style PB fill:#1a1b26,stroke:#e0af68,color:#c0caf5
```

**Key architectural choices:**

- **No Cloud Functions.** Presence is handled entirely client-side via
  Firebase's `onDisconnect()` primitive — the one mechanism designed to
  survive a hard browser crash without server-side code.
- **Listeners live in the popup only.** The popup's script context is the
  only place holding live Firebase listeners. When the popup closes, those
  listeners die — background "someone just came online" notifications are
  an intentionally deferred feature, not an oversight.
- **Multi-device via a connection counter**, not a single online flag —
  a user with a laptop *and* a desktop open stays "online" until the *last*
  connection drops.

---

## How presence detection works

This is the part of the system doing the most work with the least code.

```mermaid
sequenceDiagram
    participant Client as Extension (popup open)
    participant DB as Realtime Database

    Client->>DB: watch .info/connected
    DB-->>Client: connected = true
    Client->>DB: set connections/{connId} = true
    Client->>DB: register onDisconnect().remove() on connections/{connId}
    Note over DB: Server now guarantees this removal<br/>will happen the moment the socket drops —<br/>even if the client crashes with no warning

    rect rgba(158, 206, 106, 0.08)
    Note over Client,DB: Normal usage — popup open, all well
    end

    alt Browser force-quit / crash / network loss
        DB->>DB: socket drop detected server-side
        DB->>DB: run queued onDisconnect() → remove connections/{connId}
        Client-->>DB: (client itself does nothing — it's gone)
    else Graceful close
        Client->>DB: connections/{connId} naturally becomes irrelevant<br/>next time client watches connection count
    end

    Client->>DB: watch connections/ (via another live device, or on reconnect)
    DB-->>Client: connections node is now empty
    Client->>DB: set profile/status = "offline"<br/>statusSince = ServerValue.TIMESTAMP<br/>(workingOn / notes preserved, not cleared)
```

The guarantee that makes this safe: `onDisconnect()` is registered **on the
server**, not the client. Even if the extension is killed instantly with no
chance to run any JS, Firebase's own server notices the dropped socket and
fires the cleanup anyway.

---

## Onboarding flow

```mermaid
sequenceDiagram
    actor User
    participant Popup as Extension Popup
    participant Auth as Firebase Auth
    participant DB as Realtime Database

    User->>Popup: Enter Name + Team ID, click "Join Team"
    Popup->>Auth: signInAnonymously()
    Auth-->>Popup: uid

    Popup->>DB: get teams/{teamId}/users
    alt No existing members
        DB-->>Popup: empty
        Note over Popup: isFirstMember = true → will become admin
    else Team already has members
        DB-->>Popup: existing members
        Note over Popup: isFirstMember = false
    end

    Popup->>DB: set teams/{teamId}/users/{uid}/profile<br/>{ name, status: "offline", isAdmin, ...blank fields }
    Popup->>Popup: cache { teamId, name } in chrome.storage.local
    Popup-->>User: Show signed-in / status screen
```

On every later popup open, the cached `teamId` skips the form entirely and
Firebase Auth's persisted anonymous session (stored in the extension's own
IndexedDB) reattaches without asking the user to sign in again.

---

## Status lifecycle

```mermaid
stateDiagram-v2
    [*] --> Offline: onboarding complete

    Offline --> Available: click Available
    Available --> Away: click Away
    Away --> Available: click Available
    Available --> Offline: click Sign Off
    Away --> Offline: click Sign Off
    Offline --> Available: reopen popup, click Available

    Offline --> Offline: onDisconnect() fires<br/>(crash / close all windows)
    Available --> Offline: onDisconnect() fires
    Away --> Offline: onDisconnect() fires

    note right of Available
        Optional: "What are you working on?"
        Optional: contact note
    end note
    note right of Away
        Optional: away reason
    end note
    note right of Offline
        Optional: sign-off note
        workingOn / notes preserved,
        never cleared automatically
    end note
```

Every transition is timestamped with `ServerValue.TIMESTAMP` (never the
client's clock) and appended to that user's `logs/` — this timestamped log
is the entire source of truth the History view later reconstructs totals
and session intervals from.

---

## Data model

Everything lives under a single Realtime Database tree, scoped per team:

```mermaid
graph TD
    Root["🌳 teams/"] --> Team["team-id-123/"]
    Team --> Users["users/"]
    Users --> U1["userId1/"]
    U1 --> Profile["profile/"]
    U1 --> Connections["connections/"]
    U1 --> Logs["logs/"]

    Profile --> P1["name: 'Alice'"]
    Profile --> P2["status: 'available'"]
    Profile --> P3["statusSince: 1722000000"]
    Profile --> P4["workingOn: 'refactoring payments'"]
    Profile --> P5["note / awayNote / offlineNote"]
    Profile --> P6["isAdmin: true"]

    Connections --> C1["connId1: true"]
    Connections --> C2["connId2: true"]

    Logs --> L1["logId1: { type: status_change, timestamp, status, workingOn }"]
    Logs --> L2["logId2: { type: working_on_update, timestamp, workingOn }"]

    style Root fill:#1a1b26,stroke:#9ece6a,color:#c0caf5
    style Team fill:#24283b,stroke:#7dcfff,color:#c0caf5
    style Profile fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style Connections fill:#24283b,stroke:#e0af68,color:#c0caf5
    style Logs fill:#24283b,stroke:#565f89,color:#c0caf5
```

- **`profile`** — the current, mutable snapshot the Team view reads.
- **`connections`** — a live counter keyed by connection ID; presence is
  "at least one key exists here."
- **`logs`** — an append-only, timestamped audit trail that the History view
  replays to compute totals and session intervals. Kept indefinitely in v1.

---

## History & day-boundary logic

The trickiest correctness problem in the whole app: a cross-timezone team
means a single global "midnight" would misattribute sessions for anyone not
in one specific timezone.

```mermaid
flowchart TD
    A["Raw status_change logs<br/>(server timestamps, UTC)"] --> B{"For each log entry:<br/>convert to viewer's local time"}
    B --> C{"Local hour < 06:00?"}
    C -- "Yes" --> D["Attribute to the PREVIOUS<br/>calendar day"]
    C -- "No" --> E["Attribute to the SAME<br/>calendar day"]
    D --> F["Group logs by attributed day"]
    E --> F
    F --> G["Within each day:<br/>pair Available→next-status logs<br/>into session intervals"]
    G --> H["Sum interval durations<br/>→ Today's / Day's Total"]
    G --> I["Render expandable intervals<br/>with workingOn updates inside each"]

    style A fill:#24283b,stroke:#565f89,color:#c0caf5
    style H fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style I fill:#24283b,stroke:#7dcfff,color:#c0caf5
```

Default day boundary: **06:00 local time.** A session running 22:00 → 02:00
counts entirely toward the day it *started* on, so a late-night refactor
doesn't get split across two days' totals.

---

## Security model

```mermaid
flowchart LR
    ReadReq["Read request to<br/>teams/{teamId}/users/..."] --> ReadAuth{"auth != null?"}
    ReadAuth -- No --> ReadDeny["❌ Denied"]
    ReadAuth -- Yes --> ReadAllow["✅ Allowed<br/>(any signed-in user who<br/>knows the Team ID)"]

    WriteReq["Write request to<br/>teams/{teamId}/users/{uid}/..."] --> WriteAuth{"auth != null?"}
    WriteAuth -- No --> WriteDeny["❌ Denied"]
    WriteAuth -- Yes --> Owner{"auth.uid == uid?"}
    Owner -- Yes --> WriteAllow["✅ Allowed (own profile/<br/>connections/logs)"]
    Owner -- No --> Admin{"Requester's own<br/>profile/isAdmin == true?"}
    Admin -- Yes --> WriteAllow
    Admin -- No --> WriteDeny

    style ReadAllow fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style WriteAllow fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style ReadDeny fill:#24283b,stroke:#e0af68,color:#c0caf5
    style WriteDeny fill:#24283b,stroke:#e0af68,color:#c0caf5
```

The **Team ID itself is a shared secret, not real access control** —
security-by-obscurity until an invitation system exists (see
[Roadmap](#roadmap)). Anyone holding the string can join and read that
team's data; rules gate *who's authenticated*, not who's allowed to have
learned the Team ID in the first place.

Reads are intentionally **not** gated behind "already a listed member" — an
earlier draft of these rules required exactly that
(`data.child(auth.uid).exists()`), which turned out to be a chicken-and-egg
deadlock: it blocked every first-time joiner, including a team's very first
member, since nobody has a listing yet before they've joined. The read side
was relaxed to "any authenticated user" instead, which is consistent with
the security-by-obscurity model above rather than a weakening of it. Writes
still require you to own the node (or hold `isAdmin`, for removing another
member — see [Manage Team](#status-lifecycle)).

`firebase.rules.json` in this repo is the actual published, working
ruleset — test any change in the Firebase Rules Playground/simulator before
trusting it with real data (see [SETUP.md](SETUP.md)).

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Extension shell | **Manifest V3**, plain HTML/CSS/JS | No build step, no bundler — just files Chrome loads directly |
| Backend | **Firebase Realtime Database** | Free tier, live sync out of the box, `onDisconnect()` primitive |
| Auth | **Firebase Anonymous Auth** | No email/password friction, no personal data collected |
| SDK delivery | **Vendored ESM bundles** (`lib/firebase/`) | MV3's default CSP (`script-src 'self'`) blocks loading scripts from a remote CDN, so the Firebase SDK is downloaded once and self-hosted inside the extension |
| Fonts | JetBrains Mono / Fira Code / Ubuntu Mono | Monospaced, open-licensed, terminal-native feel |
| Hosting | *None* | The extension itself is the only "deployment" — no servers to run or pay for |

---

## Project structure

```
hellodesk/
├── manifest.json
├── popup.html
├── css/
│   └── popup.css              # dark terminal theme, all views
├── js/
│   ├── firebase-config.js     # gitignored — your own Firebase project keys
│   ├── firebase-init.js       # initializes app/auth/db from vendored SDK
│   ├── onboarding.js          # Name + Team ID → anonymous sign-in → profile
│   ├── status.js              # Available / Away / Sign Off + text fields
│   ├── presence.js            # connection counter + onDisconnect()
│   ├── team-view.js           # live-listener team list
│   ├── history.js             # per-day totals + session intervals
│   ├── day-utils.js           # per-user local day-boundary math
│   ├── manage-team.js         # admin panel: view/remove members
│   └── popup.js                # orchestrates all of the above
├── lib/
│   └── firebase/               # vendored Firebase SDK (self-hosted, see Security note above)
└── icons/
    ├── icon16.png / icon48.png / icon128.png
```

---

## Design system

Terminal-inspired, dark by default, monospaced throughout.

| Role | Swatch | Hex |
|---|---|---|
| Background | ⬛ | `#1a1b26` |
| Card / Surface | 🟪 | `#24283b` |
| Primary text | ⬜ | `#c0caf5` |
| Secondary text (timestamps) | ◻️ | `#9aa5ce` |
| Accent — Available | 🟩 | `#9ece6a` |
| Accent — Away | 🟧 | `#e0af68` |
| Accent — Offline | ⬜ | `#565f89` |
| Highlight / Links | 🟦 | `#7dcfff` |
| Separators (`* * *`) | ▫️ | `#3b4261` |

Status indicators are `[A]` / `[W]` / `[O]` colored text, not graphical
icons — consistent with the "typography *is* the brand" philosophy (no logo
image is used anywhere in the extension by design).

---

## Build status

All nine planned v1 milestones are complete:

```mermaid
flowchart LR
    M1["1. Firebase setup ✅"] --> M2["2. Scaffold ✅"]
    M2 --> M3["3. Onboarding ✅"]
    M3 --> M4["4. Status mgmt ✅"]
    M4 --> M5["5. Presence ✅"]
    M5 --> M6["6. Team view ✅"]
    M6 --> M7["7. History ✅"]
    M7 --> M8["8. Manage Team ✅"]
    M8 --> M9["9. Styling pass ✅"]

    style M1 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style M2 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style M3 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style M4 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style M5 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style M6 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style M7 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style M8 fill:#24283b,stroke:#9ece6a,color:#c0caf5
    style M9 fill:#24283b,stroke:#9ece6a,color:#c0caf5
```

Full requirements, rationale for every locked decision, and detailed
per-milestone notes live in [SRS.md](SRS.md).

---

## Known limitations

Deliberately shipped as-is for v1 — tracked, not hidden:

- **Admin-assignment race** — "first user becomes admin" is a
  read-then-write, not an atomic transaction. Two people joining a
  brand-new team in the same instant could theoretically both become admin.
  Low risk at target team size (2–50).
- **No re-onboard fallback** — if a cached session exists but the persisted
  Firebase Auth session never resolves, the popup can stay on "Loading..."
  with no automatic path back to the onboarding form.
- **Day-boundary uses the viewing browser's local time**, not a stored
  per-user timezone (none exists in the data model) — an approximation of
  "per-user local time," not a literal one.
- **History data grows unbounded** — kept indefinitely in v1; fine for
  target team size near-term, export/pruning is a future consideration.
- **No error/retry UI on real-time listeners** — if the live Firebase
  connection drops and doesn't recover, the last-rendered view just stays
  stuck with no visible error or reconnect affordance.
- **Presence drops on popup close, not just browser close** — there's no
  background worker in v1 (by design), so closing the popup ends the same
  connection that tracks presence. Expected, not a bug: you re-click
  Available on reopen.

---

## Roadmap

Explicitly **not** built in v1 — noted here so scope stays honest, not as a
promise:

- 🖥️ **Web dashboard** — read-only status board for office TVs
- 🎟️ **Invitation system** — single-use invite codes instead of a shared
  Team ID string
- 🔗 **GitHub integration** — auto-update "working on" from open PR/branch
  names
- 💬 **Slack / Discord bots** — daily summaries posted to team channels
- 📱 **Mobile companion (PWA)** — quick availability toggles from a phone
- 📊 **Advanced analytics** — team-level trends, heatmaps, exportable
  reports
- 🔔 **Background notifications** — passive "just came online" browser
  toasts, via `chrome.alarms` polling, if real usage ever shows people
  need it
- 🗄️ **Archive-instead-of-delete** on member removal, plus history
  export/pruning for long-lived teams

---

## Getting started

Full step-by-step setup — creating your own Firebase project, wiring in
your config, loading the unpacked extension — lives in
**[SETUP.md](SETUP.md)**. It's written to get you from a fresh clone to a
working extension using your own (free) Firebase project, with nobody's
real credentials committed to this repo.

---

## Contributing

- [SRS.md](SRS.md) is the source of truth for requirements and design
  decisions — read **§0 (Locked Decisions)** before proposing anything that
  touches architecture.
- This is a small, single-purpose tool by design (§1.2) — please don't
  scope-creep into the [Roadmap](#roadmap) items above unless that's
  specifically what you're picking up.
- Keep PRs targeted; avoid drive-by refactors bundled with feature changes.