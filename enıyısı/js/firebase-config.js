// js/firebase-config.js

// Firebase ayarlarını gir
const firebaseConfig = {
  apiKey: "AIzaSyAohGgIoPGA2_P5PP5ln8UutAXq7W1q710",
  authDomain: "d1scord-7c388.firebaseapp.com",
  projectId: "d1scord-7c388",
  storageBucket: "d1scord-7c388.appspot.com",
  messagingSenderId: "428114541135",
  appId: "1:428114541135:web:b1778ed66b815b91ecc83a",
  measurementId: "G-QWPMYDHLWF"
};

try {
    // Firebase'i başlat
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase başarıyla başlatıldı');
} catch (error) {
    console.error('❌ Firebase başlatma hatası:', error);
}

// ... firebase.initializeApp kısmı ...
const auth = firebase.auth();
const db = firebase.firestore();

// Firestore ayarları
db.settings({
  timestampsInSnapshots: true,
  merge: true,
});

// ---------- USER PRESENCE (ÇEVRİMİÇİ DURUM) ----------
let offlineHandlerSet = false;

firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    const userRef = firebase.firestore().collection("users").doc(user.uid);
    await userRef.update({
      status: "online",
      lastActive: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (!offlineHandlerSet) {
      window.addEventListener("beforeunload", async () => {
        try {
          await userRef.update({
            status: "offline",
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } catch (e) {
          console.warn("Offline güncelleme hatası:", e);
        }
      });
      offlineHandlerSet = true;
    }
  } else {
    console.log("Kullanıcı çıkış yaptı → offline");
  }
});
