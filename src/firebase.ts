import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, enableMultiTabIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Inicializar Firestore con cache ilimitada
export const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
}, firebaseConfig.firestoreDatabaseId);

// Habilitar persistencia offline multi-pestaña
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Múltiples pestañas abiertas, pero el navegador no soporta multi-tab.
    console.warn('Persistencia offline activa en otra pestaña.');
  } else if (err.code === 'unimplemented') {
    // El navegador no soporta persistencia.
    console.warn('El navegador no soporta persistencia offline.');
  } else {
    console.error('Error al habilitar persistencia offline:', err);
  }
});

export const auth = getAuth(app);
