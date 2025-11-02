// ✅ servers.js - Gerçek zamanlı online durum, davet kodu gizleme, logout fix
document.addEventListener('DOMContentLoaded', function() {
    const serversList = document.getElementById('servers-list');
    const addServerBtn = document.getElementById('add-server-btn');
    const createServerModal = document.getElementById('create-server-modal');
    const createServerConfirm = document.getElementById('create-server-confirm');
    const serverView = document.getElementById('server-view');
    const friendsView = document.getElementById('friends-view');
    const channelsList = document.getElementById('channels-list');

    let currentUser = null;
    let servers = [];
    let currentServer = null;
    let unsubscribeUsers = null;
    let unsubscribeMembers = null;

    // 🔒 Firebase oturumunu koru - EN ÜSTE TAŞINDI
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            console.log('✅ Oturum açık:', user.email);
            await loadServers();
            watchUserStatus(); // Gerçek zamanlı kullanıcı izleme
        } else {
            console.warn('⚠️ Oturum kapalı, yönlendiriliyor...');
            // Gerekirse login sayfasına yönlendir
        }
    });

    // Sunucuları yükle
    async function loadServers() {
        try {
            console.log('🔍 Sunucular yükleniyor...');
            const snapshot = await db.collection('servers')
                .where('members', 'array-contains', currentUser.uid)
                .get();

            servers = [];
            snapshot.forEach(doc => {
                servers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log('✅ Sunucular yüklendi:', servers.length);
            renderServers();
            
            // 🟢 Davet kodunu kontrol et
            updateInviteSectionVisibility();
        } catch (error) {
            console.error('❌ Sunucular yüklenirken hata:', error);
        }
    }

    // Sunucuları render et
    function renderServers() {
        if (!serversList) return;
        serversList.innerHTML = '';

        servers.forEach(server => {
            const serverElement = createServerElement(server);
            serversList.appendChild(serverElement);
        });
    }

    // Sunucu öğesi oluştur
    function createServerElement(server) {
        const serverDiv = document.createElement('div');
        serverDiv.className = 'server-icon';
        serverDiv.dataset.serverId = server.id;
        serverDiv.title = server.name;

        const serverLetter = server.name.charAt(0).toUpperCase();
        serverDiv.innerHTML = serverLetter;

        serverDiv.addEventListener('click', () => {
            openServer(server);
        });

        return serverDiv;
    }

    // Sunucu oluştur
    async function createServer(serverName, serverDescription = '') {
        try {
            console.log('🆕 Sunucu oluşturuluyor:', serverName);
            
            const serverRef = await db.collection('servers').add({
                name: serverName,
                description: serverDescription,
                ownerId: currentUser.uid,
                members: [currentUser.uid],
                channels: [
                    {
                        id: 'general',
                        name: 'genel',
                        type: 'text',
                        position: 0
                    },
                    {
                        id: 'voice-general',
                        name: 'Genel Ses',
                        type: 'voice',
                        position: 1
                    }
                ],
                roles: [
                    {
                        id: 'owner',
                        name: 'Sunucu Sahibi',
                        permissions: ['all'],
                        color: '#ff0000'
                    },
                    {
                        id: 'member',
                        name: 'Üye',
                        permissions: ['send_messages', 'connect_voice'],
                        color: '#5865F2'
                    }
                ],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Kullanıcıya owner rolünü ata
            await db.collection('server_members').add({
                serverId: serverRef.id,
                userId: currentUser.uid,
                roles: ['owner'],
                joinedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('✅ Sunucu oluşturuldu:', serverRef.id);
            loadServers();
            createServerModal.classList.add('hidden');
            
            // Yeni sunucuyu hemen aç
            const newServer = {
                id: serverRef.id,
                name: serverName,
                description: serverDescription,
                channels: [
                    {
                        id: 'general',
                        name: 'genel',
                        type: 'text',
                        position: 0
                    },
                    {
                        id: 'voice-general',
                        name: 'Genel Ses',
                        type: 'voice',
                        position: 1
                    }
                ]
            };
            
            openServer(newServer);
            
        } catch (error) {
            console.error('❌ Sunucu oluşturulurken hata:', error);
            alert('❌ Sunucu oluşturulamadı: ' + error.message);
        }
    }

    // Sunucuyu aç - GÜNCELLENDİ
    function openServer(server) {
        console.log('🔧 Sunucu açılıyor:', server);
        
        if (!server || !server.id) {
            console.error('❌ Geçersiz sunucu verisi:', server);
            return;
        }
        
        currentServer = server;
        window.currentServer = server; // Global yap
        
        // Görünümleri değiştir
        friendsView.classList.add('hidden');
        serverView.classList.remove('hidden');
        document.getElementById('friends-main').classList.add('hidden');
        document.getElementById('dm-chat').classList.add('hidden');
        document.getElementById('server-chat').classList.remove('hidden');
        document.getElementById('members-sidebar').classList.remove('hidden');

        // Sunucu bilgilerini güncelle
        document.getElementById('current-server-name').textContent = server.name;
        
        // Kanalları render et
        renderChannels(server.channels);
        
        // Üyeleri yükle
        loadServerMembers(server.id);
        
        // 🟢 Davet kodunu gizle
        updateInviteSectionVisibility();
        
        // İlk kanalı aç
        if (server.channels && server.channels.length > 0) {
            const firstTextChannel = server.channels.find(ch => ch.type === 'text');
            if (firstTextChannel) {
                setTimeout(() => {
                    openChannel(firstTextChannel);
                }, 100);
            }
        }
        
        console.log('✅ Sunucu açıldı:', server.name);
    }

    // Kanalları render et
    function renderChannels(channels) {
        if (!channelsList) return;
        channelsList.innerHTML = '';

        if (!channels || channels.length === 0) {
            channelsList.innerHTML = '<div class="no-channels">Henüz kanal yok</div>';
            return;
        }

        const textChannels = channels.filter(ch => ch.type === 'text');
        const voiceChannels = channels.filter(ch => ch.type === 'voice');

        if (textChannels.length > 0) {
            const textCategory = createChannelCategory('METİN KANALLARI', textChannels);
            channelsList.appendChild(textCategory);
        }

        if (voiceChannels.length > 0) {
            const voiceCategory = createChannelCategory('SES KANALLARI', voiceChannels);
            channelsList.appendChild(voiceCategory);
        }
    }

    // Kanal kategorisi oluştur
    function createChannelCategory(name, channels) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'channel-category';

        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <span>${name}</span>
        `;

        categoryDiv.appendChild(categoryHeader);

        channels.forEach(channel => {
            const channelElement = createChannelElement(channel);
            categoryDiv.appendChild(channelElement);
        });

        return categoryDiv;
    }

    // Kanal öğesi oluştur
    function createChannelElement(channel) {
        const channelDiv = document.createElement('div');
        channelDiv.className = 'channel-item';
        channelDiv.dataset.channelId = channel.id;

        const icon = channel.type === 'text' ? 'fas fa-hashtag' : 'fas fa-volume-up';
        channelDiv.innerHTML = `
            <i class="${icon}"></i>
            <span>${channel.name}</span>
        `;

        channelDiv.addEventListener('click', () => {
            openChannel(channel);
        });

        return channelDiv;
    }

    // Kanalı aç - GÜNCELLENDİ
    function openChannel(channel) {
        console.log('🔧 Kanal açılıyor:', channel);
        
        if (!channel || !currentServer) {
            console.error('❌ Kanal veya sunucu bulunamadı');
            return;
        }
        
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
            // Mesajları yükle
            window.dispatchEvent(new CustomEvent('channelChanged', {
                detail: { 
                    channelId: channel.id,
                    serverId: currentServer.id,
                    channelName: channel.name
                }
            }));
        } else {
            // Ses kanalı için
            if (typeof connectToVoiceChannel === 'function') {
                // Bağlantıyı başlat
                connectToVoiceChannel(channel.name, 'voice_' + channel.id);

                // 🎵 Sesli kanala giriş sesi
                try {
                    const joinSound = new Audio('/sounds/join.mp3');
                    joinSound.volume = 0.4;
                    joinSound.play().catch(err => console.warn('🎧 Ses oynatılamadı:', err));
                } catch (e) {
                    console.warn('🎵 Ses çalma başarısız:', e);
                }

                // 👥 Kanaldaki kullanıcıları göster (voice.js içinden)
                if (typeof voiceChat !== 'undefined' && voiceChat.showVoiceParticipants) {
                    voiceChat.showVoiceParticipants('voice_' + channel.id);
                }
            } else {
                showVoiceChannelNotification(channel.name);
            }
        }
    }

    // Ses kanalı bildirimi göster
    function showVoiceChannelNotification(channelName) {
        const existingNotification = document.querySelector('.voice-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'voice-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--success-color);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
        `;
        notification.innerHTML = `
            <i class="fas fa-volume-up" style="font-size: 18px;"></i>
            <div>
                <div style="font-size: 14px;">🎧 Ses Kanalına Bağlandınız</div>
                <div style="font-size: 12px; opacity: 0.9;">${channelName}</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 500);
        }, 5000);
        
        console.log('🔊 Ses kanalına bağlanıldı:', channelName);
    }

    // 👥 Üyeleri gerçek zamanlı dinle - YENİ VERSİYON
    async function loadServerMembers(serverId) {
        const membersList = document.getElementById('members-list');
        if (!membersList) return;
        membersList.innerHTML = '<div class="loading">Yükleniyor...</div>';

        // Önceki dinleyiciyi temizle
        if (unsubscribeMembers) {
            unsubscribeMembers();
        }

        unsubscribeMembers = db.collection('server_members')
            .where('serverId', '==', serverId)
            .onSnapshot(async snapshot => {
                membersList.innerHTML = '';
                let onlineCount = 0;

                for (const doc of snapshot.docs) {
                    const member = doc.data();
                    const userDoc = await db.collection('users').doc(member.userId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        if (userData.status === 'online') onlineCount++;
                        
                        const div = document.createElement('div');
                        div.className = 'member-item';
                        div.dataset.userId = member.userId;
                        div.innerHTML = `
                            <div class="member-avatar" style="background:${userData.avatarColor || '#5865F2'}">
                                ${userData.username?.[0]?.toUpperCase() || '?'}
                                <div class="status-indicator status-${userData.status || 'offline'}"></div>
                            </div>
                            <span>${userData.username || 'Kullanıcı'}</span>
                        `;
                        membersList.appendChild(div);
                    }
                }

                // Çevrimiçi sayısını güncelle
                const onlineCountElement = document.getElementById('online-count');
                if (onlineCountElement) {
                    onlineCountElement.textContent = onlineCount;
                }
            }, error => {
                console.error('❌ Üyeler dinlenirken hata:', error);
            });
    }

    // 🔁 Gerçek zamanlı kullanıcı durumlarını dinle
    function watchUserStatus() {
        if (unsubscribeUsers) unsubscribeUsers();

        unsubscribeUsers = db.collection('users').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const userData = change.doc.data();
                const userId = change.doc.id;

                // Üye listesindeki durum göstergelerini güncelle
                const statusDots = document.querySelectorAll(`[data-user-id="${userId}"] .status-indicator`);
                statusDots.forEach(dot => {
                    dot.className = `status-indicator status-${userData.status || 'offline'}`;
                });

                // Çevrimiçi sayısını yeniden hesapla
                updateOnlineCount();
            });
        }, error => {
            console.error('❌ Kullanıcı durumları dinlenirken hata:', error);
        });
    }

    // Çevrimiçi sayısını güncelle
    function updateOnlineCount() {
        const membersList = document.getElementById('members-list');
        if (!membersList) return;

        const onlineMembers = membersList.querySelectorAll('.status-indicator.status-online').length;
        const onlineCountElement = document.getElementById('online-count');
        if (onlineCountElement) {
            onlineCountElement.textContent = onlineMembers;
        }
    }

    // 🟢 Davet bölümü görünürlüğünü güncelle
    function updateInviteSectionVisibility() {
        const inviteContainer = document.querySelector('.invite-section');
        if (!inviteContainer) return;

        // Sadece ana menüde (friends view aktif ve server view gizli) göster
        const inMainMenu = friendsView && !friendsView.classList.contains('hidden') && 
                          serverView && serverView.classList.contains('hidden');
        
        inviteContainer.style.display = inMainMenu ? 'block' : 'none';
        console.log('🟢 Davet bölümü:', inMainMenu ? 'görünür' : 'gizli');
    }

    // Event Listeners
    if (addServerBtn) {
        addServerBtn.addEventListener('click', () => {
            createServerModal.classList.remove('hidden');
        });
    }

    if (createServerConfirm) {
        createServerConfirm.addEventListener('click', () => {
            const serverName = document.getElementById('server-name-input').value;
            const serverDesc = document.getElementById('server-desc-input').value;
            
            if (serverName.trim()) {
                createServer(serverName, serverDesc);
            } else {
                alert('❌ Lütfen bir sunucu adı girin.');
            }
        });
    }

    // Modal kapatma
    document.querySelectorAll('.modal-close, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-secondary') && !e.target.id) {
                e.target.closest('.modal').classList.add('hidden');
            } else if (e.target.classList.contains('modal-close')) {
                e.target.closest('.modal').classList.add('hidden');
            }
        });
    });

    // Arkadaşlar sekmesine dön
    const friendsTab = document.querySelector('[data-type="friends"]');
    if (friendsTab) {
        friendsTab.addEventListener('click', () => {
            serverView.classList.add('hidden');
            friendsView.classList.remove('hidden');
            document.getElementById('friends-main').classList.remove('hidden');
            document.getElementById('server-chat').classList.add('hidden');
            document.getElementById('dm-chat').classList.add('hidden');
            document.getElementById('members-sidebar').classList.add('hidden');
            
            // Aktif sunucuyu temizle
            document.querySelectorAll('.server-icon').forEach(icon => {
                icon.classList.remove('active');
            });
            friendsTab.classList.add('active');
            
            // 🟢 Davet bölümünü göster
            updateInviteSectionVisibility();
            
            console.log('👈 Arkadaşlar sekmesine dönüldü');
        });
    }

    // Sayfa kapatılırken dinleyicileri temizle
    window.addEventListener('beforeunload', () => {
        if (unsubscribeUsers) unsubscribeUsers();
        if (unsubscribeMembers) unsubscribeMembers();
    });
});