import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function resetPins() {
  console.log("Fetching users...");
  const usersSnap = await getDocs(collection(db, "app_users"));
  for (const userDoc of usersSnap.docs) {
    console.log(`Resetting PIN for ${userDoc.id}...`);
    await updateDoc(doc(db, "app_users", userDoc.id), { pin: '1234' });
  }
  console.log("Pins reset successfully!");
  process.exit(0);
}

resetPins().catch(console.error);
