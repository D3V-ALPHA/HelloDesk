// Milestone 5 (SRS.md §8, §4.3): connection counter + onDisconnect cleanup.
// Runs only while the popup's script context is alive (§2.4) — there is no
// background worker in v1, so this connection entry is naturally removed
// (and status set offline) whenever the popup closes, not only when the
// whole browser closes. That is a known simplification of the "no
// background script" architecture, not a bug: FR-2.7 already expects the
// user to re-click Available on reopen.
import { db } from "./firebase-init.js";
import { ref, push, set, onValue, onDisconnect, update, serverTimestamp } from "../lib/firebase/firebase-database.js";

export function startPresence({ uid, teamId }) {
  const connectionsRef = ref(db, `teams/${teamId}/users/${uid}/connections`);
  const connectedRef = ref(db, ".info/connected");
  const profileRef = ref(db, `teams/${teamId}/users/${uid}/profile`);

  let myConnRef = null;

  onValue(connectedRef, (snap) => {
    if (snap.val() !== true) return;
    myConnRef = push(connectionsRef);
    onDisconnect(myConnRef).remove();
    set(myConnRef, true);
  });

  onValue(connectionsRef, (snap) => {
    if (myConnRef && !snap.exists()) {
      update(profileRef, { status: "offline", statusSince: serverTimestamp() });
    }
  });
}
