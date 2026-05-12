import { db } from "./src/firebase.ts";
import { getDoc, doc } from "firebase/firestore";

console.log("DB initialized", db);
process.exit(0);
