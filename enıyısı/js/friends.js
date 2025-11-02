// Arkadaş sistemi - ŞİFRE HATASI DÜZELTİLDİ
document.addEventListener('DOMContentLoaded', function() {
    const friendsView = document.getElementById('friends-view');
    const friendsList = document.getElementById('friends-list');
    const addFriendBtn = document.getElementById('add-friend-btn');
    const addFriendModal = document.getElementById('add-friend-modal');
    const sendFriendRequestBtn = document.getElementById('send-friend-request');
    const friendsSearch = document.getElementById('friends-search');
    const friendsTabs = document.querySelectorAll('.tab');
    
    let currentUser = null;
    let friends = [];
    let friendRequests = [];
    let allUsers = [];

    // Kullanıcı değişikliğini dinle
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            console.log('👤 Arkadaşlar için kullanıcı ayarlandı:', user.uid);
            loadAllUsers();
            loadFriends();
            loadFriendRequests();
        }
    });

    // Tüm kullanıcıları yükle
    async function loadAllUsers() {
        try {
            console.log('🔍 Tüm kullanıcılar yükleniyor...');
            const snapshot = await db.collection('users').get();
            allUsers = [];
            snapshot.forEach(doc => {
                if (doc.id !== currentUser.uid) {
                    const userTag = doc.id.substring(0, 4);
                    allUsers.push({
                        id: doc.id,
                        tag: userTag,
                        ...doc.data()
                    });
                }
            });
            console.log('📊 Tüm kullanıcılar yüklendi:', allUsers.length);
            
            // Debug: Kullanıcıları konsola yazdır
            console.log('👥 MEVCUT KULLANICILAR:');
            allUsers.forEach(user => {
                console.log(`   👤 ${user.username}#${user.tag}`);
            });
            
            // Eğer hiç kullanıcı yoksa uyarı göster
            if (allUsers.length === 0) {
                console.log('⚠️  Hiç kullanıcı bulunamadı. Başka hesaplar oluşturmanız gerekiyor.');
                showNoUsersWarning();
            }
            
        } catch (error) {
            console.error('❌ Kullanıcılar yüklenirken hata:', error);
            showNoUsersWarning();
        }
    }

    // Kullanıcı bulunamadı uyarısı
    function showNoUsersWarning() {
        console.log('💡 Başka kullanıcılar olmadığı için arkadaş ekleyemezsiniz.');
        console.log('💡 Çözüm: Başka bir tarayıcı/sekmede yeni hesap oluşturun.');
    }

    // Arkadaşları yükle
    async function loadFriends() {
        try {
            console.log('👥 Arkadaşlar yükleniyor...');
            
            const friendsSnapshot = await db.collection('friends').get();
            
            friends = [];
            friendsSnapshot.forEach(doc => {
                const friendData = doc.data();
                
                if (friendData.status === 'accepted') {
                    if (friendData.receiverId === currentUser.uid) {
                        friends.push({
                            id: doc.id,
                            friendId: friendData.senderId,
                            type: 'incoming',
                            ...friendData
                        });
                    } else if (friendData.senderId === currentUser.uid) {
                        friends.push({
                            id: doc.id,
                            friendId: friendData.receiverId,
                            type: 'outgoing',
                            ...friendData
                        });
                    }
                }
            });

            console.log('✅ Arkadaşlar bulundu:', friends.length);

            // Arkadaş bilgilerini getir
            for (let friend of friends) {
                const userDoc = await db.collection('users').doc(friend.friendId).get();
                if (userDoc.exists) {
                    friend.userData = userDoc.data();
                }
            }

            renderFriends();
        } catch (error) {
            console.error('❌ Arkadaşlar yüklenirken hata:', error);
        }
    }

    // Arkadaş isteklerini yükle
    async function loadFriendRequests() {
        try {
            const snapshot = await db.collection('friends').get();

            friendRequests = [];
            snapshot.forEach(doc => {
                const requestData = doc.data();
                
                if (requestData.receiverId === currentUser.uid && requestData.status === 'pending') {
                    friendRequests.push({
                        id: doc.id,
                        ...requestData
                    });
                }
            });

            console.log('📨 Arkadaşlık istekleri:', friendRequests.length);

            // İstek gönderenlerin bilgilerini getir
            for (let request of friendRequests) {
                const userDoc = await db.collection('users').doc(request.senderId).get();
                if (userDoc.exists) {
                    request.senderData = userDoc.data();
                }
            }

            renderFriends();
        } catch (error) {
            console.error('❌ Arkadaş istekleri yüklenirken hata:', error);
        }
    }

    // Arkadaşları render et
    function renderFriends() {
        friendsList.innerHTML = '';
        console.log('🎨 Arkadaşlar render ediliyor...');

        const activeTab = document.querySelector('.tab.active').dataset.tab;

        if (activeTab === 'pending' && friendRequests.length > 0) {
            console.log('📨 Bekleyen istekler gösteriliyor');
            friendRequests.forEach(request => {
                const requestElement = createFriendRequestElement(request);
                friendsList.appendChild(requestElement);
            });
        } else if (activeTab === 'online') {
            const onlineFriends = friends.filter(friend => 
                friend.userData && friend.userData.status === 'online'
            );
            console.log('🟢 Çevrimiçi arkadaşlar:', onlineFriends.length);
            onlineFriends.forEach(friend => {
                const friendElement = createFriendElement(friend);
                friendsList.appendChild(friendElement);
            });
        } else {
            console.log('👥 Tüm arkadaşlar gösteriliyor:', friends.length);
            friends.forEach(friend => {
                const friendElement = createFriendElement(friend);
                friendsList.appendChild(friendElement);
            });
        }

        if (friendsList.children.length === 0) {
            showEmptyMessage(activeTab);
        }
    }

    // Boş mesaj göster
    function showEmptyMessage(tab) {
        const messages = {
            online: '🟢 Çevrimiçi arkadaşınız yok',
            all: '👥 Henüz arkadaşınız yok',
            pending: '📨 Bekleyen arkadaşlık isteğiniz yok'
        };

        friendsList.innerHTML = `
            <div class="empty-friends">
                <div class="empty-icon">${tab === 'online' ? '🟢' : tab === 'pending' ? '📨' : '👤'}</div>
                <div class="empty-text">${messages[tab] || 'Veri bulunamadı'}</div>
                ${tab === 'all' && allUsers.length === 0 ? `
                    <div class="empty-help" style="margin-top: 10px; font-size: 12px; color: var(--text-muted);">
                        💡 Arkadaş eklemek için başka kullanıcıların olması gerekiyor.
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Arkadaş öğesi oluştur
    function createFriendElement(friend) {
        const friendDiv = document.createElement('div');
        friendDiv.className = 'friend-item';
        friendDiv.dataset.friendId = friend.friendId;

        const statusClass = friend.userData?.status || 'offline';
        const displayName = friend.userData?.username || 'Bilinmeyen Kullanıcı';
        const avatarLetter = displayName.charAt(0).toUpperCase();

        friendDiv.innerHTML = `
            <div class="friend-avatar" style="background-color: ${friend.userData?.avatarColor || '#5865F2'}">
                ${avatarLetter}
                <div class="status-indicator status-${statusClass}"></div>
            </div>
            <div class="friend-info">
                <div class="friend-name">${displayName}</div>
                <div class="friend-status">${getStatusText(statusClass)}</div>
            </div>
            <div class="friend-actions">
                <button class="friend-action invite-server" title="Sunucuya Davet Et">
                    <i class="fas fa-user-plus"></i>
                </button>
                <button class="friend-action start-dm" title="DM Başlat">
                    <i class="fas fa-envelope"></i>
                </button>
            </div>
        `;

        friendDiv.querySelector('.start-dm').addEventListener('click', (e) => {
            e.stopPropagation();
            openDM(friend.friendId, friend.userData);
        });

        friendDiv.querySelector('.invite-server').addEventListener('click', (e) => {
            e.stopPropagation();
            inviteToServer(friend.friendId, friend.userData);
        });

        friendDiv.addEventListener('click', () => {
            openDM(friend.friendId, friend.userData);
        });

        return friendDiv;
    }

    // Arkadaş isteği öğesi oluştur
    function createFriendRequestElement(request) {
        const requestDiv = document.createElement('div');
        requestDiv.className = 'friend-item friend-request';

        const displayName = request.senderData?.username || 'Bilinmeyen Kullanıcı';
        const avatarLetter = displayName.charAt(0).toUpperCase();

        requestDiv.innerHTML = `
            <div class="friend-avatar" style="background-color: ${request.senderData?.avatarColor || '#5865F2'}">
                ${avatarLetter}
            </div>
            <div class="friend-info">
                <div class="friend-name">${displayName}</div>
                <div class="friend-status">Arkadaşlık isteği gönderdi</div>
            </div>
            <div class="friend-request-actions">
                <button class="btn-primary btn-small accept-request">Kabul</button>
                <button class="btn-secondary btn-small reject-request">Red</button>
            </div>
        `;

        requestDiv.querySelector('.accept-request').addEventListener('click', (e) => {
            e.stopPropagation();
            acceptFriendRequest(request.id);
        });

        requestDiv.querySelector('.reject-request').addEventListener('click', (e) => {
            e.stopPropagation();
            rejectFriendRequest(request.id);
        });

        return requestDiv;
    }

    // Arkadaşlık isteği gönder
    async function sendFriendRequest(usernameWithTag) {
        console.log('🔍 Arkadaş aranıyor:', usernameWithTag);
        
        // Önce kullanıcı kontrolü
        if (allUsers.length === 0) {
            alert('❌ Arkadaş ekleyebileceğiniz hiç kullanıcı yok.\n\n💡 Çözüm: Başka bir tarayıcı/sekmede yeni hesap oluşturun.');
            return;
        }
        
        const parts = usernameWithTag.split('#');
        if (parts.length !== 2) {
            alert('❌ Geçerli bir kullanıcı adı ve tag girin (örn: Ahmet#1234)\n\nMevcut kullanıcılar:\n' + getUsersList());
            return;
        }

        const username = parts[0].trim();
        const tag = parts[1].trim();
        
        if (!username || !tag) {
            alert('❌ Geçerli bir kullanıcı adı ve tag girin (örn: Ahmet#1234)\n\nMevcut kullanıcılar:\n' + getUsersList());
            return;
        }

        try {
            console.log('🔍 Kullanıcı aranıyor:', username, 'Tag:', tag);
            
            // Debug
            console.log('📋 MEVCUT KULLANICILAR:');
            allUsers.forEach(user => {
                console.log(`   👤 ${user.username}#${user.tag} (aranan: ${username}#${tag})`);
            });

            // Kullanıcıyı bul
            let targetUser = null;
            for (let user of allUsers) {
                console.log(`   🔍 Kontrol: "${user.username}" == "${username}" && "${user.tag}" == "${tag}"`);
                if (user.username === username && user.tag === tag) {
                    targetUser = user;
                    console.log('✅ Kullanıcı bulundu:', targetUser);
                    break;
                }
            }

            if (!targetUser) {
                alert('❌ Kullanıcı bulunamadı.\n\nAradığınız: ' + usernameWithTag + '\n\nMevcut kullanıcılar:\n' + getUsersList());
                return;
            }

            // Kontroller
            if (targetUser.id === currentUser.uid) {
                alert('❌ Kendinize arkadaşlık isteği gönderemezsiniz.');
                return;
            }

            const existingFriend = friends.find(f => f.friendId === targetUser.id);
            if (existingFriend) {
                alert('❌ Bu kullanıcı zaten arkadaşınız.');
                return;
            }

            const existingRequest = friendRequests.find(r => r.senderId === targetUser.id);
            if (existingRequest) {
                alert('❌ Bu kullanıcıya zaten istek gönderdiniz.');
                return;
            }

            console.log('✅ Tüm kontroller başarılı, istek gönderiliyor...');

            // İstek gönder
            await db.collection('friends').add({
                senderId: currentUser.uid,
                receiverId: targetUser.id,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert(`✅ ${targetUser.username}#${targetUser.tag} kullanıcısına arkadaşlık isteği gönderildi!`);
            addFriendModal.classList.add('hidden');
            document.getElementById('friend-username-input').value = '';
            loadFriendRequests();
            
        } catch (error) {
            console.error('❌ Arkadaşlık isteği gönderilirken hata:', error);
            alert('❌ İstek gönderilemedi: ' + error.message);
        }
    }

    // Kullanıcı listesini al
    function getUsersList() {
        if (allUsers.length === 0) {
            return 'Hiç kullanıcı yok';
        }
        let list = '';
        allUsers.forEach(user => {
            list += `👤 ${user.username}#${user.tag}\n`;
        });
        return list;
    }

    // Arkadaşlık isteğini kabul et
    async function acceptFriendRequest(requestId) {
        try {
            console.log('✅ Arkadaşlık isteği kabul ediliyor:', requestId);
            
            await db.collection('friends').doc(requestId).update({
                status: 'accepted',
                acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await loadFriends();
            await loadFriendRequests();
            
            alert('✅ Arkadaşlık isteği kabul edildi!');
            
        } catch (error) {
            console.error('❌ Arkadaşlık isteği kabul edilirken hata:', error);
            alert('❌ İstek kabul edilemedi: ' + error.message);
        }
    }

    // Arkadaşlık isteğini reddet
    async function rejectFriendRequest(requestId) {
        try {
            await db.collection('friends').doc(requestId).delete();
            loadFriendRequests();
            alert('❌ Arkadaşlık isteği reddedildi.');
        } catch (error) {
            console.error('❌ Arkadaşlık isteği reddedilirken hata:', error);
        }
    }

    // Sunucuya davet et
    async function inviteToServer(friendId, friendData) {
        if (!window.currentServer) {
            alert('❌ Önce bir sunucu seçmelisiniz!');
            return;
        }

        try {
            const inviteCode = generateInviteCode();
            
            await db.collection('invites').add({
                code: inviteCode,
                serverId: window.currentServer.id,
                serverName: window.currentServer.name,
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                maxUses: 1,
                used: false
            });

            const inviteMessage = `🎉 ${friendData.username} kullanıcısını "${window.currentServer.name}" sunucusuna davet ettiniz!\n\nDavet Kodu: ${inviteCode}\n\nBu kodu arkadaşınıza gönderin.`;
            alert(inviteMessage);
            
            console.log('✅ Davet oluşturuldu:', inviteCode);
            
        } catch (error) {
            console.error('❌ Davet oluşturulurken hata:', error);
            alert('❌ Davet oluşturulamadı: ' + error.message);
        }
    }

    // Davet kodu oluştur
    function generateInviteCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // DM aç
    function openDM(friendId, friendData) {
        console.log('💬 DM açılıyor:', friendData.username);
        
        if (typeof window.openDM === 'function') {
            window.openDM(friendId, friendData);
        } else {
            alert(`💬 ${friendData.username} ile DM başlatılıyor...`);
        }
    }

    // Durum metnini al
    function getStatusText(status) {
        const statusTexts = {
            online: 'Çevrimiçi',
            idle: 'Rahatsız Etmeyin',
            dnd: 'Meşgul',
            offline: 'Çevrimdışı'
        };
        return statusTexts[status] || 'Çevrimdışı';
    }

    // Event Listeners
    addFriendBtn.addEventListener('click', () => {
        addFriendModal.classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('friend-username-input').focus();
        }, 100);
    });

    sendFriendRequestBtn.addEventListener('click', () => {
        const usernameInput = document.getElementById('friend-username-input').value.trim();
        if (usernameInput) {
            sendFriendRequest(usernameInput);
        } else {
            alert('❌ Lütfen bir kullanıcı adı ve tag girin.');
        }
    });

    document.getElementById('friend-username-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const usernameInput = document.getElementById('friend-username-input').value.trim();
            if (usernameInput) {
                sendFriendRequest(usernameInput);
            }
        }
    });

    friendsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            friendsTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderFriends();
        });
    });

    document.querySelectorAll('.modal-close, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-secondary') && !e.target.id) {
                e.target.closest('.modal').classList.add('hidden');
                document.getElementById('friend-username-input').value = '';
            } else if (e.target.classList.contains('modal-close')) {
                e.target.closest('.modal').classList.add('hidden');
                document.getElementById('friend-username-input').value = '';
            }
        });
    });

    window.loadFriends = loadFriends;
    
    console.log('✅ Arkadaş sistemi yüklendi');
});