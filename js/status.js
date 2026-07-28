// Milestone 4 (SRS.md §8, FR-2): Available/Away/Sign Off buttons + optional
// text fields, writes with ServerValue.TIMESTAMP, logged per FR-5.1.
import { db } from "./firebase-init.js";
import { ref, update, push, serverTimestamp } from "../lib/firebase/firebase-database.js";

function escapeAttr(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function renderStatusPanel(container, { uid, teamId, profile }) {
  const initialStatus = profile.status === "available" || profile.status === "away" ? profile.status : "offline";

  container.innerHTML = `
    <h2 class="section-title">My Status</h2>
    <div class="status-buttons">
      <button type="button" class="status-btn status-btn--available" data-status="available">Available</button>
      <button type="button" class="status-btn status-btn--away" data-status="away">Away</button>
      <button type="button" class="status-btn status-btn--offline" data-status="offline">Sign Off</button>
    </div>
    <div class="status-fields" id="status-fields"></div>
  `;

  const fieldsEl = container.querySelector("#status-fields");
  const buttons = [...container.querySelectorAll(".status-btn")];

  function highlight(status) {
    buttons.forEach((b) => b.classList.toggle("active", b.dataset.status === status));
  }

  function fieldsTemplate(status) {
    if (status === "available") {
      return `
        <div class="field">
          <label for="working-on-input">Working on:</label>
          <input id="working-on-input" type="text" maxlength="120" value="${escapeAttr(profile.workingOn)}" />
        </div>
        <div class="field">
          <label for="note-input">Note:</label>
          <input id="note-input" type="text" maxlength="120" value="${escapeAttr(profile.note)}" />
        </div>
      `;
    }
    if (status === "away") {
      return `
        <div class="field">
          <label for="away-note-input">Away reason:</label>
          <input id="away-note-input" type="text" maxlength="120" value="${escapeAttr(profile.awayNote)}" />
        </div>
      `;
    }
    return `
      <div class="field">
        <label for="offline-note-input">Sign-off note:</label>
        <input id="offline-note-input" type="text" maxlength="120" value="${escapeAttr(profile.offlineNote)}" />
      </div>
    `;
  }

  function readFieldValues(status) {
    if (status === "available") {
      return {
        workingOn: fieldsEl.querySelector("#working-on-input")?.value.trim() || "",
        note: fieldsEl.querySelector("#note-input")?.value.trim() || "",
      };
    }
    if (status === "away") {
      return { awayNote: fieldsEl.querySelector("#away-note-input")?.value.trim() || "" };
    }
    return { offlineNote: fieldsEl.querySelector("#offline-note-input")?.value.trim() || "" };
  }

  let currentStatus = initialStatus;
  fieldsEl.innerHTML = fieldsTemplate(currentStatus);
  highlight(profile.status || "offline");

  const profileRef = ref(db, `teams/${teamId}/users/${uid}/profile`);
  const logsRef = ref(db, `teams/${teamId}/users/${uid}/logs`);

  async function commitStatus(status) {
    currentStatus = status;
    fieldsEl.innerHTML = fieldsTemplate(status);
    highlight(status);
    const extra = readFieldValues(status);

    await update(profileRef, { status, statusSince: serverTimestamp(), ...extra });
    await push(logsRef, {
      type: "status_change",
      timestamp: serverTimestamp(),
      status,
      workingOn: status === "available" ? extra.workingOn : profile.workingOn || "",
      note: status === "available" ? extra.note : "",
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => commitStatus(btn.dataset.status));
  });

  fieldsEl.addEventListener("change", async (e) => {
    if (e.target.tagName !== "INPUT") return;
    const extra = readFieldValues(currentStatus);
    await update(profileRef, extra);
    if (currentStatus === "available" && e.target.id === "working-on-input") {
      await push(logsRef, {
        type: "working_on_update",
        timestamp: serverTimestamp(),
        workingOn: extra.workingOn,
        status: currentStatus,
      });
    }
  });
}
