// dm-chat.js - TAM ÇALIŞAN VERSİYON
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DM Chat yüklendi');
    
    const dmMessageInput = document.getElementById('dm-message-input');
    const dmMessagesContainer = document.getElementById('dm-messages-container');
    
    let currentDM = null;
    let dmMessagesListener = null;

    // DM sesli arama butonu kurucu
    function setupDMVoiceButton() {
        const dmPhoneBtn = document.querySelector('#dm-chat .chat-header .fa-phone');
        if (!dmPhoneBtn) return;
        dmPhoneBtn.onclick = async () => {
            try {
                const user = auth.currentUser;
                if (!user || !currentDM) { alert('Önce bir DM açın.'); return; }
                const dmVoiceId = 'dm_' + [user.uid, currentDM.friendId].sort().join('_');
                const dmVoiceName = `DM: ${currentDM.friendData?.username || 'Kullanıcı'}`;
                console.log('📞 DM sesli görüşme başlatılıyor:', dmVoiceName);
                await connectToVoiceChannel(dmVoiceName, dmVoiceId);
            } catch (err) { console.error('DM ses hatası:', err); alert('Ses bağlantısı kurulamadı: ' + err.message); }
        };
    }

    // DM aç
    window.openDM = function(friendId, friendData) {
        console.log('💬 DM açılıyor:', friendData);
        
        if (!friendId || !friendData) {
            console.error('❌ Geçersiz DM verisi');
            return;
        }
        
        currentDM = {
            friendId: friendId,
            friendData: friendData
        };

        // Görünümleri değiştir
        document.getElementById('friends-main').classList.add('hidden');
        document.getElementById('server-chat').classList.add('hidden');
        document.getElementById('dm-chat').classList.remove('hidden');
        document.getElementById('members-sidebar').classList.add('hidden');

        // DM bilgilerini güncelle
        const dmFriendName = document.getElementById('dm-friend-name');
        if (dmFriendName) dmFriendName.textContent = friendData.username;
        
        // Avatar'ı güncelle
        const dmAvatar = document.querySelector('.dm-avatar');
        if (dmAvatar) {
            dmAvatar.style.backgroundColor = friendData.avatarColor || '#5865F2';
            dmAvatar.textContent = friendData.username.charAt(0).toUpperCase();
        }

        // Mesajları yükle
        loadDMMessages(friendId);

        // Setup DM voice button
        setupDMVoiceButton();
    };

    // DM mesajlarını yükle
    function loadDMMessages(friendId) {
        // Önceki listener'ı temizle
        if (dmMessagesListener) {
            dmMessagesListener();
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.log('❌ Kullanıcı giriş yapmamış');
            return;
        }

        // DM ID'sini oluştur
        const dmId = [currentUser.uid, friendId].sort().join('_');
        
        console.log('📨 DM mesajları yükleniyor:', dmId);

        // Yükleme mesajı göster
        if (dmMessagesContainer) {
            dmMessagesContainer.innerHTML = `
                <div class="empty-channel">
                    <h3>💬 ${currentDM.friendData.username} ile Özel Mesajlar</h3>
                    <p>Mesajlaşmaya başlamak için aşağıya yazın</p>
                    <p>🔒 Bu konuşma sadece ikiniz arasında</p>
                </div>
            `;
        }

        // DM mesajlarını dinle
        dmMessagesListener = db.collection('dm_messages')
            .where('dmId', '==', dmId)
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                if (!snapshot.empty) {
                    console.log('💬 DM mesajları bulundu:', snapshot.size);
                    showDMMessages(snapshot);
                } else {
                    console.log('💬 Henüz mesaj yok');
                }
            }, error => {
                console.error('❌ DM mesaj hatası:', error);
            });
    }

    // DM mesajlarını göster
    function showDMMessages(snapshot) {
        if (!dmMessagesContainer) return;
        
        dmMessagesContainer.innerHTML = '';
        
        snapshot.forEach(doc => {
            const message = doc.data();
            const messageElement = createDMMessageElement(message);
            dmMessagesContainer.appendChild(messageElement);
        });
        
        // En alta kaydır
        dmMessagesContainer.scrollTop = dmMessagesContainer.scrollHeight;
    }

    // DM mesaj öğesi oluştur
    function createDMMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';

        const timestamp = message.timestamp?.toDate();
        const timeString = timestamp ? formatTime(timestamp) : 'Şimdi';
        
        const isCurrentUser = message.senderId === auth.currentUser.uid;
        const authorName = isCurrentUser ? 'Sen' : (currentDM?.friendData?.username || 'Kullanıcı');
        const avatarColor = isCurrentUser ? '#5865F2' : (currentDM?.friendData?.avatarColor || '#ED4245');

        messageDiv.innerHTML = `
            <div class="message-avatar" style="background-color: ${avatarColor}">
                ${authorName.charAt(0).toUpperCase()}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${authorName}</span>
                    <span class="message-timestamp">${timeString}</span>
                </div>
                <div class="message-text">${message.content || ''}</div>
            </div>
        `;

        return messageDiv;
    }

    // DM mesaj gönder
    if (dmMessageInput) {
        dmMessageInput.addEventListener('keypress', async function(e) {
            if (e.key === 'Enter' && this.value.trim() !== '' && currentDM) {
                const messageContent = this.value.trim();
                
                try {
                    const user = auth.currentUser;
                    if (!user) {
                        alert('Giriş yapmalısınız');
                        return;
                    }

                    // DM ID'sini oluştur
                    const dmId = [user.uid, currentDM.friendId].sort().join('_');

                    // Mesajı kaydet
                    await db.collection('dm_messages').add({
                        dmId: dmId,
                        senderId: user.uid,
                        receiverId: currentDM.friendId,
                        content: messageContent,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    console.log('✅ DM mesajı gönderildi:', messageContent);
                    this.value = '';
                    
                } catch (error) {
                    console.error('❌ DM mesaj hatası:', error);
                    alert('Mesaj gönderilemedi: ' + error.message);
                }
            }
        });
    }

    // Zaman formatı
    function formatTime(date) {
        try {
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return 'Şimdi';
            if (diff < 3600000) return `${Math.floor(diff / 60000)} dakika önce`;
            if (diff < 86400000) return date.toLocaleTimeString('tr-TR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            return date.toLocaleDateString('tr-TR');
        } catch (error) {
            return 'Şimdi';
        }
    }

    // Sayfa kapatıldığında listener'ı temizle
    window.addEventListener('beforeunload', function() {
        if (dmMessagesListener) {
            dmMessagesListener();
        }
    });
});