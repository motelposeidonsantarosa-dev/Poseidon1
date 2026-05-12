import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function exportData() {
  const collections = ['rooms', 'products', 'app_users', 'reservations', 'promos', 'financial_reports', 'tickets', 'expenses', 'novedades'];
  const dbData: Record<string, any[]> = {};
  
  for (const col of collections) {
    try {
      const snap = await getDocs(collection(db, col));
      dbData[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`Exported ${dbData[col].length} documents from ${col}`);
    } catch(err: any) {
      console.log(`Could not read ${col}: ${err.message}`);
    }
  }
  
  fs.writeFileSync('./db_export.json', JSON.stringify(dbData, null, 2));
  console.log('Data successfully exported to db_export.json');
}

exportData().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
