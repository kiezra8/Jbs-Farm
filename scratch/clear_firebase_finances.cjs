// Script to clear legacy finances collection in Firebase Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBtBDImA3JxW6drta2qG8Kacx4lk7yG85M",
  authDomain: "erands-guy.firebaseapp.com",
  projectId: "erands-guy",
  storageBucket: "erands-guy.firebasestorage.app",
  messagingSenderId: "184159634431",
  appId: "1:184159634431:web:a5a2f328444104562a1dca",
  measurementId: "G-29GWN7E6C6"
};

async function main() {
  console.log('--- Cleaning Firebase Firestore finances Collection ---\n');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const financesRef = collection(db, 'finances');
  const snapshot = await getDocs(financesRef);

  console.log(`Found ${snapshot.docs.length} documents in Firebase finances collection.`);

  let deletedCount = 0;
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, 'finances', document.id));
    deletedCount++;
  }

  console.log(`\n✅ Successfully deleted ${deletedCount} documents from Firebase finances collection.`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error cleaning Firebase:', err);
  process.exit(1);
});
