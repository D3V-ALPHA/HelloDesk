// Milestone 6 (SRS.md §8, FR-3): live team list. Today's Totals (FR-3.3) is
// lazy-loaded on expand to keep the default popup load fast (NFR-1) —
// it reads every member's logs, which isn't needed just to show statuses.
import { db } from "./firebase-init.js";
import { ref, onValue, get } from "../lib/firebase/firebase-database.js";
import { formatClock, dayBucketKey, buildHistory, formatDuration } from "./day-utils.js";

const STATUS_LABEL = { available: "[A]", away: "[W]", offline: "[O]" };
const STATUS_CLASS = { available: "status--available", away: "status--away", offline: "status--offline" };

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function noteFor(status, profile) {
  if (status === "available") return [profile.workingOn, profile.note].filter(Boolean).join(" — ");
  if (status === "away") return profile.awayNote || "";
  return profile.offlineNote || "";
}

export function renderTeamView(container, { teamId }) {
  container.innerHTML = `
    <h2 class="section-title">Team</h2>
    <div class="team-list" id="team-list"><p class="placeholder">Loading team...</p></div>
    <div class="divider">* * *</div>
    <button type="button" class="link-btn" id="totals-toggle">✦ Today's totals (collapsed)</button>
    <div class="totals-panel" id="totals-panel" hidden></div>
  `;

  const listEl = container.querySelector("#team-list");
  const usersRef = ref(db, `teams/${teamId}/users`);

  onValue(usersRef, (snap) => {
    const users = snap.val() || {};
    const rows = Object.values(users).map((u) => {
      const profile = u.profile || {};
      const status = profile.status || "offline";
      const note = noteFor(status, profile);
      return `
        <div class="team-row">
          <div class="team-row__status ${STATUS_CLASS[status] || STATUS_CLASS.offline}">
            ${STATUS_LABEL[status] || STATUS_LABEL.offline} ${escapeHtml(profile.name || "(unnamed)")}
          </div>
          ${note ? `<div class="team-row__note">"${escapeHtml(note)}"</div>` : ""}
          <div class="team-row__since">since ${profile.statusSince ? formatClock(profile.statusSince) : "—"}</div>
        </div>
      `;
    });
    listEl.innerHTML = rows.join("") || `<p class="placeholder">No team members yet.</p>`;
  });

  const toggleBtn = container.querySelector("#totals-toggle");
  const panel = container.querySelector("#totals-panel");
  let loaded = false;

  toggleBtn.addEventListener("click", async () => {
    const willShow = panel.hidden;
    panel.hidden = !willShow;
    toggleBtn.textContent = willShow ? "✦ Today's totals (expanded)" : "✦ Today's totals (collapsed)";
    if (!willShow || loaded) return;

    loaded = true;
    panel.innerHTML = `<p class="placeholder">Loading totals...</p>`;
    const usersSnap = await get(usersRef);
    const users = usersSnap.val() || {};
    const today = dayBucketKey(Date.now());

    const rows = await Promise.all(
      Object.entries(users).map(async ([memberId, u]) => {
        const logsSnap = await get(ref(db, `teams/${teamId}/users/${memberId}/logs`));
        const logs = Object.values(logsSnap.val() || {});
        const days = buildHistory(logs);
        const totalMs = days.get(today)?.totalMs || 0;
        return `<div class="totals-row"><span>${escapeHtml(u.profile?.name || "(unnamed)")}</span><span>${formatDuration(totalMs)}</span></div>`;
      })
    );
    panel.innerHTML = rows.join("") || `<p class="placeholder">No data yet.</p>`;
  });
}
