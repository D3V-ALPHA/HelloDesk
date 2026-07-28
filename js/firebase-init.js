// Initializes the Firebase app, Auth, and Realtime Database instances
// using the locally vendored SDK — MV3's default CSP blocks remote
// script/module loading, so these files are self-hosted rather than
// pulled from the gstatic CDN at runtime.
import { initializeApp } from "../lib/firebase/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "../lib/firebase/firebase-auth.js";
import { getDatabase, forceWebSockets } from "../lib/firebase/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

// The Realtime Database client's long-polling fallback transport works by
// injecting <script src="https://...firebasedatabase.app/.lp?..."> tags,
// which is live remote script loading — always blocked by MV3's default
// "script-src 'self'" CSP, extension-wide, no matter how the SDK itself is
// vendored. Forcing WebSockets-only avoids the SDK ever attempting that
// fallback (WebSocket connections are governed by connect-src, which
// MV3's default CSP does not restrict).
forceWebSockets();

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export { onAuthStateChanged, signInAnonymously };
