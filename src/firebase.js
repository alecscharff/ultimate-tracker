import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD0AJHSCKV9o7Whn-DxugO4Xqr-H9D8SFs",
  authDomain: "marmots-tracker.firebaseapp.com",
  projectId: "marmots-tracker",
  storageBucket: "marmots-tracker.firebasestorage.app",
  messagingSenderId: "306338000334",
  appId: "1:306338000334:web:0cdad95f0c53193353cf9f",
  measurementId: "G-L9WX2VHG18"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Offline-first: Firestore caches data locally so the app works without internet
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});

