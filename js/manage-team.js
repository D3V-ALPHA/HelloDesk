// Milestone 8 (SRS.md §8, FR-7): admin-only member list + hard delete
// remove (§0 — hard delete, not archive), and Leave Team for any user.
// FR-7.3 (removed-user redirect to onboarding) is handled in popup.js via
// a listener on the user's own profile path, not here.
import { db } from "./firebase-init.js";
import { ref, get, remove } from "../lib/firebase/firebase-database.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

export async function renderManageTeam(container, { uid, teamId, isAdmin }, callbacks) {
  container.innerHTML = `<p class="placeholder">Loading team members...</p>`;
  const usersSnap = await get(ref(db, `teams/${teamId}/users`));
  const users = usersSnap.val() || {};

  const rows = Object.entries(users)
    .map(([memberId, u]) => {
      const profile = u.profile || {};
      const isSelf = memberId === uid;
      const label = profile.isAdmin
        ? `${escapeHtml(profile.name)} (Admin)`
        : escapeHtml(profile.name || "(unnamed)");
      const removeBtn =
        isAdmin && !isSelf ? `<button type="button" class="link-btn remove-btn" data-uid="${memberId}">[Remove]</button>` : "";
      return `<div class="manage-row"><span>${label}</span>${removeBtn}</div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="history-header">
      <button type="button" class="link-btn" id="manage-back">← Back</button>
      <span class="history-title">✦ Manage Team</span>
    </div>
    <div class="divider">─────────────────────</div>
    ${rows || `<p class="placeholder">No members.</p>`}
    <div class="divider">─────────────────────</div>
    <button type="button" class="link-btn" id="leave-team-btn">[Leave Team]</button>
  `;

  container.querySelector("#manage-back").addEventListener("click", callbacks.onBack);

  container.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetUid = btn.dataset.uid;
      if (!confirm("Remove this member? This permanently deletes their profile and history.")) return;
      await remove(ref(db, `teams/${teamId}/users/${targetUid}`));
      renderManageTeam(container, { uid, teamId, isAdmin }, callbacks);
    });
  });

  container.querySelector("#leave-team-btn").addEventListener("click", async () => {
    if (!confirm("Leave this team? Your profile and history will be permanently deleted.")) return;
    await remove(ref(db, `teams/${teamId}/users/${uid}`));
    callbacks.onLeave();
  });
}
