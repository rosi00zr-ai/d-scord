document.addEventListener('DOMContentLoaded', function() {
    const authModal = document.getElementById('auth-modal');
    const app = document.getElementById('app');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const loginFooter = document.getElementById('login-footer');
    const registerFooter = document.getElementById('register-footer');
    
    // Form görünümlerini değiştirme
    showRegister.addEventListener('click', function(e) {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        loginFooter.classList.add('hidden');
        registerFooter.classList.remove('hidden');
    });
    
    showLogin.addEventListener('click', function(e) {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        registerFooter.classList.add('hidden');
        loginFooter.classList.remove('hidden');
    });
    
    // Oturum kontrolü - her zaman login modalını göster
    function checkAuthState() {
        authModal.classList.remove('hidden');
        app.classList.add('hidden');
        
        // Formları sıfırla
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        loginFooter.classList.remove('hidden');
        registerFooter.classList.add('hidden');
        
        // Form alanlarını temizle
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('register-username').value = '';
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
        
        // Mevcut oturumu sonlandır
        auth.signOut().then(() => {
            console.log('Oturum sonlandırıldı');
        }).catch(error => {
            console.log('Oturum sonlandırma hatası:', error);
        });
    }
    
    // Sayfa yüklendiğinde kontrol et
    checkAuthState();
    
    // Giriş formu işleme
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            alert('Lütfen e-posta ve şifre girin');
            return;
        }
        
        auth.signInWithEmailAndPassword(email, password)
            .then(userCredential => {
                // Giriş başarılı
                console.log('Giriş başarılı:', userCredential.user);
                
                // Firestore'da kullanıcı kaydı var mı kontrol et
                return checkAndCreateUserRecord(userCredential.user);
            })
            .then(() => {
                authModal.classList.add('hidden');
                app.classList.remove('hidden');
                loadUserData(auth.currentUser);
            })
            .catch(error => {
                alert('Giriş hatası: ' + error.message);
            });
    });
    
    // Kayıt formu işleme
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        if (!username || !email || !password) {
            alert('Lütfen tüm alanları doldurun');
            return;
        }
        
        if (password.length < 6) {
            alert('Şifre en az 6 karakter olmalıdır');
            return;
        }
        
        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                // Kullanıcı oluşturuldu
                console.log('Kullanıcı oluşturuldu:', userCredential.user);
                
                // Kullanıcı verilerini Firestore'a kaydet
                return createUserInFirestore(userCredential.user, username, email);
            })
            .then(() => {
                alert('Kayıt başarılı! Hoş geldiniz.');
                authModal.classList.add('hidden');
                app.classList.remove('hidden');
                loadUserData(auth.currentUser);
            })
            .catch(error => {
                console.error('Kayıt hatası:', error);
                
                // Eğer email zaten kullanılıyorsa, giriş yapmayı dene
                if (error.code === 'auth/email-already-in-use') {
                    handleExistingAccount(email, password, username);
                } else {
                    alert('Kayıt hatası: ' + error.message);
                }
            });
    });
    
    // Firestore'da kullanıcı kaydı var mı kontrol et, yoksa oluştur
    async function checkAndCreateUserRecord(user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                // Firestore'da kayıt yok, oluştur
                console.log('Firestore kaydı oluşturuluyor...');
                await createUserInFirestore(user, user.email.split('@')[0], user.email);
            }
            
            // Durumu online yap
            await db.collection('users').doc(user.uid).update({
                status: 'online',
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
            
        } catch (error) {
            console.error('Kullanıcı kaydı kontrolü hatası:', error);
            // Hata olsa bile devam et
        }
    }
    
    // Firestore'da kullanıcı oluştur
    async function createUserInFirestore(user, username, email) {
        const userData = {
            email: email,
            username: username,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            avatarColor: getRandomColor(),
            displayName: username,
            status: 'online'
        };
        
        await db.collection('users').doc(user.uid).set(userData);
        console.log('Firestore kullanıcı kaydı oluşturuldu:', user.uid);
    }
    
    // Mevcut hesabı yönet (email zaten kullanılıyorsa)
    async function handleExistingAccount(email, password, username) {
        try {
            // Giriş yapmayı dene
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Firestore'da kullanıcı var mı kontrol et
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                // Firestore'da kayıt yoksa oluştur
                await createUserInFirestore(user, username, email);
                alert('Mevcut hesabınız tamamlandı! Firestore kaydı oluşturuldu.');
            } else {
                alert('Bu email ile zaten kayıtlı bir hesap var. Giriş yapıldı.');
            }
            
            authModal.classList.add('hidden');
            app.classList.remove('hidden');
            loadUserData(user);
            
        } catch (error) {
            console.error('Mevcut hesap yönetimi hatası:', error);
            alert('Hata: ' + error.message);
        }
    }
    
    // Rastgele avatar rengi oluştur
    function getRandomColor() {
        const colors = ['#5865F2', '#ED4245', '#FEE75C', '#EB459E', '#57F287'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // Kullanıcı verilerini yükle - GÜNCELLENDİ (Tüm ID'ler için)
    function loadUserData(user) {
        console.log('Kullanıcı verileri yükleniyor:', user.uid);
        
        // Tüm profil elementlerini seç (tüm ID'leri kapsayacak şekilde)
        const usernameElements = document.querySelectorAll('[id*="username"]');
        const useridElements = document.querySelectorAll('[id*="userid"]');
        const avatarElements = document.querySelectorAll('.avatar');
        const statusElements = document.querySelectorAll('.status-indicator');
        
        // Kullanıcı bilgilerini Firestore'dan al
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    const username = userData.username || user.email.split('@')[0];
                    const avatarColor = userData.avatarColor || getRandomColor();
                    const status = userData.status || 'online';
                    const userTag = '#' + user.uid.substring(0, 4);
                    
                    console.log('Kullanıcı verileri alındı:', username, userTag);
                    
                    // Tüm görünümlerdeki profilleri güncelle
                    updateAllProfiles(usernameElements, useridElements, avatarElements, statusElements, username, userTag, avatarColor, status);
                    
                } else {
                    // Firestore'da kayıt yoksa oluştur
                    console.log('Firestore kaydı bulunamadı, oluşturuluyor...');
                    createUserInFirestore(user, user.email.split('@')[0], user.email)
                        .then(() => {
                            // Tekrar yükle
                            loadUserData(user);
                        })
                        .catch(error => {
                            console.error('Firestore kaydı oluşturulamadı:', error);
                            // Varsayılan değerlerle devam et
                            setDefaultProfileValues(usernameElements, useridElements, avatarElements, statusElements, user);
                        });
                }
            })
            .catch(error => {
                console.error('Kullanıcı verileri yüklenirken hata:', error);
                // Hata durumunda varsayılan değerler
                setDefaultProfileValues(usernameElements, useridElements, avatarElements, statusElements, user);
            });
    }
    
    // Varsayılan profil değerlerini ayarla
    function setDefaultProfileValues(usernameElements, useridElements, avatarElements, statusElements, user) {
        const username = user.email.split('@')[0];
        const avatarColor = getRandomColor();
        const userTag = '#' + user.uid.substring(0, 4);
        const status = 'online';
        
        updateAllProfiles(usernameElements, useridElements, avatarElements, statusElements, username, userTag, avatarColor, status);
    }
    
    // Tüm profil görünümlerini güncelle
    function updateAllProfiles(usernameElements, useridElements, avatarElements, statusElements, username, userTag, avatarColor, status) {
        console.log('Profiller güncelleniyor:', username, userTag);
        
        // Kullanıcı adlarını güncelle
        usernameElements.forEach(element => {
            element.textContent = username;
            console.log('Kullanıcı adı güncellendi:', element.id, username);
        });
        
        // Kullanıcı ID'lerini güncelle
        useridElements.forEach(element => {
            element.textContent = userTag;
            console.log('Kullanıcı ID güncellendi:', element.id, userTag);
        });
        
        // Avatar'ları güncelle
        avatarElements.forEach(avatar => {
            avatar.style.backgroundColor = avatarColor;
            avatar.textContent = username.charAt(0).toUpperCase();
            // Avatar rengini dataset'te sakla (profil modalı için)
            avatar.dataset.avatarColor = avatarColor;
        });
        
        // Durum göstergelerini güncelle
        statusElements.forEach(statusElement => {
            statusElement.className = 'status-indicator ' + status;
        });
        
        // DM avatarını da güncelle (eğer varsa)
        const dmAvatar = document.querySelector('.dm-avatar');
        if (dmAvatar) {
            dmAvatar.style.backgroundColor = avatarColor;
            dmAvatar.textContent = username.charAt(0).toUpperCase();
        }
        
        console.log('Tüm profiller başarıyla güncellendi');
    }
    
    // Çıkış butonu ekle
    function addLogoutButton() {
        // Tüm profil aksiyon bölümlerini bul
        const profileActions = document.querySelectorAll('.profile-actions');
        
        profileActions.forEach(actions => {
            // Önceki çıkış butonunu temizle
            const existingLogout = actions.querySelector('.fa-sign-out-alt');
            if (existingLogout) {
                existingLogout.remove();
            }
            
            // Yeni çıkış butonu ekle
            const logoutBtn = document.createElement('i');
            logoutBtn.className = 'fas fa-sign-out-alt';
            logoutBtn.title = 'Çıkış Yap';
            logoutBtn.addEventListener('click', function() {
                if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                    // Çıkış yapmadan önce durumu güncelle
                    const user = auth.currentUser;
                    if (user) {
                        db.collection('users').doc(user.uid).update({
                            status: 'offline',
                            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                        }).catch(error => {
                            console.error('Çıkış durumu güncellenemedi:', error);
                        });
                    }
                    
                    auth.signOut().then(() => {
                        checkAuthState();
                    }).catch(error => {
                        console.error('Çıkış hatası:', error);
                    });
                }
            });
            actions.appendChild(logoutBtn);
        });
    }
    
    // Kullanıcı giriş yaptığında çıkış butonunu ekle
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log('Kullanıcı giriş yaptı:', user.uid);
            addLogoutButton();
            loadUserData(user);
        }
    });
});
auth.onAuthStateChanged(async user => {
    if (user) {
        console.log("✅ Kullanıcı giriş yaptı:", user.email);
        setOnlineStatus(true);

        // Sayfa kapanınca otomatik offline yap
        window.addEventListener('beforeunload', () => {
            setOnlineStatus(false);
        });

        // Bağlantı kesilince (örneğin internet gitti)
        window.addEventListener('offline', () => {
            setOnlineStatus(false);
        });

        // Yeniden bağlanınca tekrar online yap
        window.addEventListener('online', () => {
            setOnlineStatus(true);
        });

    } else {
        setOnlineStatus(false);
    }
});
async function setOnlineStatus(isOnline) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await db.collection('users').doc(user.uid).update({
            status: isOnline ? 'online' : 'offline',
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`🌐 Kullanıcı durumu: ${isOnline ? 'online' : 'offline'}`);
    } catch (err) {
        console.warn('Durum güncellenemedi:', err);
    }
}
setInterval(() => {
    if (auth.currentUser && navigator.onLine) {
        setOnlineStatus(true);
    }
}, 10000); // 10 saniyede bir online ping
