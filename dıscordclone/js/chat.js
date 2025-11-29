document.addEventListener('DOMContentLoaded', function() {
    const serverMessageInput = document.getElementById('server-message-input');
    const serverMessagesContainer = document.getElementById('server-messages-container');
    let currentChannel = null;
    let messagesListener = null;

    // Kanal değişikliğini dinle
    window.addEventListener('channelChanged', function(e) {
        console.log('🔧 Kanal değişti:', e.detail);
        currentChannel = e.detail;
        
        // Önceki listener'ı temizle
        if (messagesListener) {
            messagesListener();
        }
        
        showTestModeMessage();
        loadMessagesWithoutIndex();
    });

    // Test modu mesajını göster
    function showTestModeMessage() {
        serverMessagesContainer.innerHTML = `
            <div class="empty-channel">
                <h3>🔥 Test Modu - Mesajlar Aktif!</h3>
                <p>Aşağıya mesaj yazıp Enter'a basın</p>
                <p>📨 Mesajlar Firestore'a kaydediliyor</p>
                <p>🔄 Sayfayı yenileyince mesajlar görünecek</p>
                <p>⚡ Index gerektirmeyen sistem aktif</p>
            </div>
        `;
    }

    // Index gerektirmeyen mesaj yükleme
    function loadMessagesWithoutIndex() {
        if (!currentChannel) return;
        
        console.log('📨 Index gerektirmeyen mesaj yükleme başlatıldı');
        
        // Tüm mesajları al ve istemci tarafında filtrele
        messagesListener = db.collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                const channelMessages = [];
                
                snapshot.forEach(doc => {
                    const message = doc.data();
                    // İstemci tarafında filtrele
                    if (message.channelId === currentChannel.channelId && 
                        message.serverId === currentChannel.serverId) {
                        channelMessages.push(message);
                    }
                });

                if (channelMessages.length > 0) {
                    console.log('📨 Mesajlar bulundu:', channelMessages.length);
                    showRealMessages(channelMessages);
                }
            }, error => {
                console.log('ℹ️ Mesaj yükleme hatası:', error);
            });
    }

    // Gerçek mesajları göster
    function showRealMessages(messages) {
        serverMessagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            const messageElement = createMessageElement(message);
            serverMessagesContainer.appendChild(messageElement);
        });
        
        serverMessagesContainer.scrollTop = serverMessagesContainer.scrollHeight;
    }

    // Mesaj öğesi oluştur
    function createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';

        const timestamp = message.timestamp?.toDate();
        const timeString = timestamp ? formatTime(timestamp) : 'Şimdi';
        
        const colors = ['#5865F2', '#ED4245', '#FEE75C', '#EB459E', '#57F287'];
        const authorHash = message.author ? message.author.charCodeAt(0) : 0;
        const avatarColor = colors[authorHash % colors.length];
        const avatarLetter = message.author ? message.author.charAt(0).toUpperCase() : '?';

        messageDiv.innerHTML = `
            <div class="message-avatar" style="background-color: ${avatarColor}">
                ${avatarLetter}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${message.author || 'Anonim'}</span>
                    <span class="message-timestamp">${timeString}</span>
                </div>
                <div class="message-text">${message.content}</div>
            </div>
        `;

        return messageDiv;
    }

    // Zaman formatı
    function formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Şimdi';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} dakika önce`;
        if (diff < 86400000) return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString('tr-TR');
    }

    // Mesaj gönder
    serverMessageInput.addEventListener('keypress', async function(e) {
        if (e.key === 'Enter' && this.value.trim() !== '' && currentChannel) {
            const messageContent = this.value.trim();
            
            try {
                const user = auth.currentUser;
                if (!user) {
                    alert('Giriş yapmalısınız');
                    return;
                }

                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.data();
                const username = userData?.username || user.email.split('@')[0];

                // Mesajı kaydet (timestamp otomatik)
                await db.collection('messages').add({
                    channelId: currentChannel.channelId,
                    serverId: currentServer.id,
                    author: username,
                    content: messageContent,
                    userId: user.uid,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                console.log('✅ Mesaj gönderildi:', messageContent);
                this.value = '';
                
            } catch (error) {
                console.error('❌ Mesaj gönderme hatası:', error);
                alert('Mesaj gönderilemedi: ' + error.message);
            }
        }
    });

    // Sayfa kapatıldığında listener'ı temizle
    window.addEventListener('beforeunload', function() {
        if (messagesListener) {
            messagesListener();
        }
    });
});