// Orchestrates onboarding vs. signed-in view, and wires Milestones 4-8
// together in the signed-in view: status panel, live team view, presence,
// History overlay, and Manage Team overlay (SRS.md §8).
import { auth, db, onAuthStateChanged } from "./firebase-init.js";
import { ref, onValue } from "../lib/firebase/firebase-database.js";
import { renderOnboardingForm, getCachedSession, clearCachedSession } from "./onboarding.js";
import { startPresence } from "./presence.js";
import { renderStatusPanel } from "./status.js";
import { renderTeamView } from "./team-view.js";
import { renderHistoryView } from "./history.js";
import { renderManageTeam } from "./manage-team.js";

const root = document.getElementById("app-root");
let presenceStarted = false;

function renderMainShell() {
  root.innerHTML = `
    <div id="status-section"></div>
    <div class="divider">* * *</div>
    <div id="team-section"></div>
    <div class="divider">* * *</div>
    <div class="nav-links" id="nav-links">
      <button type="button" class="link-btn" id="nav-history">[History]</button>
      <button type="button" class="link-btn" id="nav-manage">[Manage]</button>
    </div>
    <div id="overlay-section" hidden></div>
  `;
}

function goToOnboarding() {
  clearCachedSession();
  renderOnboardingForm(root, (session) => renderSignedIn(session));
}

function renderSignedIn({ uid, name, teamId }) {
  renderMainShell();

  const statusSection = document.getElementById("status-section");
  const teamSection = document.getElementById("team-section");
  const navLinks = document.getElementById("nav-links");
  const overlay = document.getElementById("overlay-section");

  let currentProfile = null;
  let removedHandled = false;

  onValue(ref(db, `teams/${teamId}/users/${uid}/profile`), (snap) => {
    if (!snap.exists()) {
      if (removedHandled) return;
      removedHandled = true;
      goToOnboarding();
      return;
    }
    currentProfile = snap.val();
    renderStatusPanel(statusSection, { uid, teamId, profile: currentProfile });
  });

  renderTeamView(teamSection, { teamId });

  if (!presenceStarted) {
    presenceStarted = true;
    startPresence({ uid, teamId });
  }

  function showOverlay(renderFn) {
    statusSection.hidden = true;
    teamSection.hidden = true;
    navLinks.hidden = true;
    overlay.hidden = false;
    renderFn();
  }

  function hideOverlay() {
    statusSection.hidden = false;
    teamSection.hidden = false;
    navLinks.hidden = false;
    overlay.hidden = true;
    overlay.innerHTML = "";
  }

  document.getElementById("nav-history").addEventListener("click", () => {
    showOverlay(() => renderHistoryView(overlay, { uid, teamId }, hideOverlay));
  });

  document.getElementById("nav-manage").addEventListener("click", () => {
    showOverlay(() =>
      renderManageTeam(
        overlay,
        { uid, teamId, isAdmin: !!currentProfile?.isAdmin },
        { onBack: hideOverlay, onLeave: goToOnboarding }
      )
    );
  });
}

async function init() {
  const cached = await getCachedSession();

  onAuthStateChanged(auth, (user) => {
    if (user && cached) {
      renderSignedIn({ uid: user.uid, name: cached.name, teamId: cached.teamId });
    } else if (!cached) {
      renderOnboardingForm(root, (session) => renderSignedIn(session));
    }
  });
}

init();
