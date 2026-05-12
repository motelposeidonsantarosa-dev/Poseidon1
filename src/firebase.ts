import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Suppress harmless 'update time in the future' warnings from Firestore
setLogLevel('error');

const app = initializeApp(firebaseConfig);

// Inicializar Firestore sin persistencia offline forzada para garantizar sincronización en tiempo real
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

