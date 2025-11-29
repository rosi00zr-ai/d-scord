// Profil yönetimi - SOL ALT KÖŞEYE SABİTLENDİ
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 profile.js yüklendi');
    
    let profileModal = null;
    let currentUser = null;

    // Kullanıcı değişikliğini dinle
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            console.log('👤 Profil için kullanıcı ayarlandı:', user.uid);
            setupProfileEvents();
        }
    });

    // Profil event'lerini kur
    function setupProfileEvents() {
        console.log('🔧 Profil eventleri kuruluyor...');
        
        // Tüm profil bilgilerini seç
        const profileInfos = document.querySelectorAll('.profile-info');
        
        profileInfos.forEach(profileInfo => {
            profileInfo.addEventListener('click', showProfileModal);
            console.log('✅ Profil eventi eklendi:', profileInfo);
        });

        // Mikrofon butonu
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            micBtn.addEventListener('click', toggleMicrophone);
        }

        // Kulaklık butonu
        const headphoneBtn = document.getElementById('headphone-btn');
        if (headphoneBtn) {
            headphoneBtn.addEventListener('click', toggleHeadphones);
        }

        // Ayarlar butonu
        const userSettingsBtn = document.getElementById('user-settings-btn');
        if (userSettingsBtn) {
            userSettingsBtn.addEventListener('click', openUserSettings);
        }
    }

    // Profil modalını göster - POZİSYON DÜZELTİLDİ
    function showProfileModal() {
        console.log('👤 Profil modalı gösteriliyor...');
        
        // Önceki modalı temizle
        if (profileModal) {
            profileModal.remove();
        }

        createProfileModal();
    }

    // Profil modalı oluştur - POZİSYON DÜZELTİLDİ
    function createProfileModal() {
        const username = document.getElementById('profile-username').textContent;
        const userid = document.getElementById('profile-userid').textContent;
        const avatarColor = document.querySelector('.avatar').style.backgroundColor || '#5865F2';
        
        profileModal = document.createElement('div');
        profileModal.className = 'profile-modal';
        profileModal.innerHTML = `
            <div class="profile-modal-header">
                <div class="profile-modal-avatar" style="background-color: ${avatarColor}">
                    ${username.charAt(0).toUpperCase()}
                </div>
                <div class="profile-modal-userinfo">
                    <div class="profile-modal-username">${username}</div>
                    <div class="profile-modal-userid">${userid}</div>
                </div>
            </div>
            <div class="profile-modal-body">
                <div class="profile-section">
                    <div class="profile-section-title">DURUM</div>
                    <div class="profile-status">
                        <div class="status-option active" data-status="online">
                            <div class="status-color" style="background-color: var(--online-color)"></div>
                            <span>Çevrimiçi</span>
                        </div>
                        <div class="status-option" data-status="idle">
                            <div class="status-color" style="background-color: var(--idle-color)"></div>
                            <span>Rahatsız Etmeyin</span>
                        </div>
                        <div class="status-option" data-status="dnd">
                            <div class="status-color" style="background-color: var(--dnd-color)"></div>
                            <span>Meşgul</span>
                        </div>
                    </div>
                </div>
                
                <div class="profile-section">
                    <div class="profile-section-title">PROFİL</div>
                    <div class="profile-actions-list">
                        <div class="profile-action-item" data-action="settings">
                            <i class="fas fa-cog"></i>
                            <span>Kullanıcı Ayarları</span>
                        </div>
                        <div class="profile-action-item" data-action="profile">
                            <i class="fas fa-user-edit"></i>
                            <span>Profili Düzenle</span>
                        </div>
                        <div class="profile-action-item" data-action="logout">
                            <i class="fas fa-sign-out-alt"></i>
                            <span>Çıkış Yap</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Modalı ekle - HER ZAMAN FRIENDS SIDEBAR'A EKLE
        const friendsSidebar = document.querySelector('.friends-sidebar');
        if (friendsSidebar) {
            friendsSidebar.appendChild(profileModal);
        } else {
            // Fallback: body'ye ekle
            document.body.appendChild(profileModal);
        }

        // Event listeners
        setupProfileModalEvents();
        
        // Dışarı tıklayınca kapat
        setTimeout(() => {
            document.addEventListener('click', closeProfileModalOnClickOutside);
        }, 100);
    }

    // Profil modal event'leri
    function setupProfileModalEvents() {
        // Durum değiştirme
        profileModal.querySelectorAll('.status-option').forEach(option => {
            option.addEventListener('click', function() {
                const status = this.dataset.status;
                updateUserStatus(status);
            });
        });

        // Profil aksiyonları
        profileModal.querySelectorAll('.profile-action-item').forEach(item => {
            item.addEventListener('click', function() {
                const action = this.dataset.action;
                handleProfileAction(action);
            });
        });
    }

    // Kullanıcı durumunu güncelle
    async function updateUserStatus(status) {
        if (!currentUser) return;
        
        try {
            await db.collection('users').doc(currentUser.uid).update({
                status: status,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });

            // UI'ı güncelle
            document.getElementById('user-status').className = 'status-indicator ' + status;
            
            // Modal'daki aktif durumu güncelle
            profileModal.querySelectorAll('.status-option').forEach(option => {
                option.classList.remove('active');
            });
            profileModal.querySelector(`[data-status="${status}"]`).classList.add('active');
            
            console.log('✅ Durum güncellendi:', status);
            
        } catch (error) {
            console.error('❌ Durum güncellenemedi:', error);
        }
    }

    // Profil aksiyonlarını yönet
    function handleProfileAction(action) {
        switch (action) {
            case 'settings':
                document.getElementById('user-settings-modal').classList.remove('hidden');
                closeProfileModal();
                break;
            case 'profile':
                const newUsername = prompt('Yeni kullanıcı adınızı girin:');
                if (newUsername && newUsername.trim()) {
                    updateUsername(newUsername.trim());
                }
                closeProfileModal();
                break;
            case 'logout':
                if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                    auth.signOut();
                    closeProfileModal();
                }
                break;
        }
    }

    // Kullanıcı adını güncelle
    async function updateUsername(newUsername) {
        if (!currentUser) return;
        
        try {
            await db.collection('users').doc(currentUser.uid).update({
                username: newUsername,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // UI'ı güncelle
            document.getElementById('profile-username').textContent = newUsername;
            document.querySelector('.avatar').textContent = newUsername.charAt(0).toUpperCase();
            
            console.log('✅ Kullanıcı adı güncellendi:', newUsername);
            
        } catch (error) {
            console.error('❌ Kullanıcı adı güncellenemedi:', error);
            alert('Kullanıcı adı güncellenemedi: ' + error.message);
        }
    }

    // Mikrofonu aç/kapa
    function toggleMicrophone() {
        this.classList.toggle('muted');
        if (this.classList.contains('muted')) {
            this.style.color = 'var(--dnd-color)';
            console.log('🔇 Mikrofon kapatıldı');
        } else {
            this.style.color = '';
            console.log('🎤 Mikrofon açıldı');
        }
    }

    // Kulaklığı aç/kapa
    function toggleHeadphones() {
        this.classList.toggle('muted');
        if (this.classList.contains('muted')) {
            this.style.color = 'var(--dnd-color)';
            console.log('🔇 Ses kapatıldı');
        } else {
            this.style.color = '';
            console.log('🔊 Ses açıldı');
        }
    }

    // Kullanıcı ayarlarını aç
    function openUserSettings() {
        document.getElementById('user-settings-modal').classList.remove('hidden');
    }

    // Profil modalını kapat
    function closeProfileModal() {
        if (profileModal) {
            profileModal.remove();
            profileModal = null;
        }
        document.removeEventListener('click', closeProfileModalOnClickOutside);
    }

    // Dışarı tıklayınca kapat - POZİSYON DÜZELTİLDİ
    function closeProfileModalOnClickOutside(event) {
        if (profileModal && !profileModal.contains(event.target)) {
            const profileInfos = document.querySelectorAll('.profile-info');
            let isProfileInfo = false;
            
            profileInfos.forEach(info => {
                if (info.contains(event.target)) {
                    isProfileInfo = true;
                }
            });
            
            if (!isProfileInfo) {
                closeProfileModal();
            }
        }
    }
});