// Kullanıcı ve sunucu ayarları
document.addEventListener('DOMContentLoaded', function() {
    const userSettingsBtn = document.getElementById('user-settings-btn');
    const userSettingsModal = document.getElementById('user-settings-modal');
    const settingsItems = document.querySelectorAll('.settings-item');
    const settingsTabs = document.querySelectorAll('.settings-tab');
    
    let currentUser = null;

    // Kullanıcı değişikliğini dinle
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadUserSettings();
        }
    });

    // Kullanıcı ayarlarını yükle
    async function loadUserSettings() {
        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                populateSettingsForm(userData);
            }
        } catch (error) {
            console.error('Kullanıcı ayarları yüklenirken hata:', error);
        }
    }

    // Ayarlar formunu doldur
    function populateSettingsForm(userData) {
        document.getElementById('settings-username').value = userData.username || '';
        document.getElementById('settings-email').value = userData.email || '';
        document.getElementById('profile-bio').value = userData.bio || '';
        
        // Avatar preview
        const avatarPreview = document.querySelector('.avatar-preview');
        if (avatarPreview) {
            avatarPreview.style.backgroundColor = userData.avatarColor || '#5865F2';
            avatarPreview.textContent = (userData.username || '?').charAt(0).toUpperCase();
        }
    }

    // Kullanıcı adını güncelle
    async function updateUsername(newUsername) {
        try {
            await db.collection('users').doc(currentUser.uid).update({
                username: newUsername,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // UI'ı güncelle
            document.querySelector('.username').textContent = newUsername;
            document.querySelector('.avatar').textContent = newUsername.charAt(0).toUpperCase();
            
            alert('Kullanıcı adı başarıyla güncellendi!');
        } catch (error) {
            console.error('Kullanıcı adı güncellenirken hata:', error);
            alert('Kullanıcı adı güncellenemedi: ' + error.message);
        }
    }

    // Profil bio'sunu güncelle
    async function updateBio(newBio) {
        try {
            await db.collection('users').doc(currentUser.uid).update({
                bio: newBio,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            alert('Profil bilgisi başarıyla güncellendi!');
        } catch (error) {
            console.error('Profil bilgisi güncellenirken hata:', error);
            alert('Profil bilgisi güncellenemedi: ' + error.message);
        }
    }

    // Avatar rengini güncelle
    async function updateAvatarColor(newColor) {
        try {
            await db.collection('users').doc(currentUser.uid).update({
                avatarColor: newColor,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // UI'ı güncelle
            document.querySelectorAll('.avatar').forEach(avatar => {
                avatar.style.backgroundColor = newColor;
            });
            
            alert('Avatar rengi başarıyla güncellendi!');
        } catch (error) {
            console.error('Avatar rengi güncellenirken hata:', error);
            alert('Avatar rengi güncellenemedi: ' + error.message);
        }
    }

    // Settings tab'larını değiştir
    function switchSettingsTab(tabName) {
        settingsTabs.forEach(tab => {
            tab.classList.add('hidden');
        });
        
        settingsItems.forEach(item => {
            item.classList.remove('active');
        });
        
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    // Event Listeners
    userSettingsBtn.addEventListener('click', () => {
        userSettingsModal.classList.remove('hidden');
    });

    settingsItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.dataset.tab;
            switchSettingsTab(tabName);
        });
    });

    // Kullanıcı adı düzenleme
    document.querySelector('#settings-username').addEventListener('change', (e) => {
        if (e.target.value.trim()) {
            updateUsername(e.target.value.trim());
        }
    });

    // Bio düzenleme
    document.querySelector('#profile-bio').addEventListener('change', (e) => {
        updateBio(e.target.value);
    });

    // Avatar rengi seçici
    const colorOptions = ['#5865F2', '#ED4245', '#FEE75C', '#EB459E', '#57F287'];
    const avatarUpload = document.querySelector('.avatar-upload');
    
    if (avatarUpload) {
        const colorSelector = document.createElement('div');
        colorSelector.className = 'color-selector';
        colorSelector.innerHTML = `
            <h4>Avatar Rengi</h4>
            <div class="color-options">
                ${colorOptions.map(color => `
                    <div class="color-option" style="background-color: ${color}" data-color="${color}"></div>
                `).join('')}
            </div>
        `;
        
        avatarUpload.appendChild(colorSelector);
        
        // Renk seçimi
        colorSelector.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                const selectedColor = option.dataset.color;
                updateAvatarColor(selectedColor);
                
                // Preview'ı güncelle
                document.querySelector('.avatar-preview').style.backgroundColor = selectedColor;
            });
        });
    }

    // Modal kapatma
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            userSettingsModal.classList.add('hidden');
        });
    });

    // Dışarı tıklayınca kapat
    userSettingsModal.addEventListener('click', (e) => {
        if (e.target === userSettingsModal) {
            userSettingsModal.classList.add('hidden');
        }
    });
});
// servers.js'de openChannel fonksiyonunu güncelle
function openChannel(channel) {
    console.log('🔧 Kanal açılıyor:', channel);
    
    // Aktif kanalı güncelle
    document.querySelectorAll('.channel-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const currentChannelElement = document.querySelector(`[data-channel-id="${channel.id}"]`);
    if (currentChannelElement) {
        currentChannelElement.classList.add('active');
    }

    // Kanal adını güncelle
    document.getElementById('current-channel-name').textContent = channel.name;

    if (channel.type === 'text') {
        // Mesaj kanalı
        window.dispatchEvent(new CustomEvent('channelChanged', {
            detail: { 
                channelId: channel.id,
                serverId: currentServer.id,
                channelName: channel.name
            }
        }));
    } else {
        // Ses kanalı - Sesli sohbete bağlan
        connectToVoiceChannel(channel.name, channel.id);
    }
}

// Ses kanalına bağlan
async function connectToVoiceChannel(channelName, channelId) {
    // Ses sistemini başlat
    const voiceChat = initializeVoiceChat();
    
    // Önceki bağlantı varsa kapat
    if (voiceChat.isConnected) {
        await voiceChat.disconnectFromVoiceChannel();
    }
    
    // Yeni ses kanalına bağlan
    await voiceChat.connectToVoiceChannel(channelName, channelId);
}
// Gelişmiş kullanıcı ayarları
document.addEventListener('DOMContentLoaded', function() {
    const userSettingsModal = document.getElementById('user-settings-modal');
    const settingsItems = document.querySelectorAll('.settings-item');
    const settingsTabs = document.querySelectorAll('.settings-tab');
    
    let currentUser = null;

    // Kullanıcı değişikliğini dinle
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadUserSettings(user);
        }
    });

    // Kullanıcı ayarlarını yükle
    async function loadUserSettings(user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                populateSettingsForm(userData);
            }
        } catch (error) {
            console.error('Kullanıcı ayarları yüklenirken hata:', error);
        }
    }

    // Ayarlar formunu doldur
    function populateSettingsForm(userData) {
        // Hesap sekmesi
        document.getElementById('settings-username').value = userData.username || '';
        document.getElementById('settings-email').value = userData.email || '';
        
        // Profil sekmesi
        document.getElementById('profile-bio').value = userData.bio || '';
        
        // Avatar preview
        const avatarPreview = document.querySelector('.avatar-preview');
        if (avatarPreview) {
            avatarPreview.style.backgroundColor = userData.avatarColor || '#5865F2';
            avatarPreview.textContent = (userData.username || '?').charAt(0).toUpperCase();
        }

        // Gizlilik sekmesi
        if (userData.privacy) {
            document.getElementById('status-visibility').value = userData.privacy.statusVisibility || 'everyone';
            document.getElementById('dm-permission').value = userData.privacy.dmPermission || 'everyone';
        }
    }

    // Avatar yükleme
    function setupAvatarUpload() {
        const avatarUpload = document.querySelector('.avatar-upload');
        const avatarPreview = document.querySelector('.avatar-preview');
        
        if (!avatarUpload || !avatarPreview) return;

        // Dosya seçici butonu
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        const uploadBtn = avatarUpload.querySelector('button');
        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert('Dosya boyutu 5MB\'dan küçük olmalıdır.');
                return;
            }

            try {
                // Base64'e çevir (gerçek uygulamada Firebase Storage kullanın)
                const reader = new FileReader();
                reader.onload = async (event) => {
                    // Avatarı güncelle
                    await updateUserAvatar(event.target.result);
                    
                    // Preview'ı güncelle
                    avatarPreview.style.backgroundImage = `url(${event.target.result})`;
                    avatarPreview.style.backgroundSize = 'cover';
                    avatarPreview.textContent = '';
                    
                    alert('✅ Profil fotoğrafı güncellendi!');
                };
                reader.readAsDataURL(file);
                
            } catch (error) {
                console.error('Avatar yükleme hatası:', error);
                alert('❌ Avatar yüklenemedi: ' + error.message);
            }
        });
    }

    // Kullanıcı avatarını güncelle
    async function updateUserAvatar(avatarData) {
        if (!currentUser) return;

        try {
            await db.collection('users').doc(currentUser.uid).update({
                avatar: avatarData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Avatar güncelleme hatası:', error);
            throw error;
        }
    }

    // Durum ayarlarını güncelle
    async function updateStatusSettings() {
        if (!currentUser) return;

        try {
            const statusVisibility = document.getElementById('status-visibility').value;
            const dmPermission = document.getElementById('dm-permission').value;

            await db.collection('users').doc(currentUser.uid).update({
                privacy: {
                    statusVisibility: statusVisibility,
                    dmPermission: dmPermission
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('✅ Gizlilik ayarları güncellendi');
        } catch (error) {
            console.error('❌ Gizlilik ayarları güncellenemedi:', error);
        }
    }

    // Settings tab'larını değiştir
    function switchSettingsTab(tabName) {
        settingsTabs.forEach(tab => {
            tab.classList.add('hidden');
        });
        
        settingsItems.forEach(item => {
            item.classList.remove('active');
        });
        
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    // Event Listeners
    settingsItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.dataset.tab;
            switchSettingsTab(tabName);
        });
    });

    // Kullanıcı adı düzenleme
    document.querySelector('#settings-username').addEventListener('change', (e) => {
        if (e.target.value.trim()) {
            updateUsername(e.target.value.trim());
        }
    });

    // Bio düzenleme
    document.querySelector('#profile-bio').addEventListener('change', (e) => {
        updateBio(e.target.value);
    });

    // Gizlilik ayarları
    document.querySelector('#status-visibility').addEventListener('change', updateStatusSettings);
    document.querySelector('#dm-permission').addEventListener('change', updateStatusSettings);

    // Avatar yükleme sistemini başlat
    setupAvatarUpload();

    // Kullanıcı adını güncelle
    async function updateUsername(newUsername) {
        try {
            await db.collection('users').doc(currentUser.uid).update({
                username: newUsername,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // UI'ı güncelle
            document.getElementById('profile-username').textContent = newUsername;
            document.querySelector('.avatar').textContent = newUsername.charAt(0).toUpperCase();
            
            alert('✅ Kullanıcı adı başarıyla güncellendi!');
            
        } catch (error) {
            console.error('Kullanıcı adı güncellenirken hata:', error);
            alert('❌ Kullanıcı adı güncellenemedi: ' + error.message);
        }
    }

    // Bio güncelle
    async function updateBio(newBio) {
        try {
            await db.collection('users').doc(currentUser.uid).update({
                bio: newBio,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            alert('✅ Profil bilgisi başarıyla güncellendi!');
        } catch (error) {
            console.error('Bio güncellenirken hata:', error);
            alert('❌ Profil bilgisi güncellenemedi: ' + error.message);
        }
    }
});