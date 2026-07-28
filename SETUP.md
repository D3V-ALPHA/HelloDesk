# HelloDesk — Setup Guide

This gets you from a fresh clone of this repo to a working HelloDesk
extension backed by **your own** Firebase project. Nobody's real credentials
are in this repo — you provide your own in a gitignored config file.

Read [SRS.md](SRS.md) if you want the full spec/architecture. This file is
just the "get it running" steps.

---

## 1. Prerequisites

- Google Chrome (or any Chromium browser — Edge, Brave, etc.)
- A free Google account (for Firebase)
- No Node.js, no build tools, no package manager required — this extension
  runs as plain files, no build step.

---

## 2. Create your own Firebase project

1. Go to https://console.firebase.google.com and click **Add project**.
   Name it anything (e.g. `hellodesk-yourteam`). Google Analytics is not
   needed — you can disable it.
2. In the left sidebar, go to **Build → Authentication** → **Get started**.
   Under the **Sign-in method** tab, enable **Anonymous**.
3. In the left sidebar, go to **Build → Realtime Database** → **Create
   Database**. Pick any region close to your team. Start in **locked mode**
   (you'll paste real rules in step 4).
4. Go to the **Rules** tab of the Realtime Database and replace the default
   rules with the contents of [firebase.rules.json](firebase.rules.json) in
   this repo. Click **Publish**.
   - Optional but recommended: use the **Rules Playground** (simulator) in
     that same tab to test a read/write before trusting it with real data.
5. Go to **Project settings** (gear icon, top left) → scroll to **Your
   apps** → click the **</>  (Web)** icon to register a new web app. Give it
   any nickname. You don't need Firebase Hosting.
6. Firebase will show you a `firebaseConfig` object with your project's
   `apiKey`, `authDomain`, `databaseURL`, etc. Keep this page open for the
   next step.

---

## 3. Wire your config into the extension

1. In this repo, copy the template:
   ```bash
   cp js/firebase-config.example.js js/firebase-config.js
   ```
   (Windows PowerShell: `Copy-Item js/firebase-config.example.js js/firebase-config.js`)
2. Open `js/firebase-config.js` and replace every placeholder value with the
   matching value from the `firebaseConfig` object Firebase showed you in
   step 2.6.
3. `js/firebase-config.js` is gitignored — it will never be committed or
   pushed, so your keys stay local to your machine.

---

## 4. Load the extension in Chrome

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this project's root folder (the one
   containing `manifest.json`).
4. Click the HelloDesk icon in your toolbar. You should see the onboarding
   form (Name + Team ID).
5. Enter any name and any Team ID string (this is just a shared secret your
   team agrees on — see SRS.md §2.5) and click **Join Team**. The first
   person to join a given Team ID becomes that team's admin.
6. Share the same Team ID with your teammates so they land in the same team
   when they each go through step 5 on their own machine.

---

## 5. Verify it's working

- Open DevTools on the popup (right-click the popup → Inspect) and confirm
  there are no red errors in the Console.
- Set your status to Available with a "working on" note, then check the
  Team section shows it.
- Close and reopen the popup — you should be prompted to click Available
  again (this is expected, not a bug).
- Click **History** and **Manage** to confirm both views load without
  errors.

If you hit a `Permission denied` error, double check step 2.4 — your rules
either aren't published yet, or don't match `firebase.rules.json`.

---

## 6. Contributing

- `SRS.md` is the source of truth for requirements and design decisions —
  read §0 (locked decisions) before proposing architecture changes.
- Keep diffs targeted; this is a small, single-purpose tool by design (see
  SRS.md §1.2) — avoid scope creep into SRS.md §7's "Future Enhancements"
  unless that's specifically what you're working on.
