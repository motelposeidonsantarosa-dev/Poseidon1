import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, CACHE_SIZE_UNLIMITED, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Suppress harmless 'update time in the future' warnings from Firestore
setLogLevel('error');

// Global error handler to catch corrupted Firestore cache (e.g., Unexpected state ID: b815)
window.addEventListener('unhandledrejection', async (event) => {
  const errText = event.reason ? event.reason.toString() : '';
  if (errText.includes('Unexpected state') || errText.includes('b815') || errText.includes('IndexedDbTargetCache')) {
    console.error("Corrupted Firestore Cache Detected! Wiping and reloading...");
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name && db.name.includes('firestore')) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch (e) {
      console.error(e);
    }
    // Force reload
    window.location.reload();
  }
});

const app = initializeApp(firebaseConfig);

// Inicializar Firestore con cache ilimitada
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
  })
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

