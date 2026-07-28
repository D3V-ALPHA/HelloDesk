// Milestone 7 (SRS.md §8, FR-5): per-day navigable history for the current
// user — total hours + expandable available-intervals with workingOn
// updates, per §5.5's History view mockup.
import { db } from "./firebase-init.js";
import { ref, get } from "../lib/firebase/firebase-database.js";
import { buildHistory, formatClock, formatDuration, formatDayLabel } from "./day-utils.js";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

export async function renderHistoryView(container, { uid, teamId }, onBack) {
  container.innerHTML = `<p class="placeholder">Loading history...</p>`;
  const logsSnap = await get(ref(db, `teams/${teamId}/users/${uid}/logs`));
  const logs = Object.values(logsSnap.val() || {});
  const days = buildHistory(logs);
  const keys = [...days.keys()].sort();
  let idx = keys.length ? keys.length - 1 : -1;

  function render() {
    if (idx < 0) {
      container.innerHTML = `
        <div class="history-header">
          <button type="button" class="link-btn" id="history-back">← Back</button>
          <span class="history-title">✦ Work History</span>
        </div>
        <p class="placeholder">No history yet.</p>
      `;
      container.querySelector("#history-back").addEventListener("click", onBack);
      return;
    }

    const key = keys[idx];
    const day = days.get(key);
    const intervals = day.intervals
      .map((iv) => {
        const updates = iv.workingOnUpdates
          .filter((w) => w.workingOn)
          .map((w) => `<div class="history-interval__update">${formatClock(w.time)} – "${escapeHtml(w.workingOn)}"</div>`)
          .join("");
        const end = iv.end || Date.now();
        return `
          <div class="history-interval">
            <div class="history-interval__range">✦ ${formatClock(iv.start)} – ${iv.end ? formatClock(iv.end) : "now"} (${formatDuration(end - iv.start)})</div>
            ${updates}
          </div>
        `;
      })
      .join("");

    container.innerHTML = `
      <div class="history-header">
        <button type="button" class="link-btn" id="history-back">← Back</button>
        <span class="history-title">✦ Work History</span>
        <span class="history-nav">
          <button type="button" class="link-btn" id="history-prev" ${idx === 0 ? "disabled" : ""}>[&lt;]</button>
          <button type="button" class="link-btn" id="history-next" ${idx === keys.length - 1 ? "disabled" : ""}>[&gt;]</button>
        </span>
      </div>
      <div class="history-day">${formatDayLabel(key)}</div>
      <div class="divider">─────────────────────</div>
      <div class="history-total">Total: ${formatDuration(day.totalMs)}</div>
      ${intervals || `<p class="placeholder">No intervals.</p>`}
    `;

    container.querySelector("#history-back").addEventListener("click", onBack);
    container.querySelector("#history-prev").addEventListener("click", () => {
      if (idx > 0) {
        idx--;
        render();
      }
    });
    container.querySelector("#history-next").addEventListener("click", () => {
      if (idx < keys.length - 1) {
        idx++;
        render();
      }
    });
  }

  render();
}
