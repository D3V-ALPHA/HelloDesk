// Milestone 3 (SRS.md §8, FR-1): onboarding form (Name + Team ID),
// anonymous sign-in, and initial profile write to
// teams/{teamId}/users/{uid}/profile.
//
// Known limitation (not fixed, flagging per project working rules):
// the "first user becomes admin" check below is a plain read-then-write,
// not a transaction. Two people joining the same brand-new team at the
// exact same moment could theoretically both read "no members yet" and
// both get isAdmin: true. Low risk for this team size/usage pattern, but
// noted here so it isn't rediscovered from scratch later. A Firebase
// transaction() on the admin flag would close this gap if it ever matters.

import { auth, db, signInAnonymously } from "./firebase-init.js";
import {
  ref,
  get,
  set,
  serverTimestamp,
} from "../lib/firebase/firebase-database.js";

const SESSION_KEY = "hellodesk_session";

export function renderOnboardingForm(root, onJoined) {
  root.innerHTML = `
    <form id="onboarding-form" class="onboarding-form">
      <div class="field">
        <label for="name-input">Name</label>
        <input id="name-input" type="text" maxlength="60" required />
      </div>
      <div class="field">
        <label for="team-input">Team ID</label>
        <input id="team-input" type="text" maxlength="60" required />
      </div>
      <button type="submit" class="btn-primary">Join Team</button>
      <p class="error-text" id="onboarding-error" hidden></p>
    </form>
  `;

  const form = root.querySelector("#onboarding-form");
  const errorEl = root.querySelector("#onboarding-error");
  const submitBtn = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const name = root.querySelector("#name-input").value.trim();
    const teamId = root.querySelector("#team-input").value.trim();
    if (!name || !teamId) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Joining...";

    try {
      const uid = await ensureSignedIn();
      await joinTeam({ uid, name, teamId });
      await chrome.storage.local.set({ [SESSION_KEY]: { teamId, name } });
      onJoined({ uid, name, teamId });
    } catch (err) {
      console.error("HelloDesk onboarding failed:", err);
      errorEl.textContent =
        "Couldn't join the team. Check your connection and Team ID, then try again.";
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Join Team";
    }
  });
}

function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) {
      resolve(auth.currentUser.uid);
      return;
    }
    signInAnonymously(auth)
      .then((cred) => resolve(cred.user.uid))
      .catch(reject);
  });
}

async function joinTeam({ uid, name, teamId }) {
  const usersRef = ref(db, `teams/${teamId}/users`);
  const existingUsers = await get(usersRef);
  const isFirstMember = !existingUsers.exists();

  const profileRef = ref(db, `teams/${teamId}/users/${uid}/profile`);
  await set(profileRef, {
    name,
    status: "offline",
    statusSince: serverTimestamp(),
    workingOn: "",
    note: "",
    awayNote: "",
    offlineNote: "",
    isAdmin: isFirstMember,
  });
}

export async function getCachedSession() {
  const result = await chrome.storage.local.get(SESSION_KEY);
  return result[SESSION_KEY] || null;
}

export async function clearCachedSession() {
  await chrome.storage.local.remove(SESSION_KEY);
}
