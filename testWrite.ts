import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    await setDoc(doc(db, 'test_sync', 'test_doc'), { timestamp: Date.now() });
    console.log("Write successful");
    process.exit(0);
  } catch (e: any) {
    console.log("Write failed:", e.message);
    process.exit(1);
  }
}

run();
