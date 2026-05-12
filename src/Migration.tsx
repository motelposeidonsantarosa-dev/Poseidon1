import { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db as oldDb } from './firebase';
import { useAuth } from './contexts/AuthContext';

const newConfig = {
  "apiKey": "AIzaSyAE4Kkcs8uEjYw0ofNHTvpHkBFYaBehcpQ",
  "authDomain": "gen-lang-client-0071023735.firebaseapp.com",
  "projectId": "gen-lang-client-0071023735",
  "storageBucket": "gen-lang-client-0071023735.firebasestorage.app",
  "messagingSenderId": "845752910836",
  "appId": "1:845752910836:web:d79ef0cd408748f9cdafa1"
};

const newApp = initializeApp(newConfig, 'newApp');
const newDb = getFirestore(newApp);

const COLLECTIONS = [
  'rooms', 'products', 'app_users', 'reservations', 'promos', 
  'financial_reports', 'tickets', 'expenses', 'incidents', 'settings', 'shifts', 'notifications'
];

export function Migration() {
  const [log, setLog] = useState<string[]>([]);
  const [migrating, setMigrating] = useState(false);
  const { appUser } = useAuth();

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleMigrate = async () => {
    if (appUser?.role !== 'admin') {
      addLog('ERROR: You must be logged in as an Administrator to run the migration.');
      return;
    }

    setMigrating(true);
    addLog('Starting migration...');
    addLog(`Copying data to your Firebase project: ${newConfig.projectId}`);
    
    try {
      for (const col of COLLECTIONS) {
        addLog(`Reading from old database it AI Studio: ${col}...`);
        try {
          const snapshot = await getDocs(collection(oldDb, col));
          const docs = snapshot.docs;
          addLog(`Found ${docs.length} documents in ${col}. Copying...`);
          
          let successCount = 0;
          for (const d of docs) {
            try {
              await setDoc(doc(newDb, col, d.id), d.data());
              successCount++;
            } catch(err: any) {
              addLog(`Error writing ${col}/${d.id}: ${err.message}`);
            }
          }
          addLog(`Copied ${successCount}/${docs.length} documents for ${col}.`);
        } catch (err: any) {
          addLog(`Could not read ${col} (maybe empty or permission issue): ${err.message}`);
        }
      }
      addLog('ALL DONE SUCCESS! Migration complete.');
      addLog('Now we can switch the app to use your new database permanently.');
    } catch (err: any) {
      addLog(`FATAL ERROR: ${err.message}`);
    }
    setMigrating(false);
  };

  return (
    <div className="p-4 sm:p-10 max-w-2xl mx-auto mt-10 sm:mt-20 bg-white rounded-2xl shadow-xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-5">Migración de Base de Datos</h1>
      <p className="mb-5 text-gray-600">
        Esta herramienta copiará toda tu información desde AI Studio hacia tu propia base de datos (<strong>{newConfig.projectId}</strong>).
      </p>
      
      {!appUser || appUser.role !== 'admin' ? (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg mb-4">
          <strong>Atención:</strong> Debes iniciar sesión con una cuenta de <strong>Administrador</strong> en la app antes de usar esta página. Vuelve a la página principal, inicia sesión y luego vuelve a cargar esta URL agregando #migrate al final.
        </div>
      ) : (
        <button 
          onClick={handleMigrate}
          disabled={migrating}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:opacity-50 w-full sm:w-auto"
        >
          {migrating ? 'Migrando (Puede tomar unos minutos)...' : 'Iniciar Copiado de Datos'}
        </button>
      )}

      <div className="mt-8 bg-slate-900 text-green-400 p-5 rounded-lg font-mono text-xs sm:text-sm max-h-[400px] overflow-auto">
        {log.map((l, i) => <div key={i}>{l}</div>)}
        {!log.length && "Esperando para iniciar..."}
      </div>
    </div>
  );
}
