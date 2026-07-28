// Initializes the Firebase app, Auth, and Realtime Database instances
// using the locally vendored SDK (see lib/firebase/README.md — MV3's
// default CSP blocks remote script/module loading, so these files are
// self-hosted rather than pulled from the gstatic CDN at runtime).
import { initializeApp } from "../lib/firebase/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "../lib/firebase/firebase-auth.js";
import { getDatabase } from "../lib/firebase/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export { onAuthStateChanged, signInAnonymously };
