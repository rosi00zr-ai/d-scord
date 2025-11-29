// js/firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyCD08C4l8ykdwHj_nIX53WG-rD2ZBDKVd4",
  authDomain: "discord-1e1db.firebaseapp.com",
  projectId: "discord-1e1db",
  storageBucket: "discord-1e1db.firebasestorage.app",
  messagingSenderId: "145457066964",
  appId: "1:145457066964:web:45f43bb63f2ae180639c41",
  measurementId: "G-ZWXNX95BE3"
};

// Firebase'i başlat
firebase.initializeApp(firebaseConfig);

// Servisler
const auth = firebase.auth();
const db = firebase.firestore();
    
// js/friends.js

// Kullanıcı ekleme fonksiyonu
async function addFriend(friendUID) {
  const user = auth.currentUser;
  if (!user) return console.log("Giriş yapılmamış!");

  try {
    await db.collection("friends")
            .doc(user.uid)
            .collection("friendList")
            .doc(friendUID)
            .set({
              addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
    console.log("Arkadaş eklendi!");
  } catch (err) {
    console.error("Arkadaş eklenemedi:", err.message);
  }
}

// Arkadaş listesini çekme
async function getFriends() {
  const user = auth.currentUser;
  if (!user) return console.log("Giriş yapılmamış!");

  try {
    const snapshot = await db.collection("friends")
                             .doc(user.uid)
                             .collection("friendList")
                             .get();

    const friends = snapshot.docs.map(doc => doc.id);
    console.log("Arkadaşlar:", friends);
    return friends;
  } catch (err) {
    console.error("Arkadaşlar alınamadı:", err.message);
  }
}

// Örnek kullanım
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("Giriş yapan kullanıcı:", user.uid);
    
    // Arkadaş ekle (örnek UID)
    // addFriend("friendUID123");

    // Arkadaşları listele
    // getFriends();
  }
});
