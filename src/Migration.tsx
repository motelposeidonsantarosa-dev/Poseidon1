import { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const oldConfig = {
  "projectId": "ai-studio-applet-webapp-27764",
  "appId": "1:50501432183:web:194c96226d6d9913b6e772",
  "apiKey": "AIzaSyB4oHOXnYgshaZr183gWPha6EYMuuoZV6Q",
  "authDomain": "ai-studio-applet-webapp-27764.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-c1c5de98-51e3-47bf-a4cd-1ec44cb41ed6",
  "storageBucket": "ai-studio-applet-webapp-27764.firebasestorage.app",
  "messagingSenderId": "50501432183"
};

const newConfig = {
  "apiKey": "AIzaSyAE4Kkcs8uEjYw0ofNHTvpHkBFYaBehcpQ",
  "authDomain": "gen-lang-client-0071023735.firebaseapp.com",
  "projectId": "gen-lang-client-0071023735",
  "storageBucket": "gen-lang-client-0071023735.firebasestorage.app",
  "messagingSenderId": "845752910836",
  "appId": "1:845752910836:web:d79ef0cd408748f9cdafa1"
};

const oldApp = initializeApp(oldConfig, 'oldApp');
const newApp = initializeApp(newConfig, 'newApp');

const oldDb = getFirestore(oldApp, oldConfig.firestoreDatabaseId);
const newDb = getFirestore(newApp);

const COLLECTIONS = [
  'rooms', 'products', 'app_users', 'reservations', 'promos', 
  'financial_reports', 'tickets', 'expenses', 'novedades', 'settings', 'shifts'
];

export function Migration() {
  const [log, setLog] = useState<string[]>([]);
  const [migrating, setMigrating] = useState(false);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleMigrate = async () => {
    setMigrating(true);
    addLog('Starting migration...');
    
    try {
      for (const col of COLLECTIONS) {
        addLog(`Reading from old database: ${col}...`);
        const snapshot = await getDocs(collection(oldDb, col));
        const docs = snapshot.docs;
        addLog(`Found ${docs.length} documents in ${col}. Copying...`);
        
        for (const d of docs) {
          try {
            await setDoc(doc(newDb, col, d.id), d.data());
          } catch(err: any) {
            addLog(`Error copying ${col}/${d.id}: ${err.message}`);
          }
        }
        addLog(`Finished ${col}.`);
      }
      addLog('ALL DONE SUCCESS! You can now use your app normally.');
    } catch (err: any) {
      addLog(`FATAL ERROR: ${err.message}`);
    }
    setMigrating(false);
  };

  return (
    <div className="p-10 max-w-2xl mx-auto mt-20 bg-white rounded-2xl shadow-xl">
      <h1 className="text-3xl font-bold mb-5">Database Migration</h1>
      <p className="mb-5 text-gray-600">Copying data from AI Studio to your Firebase project: {newConfig.projectId}</p>
      
      <button 
        onClick={handleMigrate}
        disabled={migrating}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50"
      >
        {migrating ? 'Migrating...' : 'Start Migration'}
      </button>

      <div className="mt-8 bg-slate-900 text-green-400 p-5 rounded-lg font-mono text-sm max-h-[400px] overflow-auto">
        {log.map((l, i) => <div key={i}>{l}</div>)}
        {!log.length && "Click Start to begin..."}
      </div>
    </div>
  );
}
