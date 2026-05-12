import { db } from "./src/firebase.ts";
import { collection, onSnapshot } from "firebase/firestore";
console.log("Adding listener...");
onSnapshot(collection(db, "app_users"), () => console.log("snapshot!"));
