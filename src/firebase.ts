import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Suppress harmless 'update time in the future' warnings from Firestore
setLogLevel('error');

const app = initializeApp(firebaseConfig);

// Inicializar Firestore sin persistencia offline forzada (evita desincronización entre dispositivos)
export const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

