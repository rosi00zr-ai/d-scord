// Sunucu ayarları yönetimi
document.addEventListener('DOMContentLoaded', function() {
    const serverSettingsBtn = document.getElementById('server-settings-btn');
    const serverSettingsModal = document.getElementById('server-settings-modal');
    const serverSettingsItems = document.querySelectorAll('#server-settings-modal .settings-item');
    const serverSettingsTabs = document.querySelectorAll('#server-settings-modal .settings-tab');
    const createRoleBtn = document.getElementById('create-role-btn');
    const createRoleModal = document.getElementById('create-role-modal');
    const createRoleConfirm = document.getElementById('create-role-confirm');
    
    let currentServer = null;

    // Sunucu ayarlarını aç
    function openServerSettings(server) {
        currentServer = server;
        serverSettingsModal.classList.remove('hidden');
        loadServerSettings(server);
    }

    // Sunucu ayarlarını yükle
    function loadServerSettings(server) {
        // Sunucu bilgilerini doldur
        document.getElementById('server-settings-title').textContent = server.name + ' Ayarları';
        document.getElementById('server-name-setting').value = server.name;
        document.getElementById('server-description-setting').value = server.description || '';
        
        // Rolleri yükle
        loadServerRoles(server);
        
        // Kanalları yükle
        loadServerChannels(server);
        
        // Üyeleri yükle
        loadServerMembers(server);
    }

    // Sunucu rollerini yükle
    async function loadServerRoles(server) {
        const rolesList = document.getElementById('server-roles-list');
        rolesList.innerHTML = '<div class="loading">Roller yükleniyor...</div>';

        try {
            // Sunucudaki rolleri al
            const roles = server.roles || [
                { id: 'owner', name: 'Sunucu Sahibi', color: '#ff0000', permissions: ['all'] },
                { id: 'member', name: 'Üye', color: '#5865F2', permissions: ['send_messages'] }
            ];

            rolesList.innerHTML = '';
            
            roles.forEach(role => {
                const roleElement = createRoleElement(role);
                rolesList.appendChild(roleElement);
            });

        } catch (error) {
            console.error('Roller yüklenirken hata:', error);
            rolesList.innerHTML = '<div class="error">Roller yüklenemedi</div>';
        }
    }

    // Rol öğesi oluştur
    function createRoleElement(role) {
        const roleDiv = document.createElement('div');
        roleDiv.className = 'role-item';
        roleDiv.innerHTML = `
            <div class="role-color" style="background-color: ${role.color}"></div>
            <div class="role-info">
                <div class="role-name">${role.name}</div>
                <div class="role-members">${getRoleMemberCount(role.id)} üye</div>
            </div>
            <div class="role-actions">
                <button class="btn-small edit-role" data-role-id="${role.id}">Düzenle</button>
                ${role.id !== 'owner' ? `<button class="btn-small delete-role" data-role-id="${role.id}">Sil</button>` : ''}
            </div>
        `;

        return roleDiv;
    }

    // Rol üye sayısını al
    function getRoleMemberCount(roleId) {
        // Basit bir hesaplama - gerçek uygulamada Firestore'dan alınmalı
        return roleId === 'owner' ? 1 : (currentServer.members ? currentServer.members.length - 1 : 0);
    }

    // Sunucu kanallarını yükle
    function loadServerChannels(server) {
        const channelsManagement = document.getElementById('server-channels-management');
        
        if (!server.channels || server.channels.length === 0) {
            channelsManagement.innerHTML = '<div class="no-data">Henüz kanal yok</div>';
            return;
        }

        channelsManagement.innerHTML = '';
        
        server.channels.forEach(channel => {
            const channelElement = document.createElement('div');
            channelElement.className = 'channel-management-item';
            channelElement.innerHTML = `
                <div class="channel-type">${channel.type === 'text' ? '#️⃣' : '🎧'}</div>
                <div class="channel-name">${channel.name}</div>
                <div class="channel-actions">
                    <button class="btn-small edit-channel" data-channel-id="${channel.id}">Düzenle</button>
                    <button class="btn-small delete-channel" data-channel-id="${channel.id}">Sil</button>
                </div>
            `;
            
            channelsManagement.appendChild(channelElement);
        });
    }

    // Sunucu üyelerini yükle
    async function loadServerMembers(server) {
        const membersManagement = document.getElementById('server-members-management');
        membersManagement.innerHTML = '<div class="loading">Üyeler yükleniyor...</div>';

        try {
            const membersSnapshot = await db.collection('server_members')
                .where('serverId', '==', server.id)
                .get();

            membersManagement.innerHTML = '';
            
            for (const doc of membersSnapshot.docs) {
                const memberData = doc.data();
                const userDoc = await db.collection('users').doc(memberData.userId).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const memberElement = createMemberManagementElement(userData, memberData);
                    membersManagement.appendChild(memberElement);
                }
            }

        } catch (error) {
            console.error('Üyeler yüklenirken hata:', error);
            membersManagement.innerHTML = '<div class="error">Üyeler yüklenemedi</div>';
        }
    }

    // Üye yönetim öğesi oluştur
    function createMemberManagementElement(userData, memberData) {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'member-management-item';
        
        const displayName = userData.username || 'Bilinmeyen';
        const avatarLetter = displayName.charAt(0).toUpperCase();

        memberDiv.innerHTML = `
            <div class="member-avatar" style="background-color: ${userData.avatarColor || '#5865F2'}">
                ${avatarLetter}
            </div>
            <div class="member-info">
                <div class="member-name">${displayName}</div>
                <div class="member-roles">
                    ${memberData.roles && memberData.roles.includes('owner') ? 
                      '<span class="role-tag" style="background-color: #ff0000">Sunucu Sahibi</span>' : 
                      '<span class="role-tag" style="background-color: #5865F2">Üye</span>'}
                </div>
            </div>
            <div class="member-actions">
                ${!memberData.roles.includes('owner') ? `
                    <button class="btn-small kick-member" data-user-id="${memberData.userId}">At</button>
                    <button class="btn-small ban-member" data-user-id="${memberData.userId}">Yasakla</button>
                ` : ''}
            </div>
        `;

        return memberDiv;
    }

    // Rol oluştur
    async function createRole(roleName, roleColor, permissions) {
        if (!currentServer) return;

        try {
            const newRole = {
                id: 'role_' + Date.now(),
                name: roleName,
                color: roleColor,
                permissions: permissions,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Sunucuya rol ekle
            await db.collection('servers').doc(currentServer.id).update({
                roles: firebase.firestore.FieldValue.arrayUnion(newRole)
            });

            console.log('✅ Rol oluşturuldu:', newRole);
            createRoleModal.classList.add('hidden');
            loadServerRoles(currentServer);
            
        } catch (error) {
            console.error('❌ Rol oluşturma hatası:', error);
            alert('Rol oluşturulamadı: ' + error.message);
        }
    }

    // Event Listeners
    if (serverSettingsBtn) {
        serverSettingsBtn.addEventListener('click', () => {
            if (currentServer) {
                openServerSettings(currentServer);
            }
        });
    }

    // Sunucu ayarları tab değiştirme
    serverSettingsItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.dataset.tab;
            
            serverSettingsItems.forEach(i => i.classList.remove('active'));
            serverSettingsTabs.forEach(tab => tab.classList.add('hidden'));
            
            item.classList.add('active');
            document.getElementById(`server-${tabName}-tab`).classList.remove('hidden');
        });
    });

    // Rol oluşturma
    if (createRoleBtn) {
        createRoleBtn.addEventListener('click', () => {
            createRoleModal.classList.remove('hidden');
        });
    }

    if (createRoleConfirm) {
        createRoleConfirm.addEventListener('click', () => {
            const roleName = document.getElementById('role-name-input').value;
            const roleColor = document.getElementById('role-color-input').value;
            const permissions = Array.from(document.querySelectorAll('input[name="permissions"]:checked'))
                .map(checkbox => checkbox.value);

            if (roleName.trim()) {
                createRole(roleName.trim(), roleColor, permissions);
            } else {
                alert('Lütfen rol adı girin.');
            }
        });
    }

    // Modal kapatma
    document.querySelectorAll('.modal-close, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-secondary') || e.target.classList.contains('modal-close')) {
                e.target.closest('.modal').classList.add('hidden');
            }
        });
    });

    // Global fonksiyon
    window.openServerSettings = openServerSettings;
});
// server-settings.js - Davet butonu ekle (loadServerSettings fonksiyonuna ekleyin)
function loadServerSettings(server) {
    // ... mevcut kodlar ...
    
 // server-settings.js - loadServerSettings fonksiyonunu BULUN ve içine bu kodu ekleyin
function loadServerSettings(server) {
    // ... MEVCUT KODLARINIZ AYNI KALSIN ...
    
    // EN SONA bu kodu ekleyin:
    addInviteSection(server);
}

// Yeni fonksiyon ekleyin:
function addInviteSection(server) {
    const overviewTab = document.getElementById('server-overview-tab');
    
    // Eğer zaten varsa sil
    const existingSection = overviewTab.querySelector('.invite-management-section');
    if (existingSection) existingSection.remove();
    
    const inviteSection = `
        <div class="settings-section invite-management-section">
            <h4>🔗 DAVET YÖNETİMİ</h4>
            <button class="btn-primary" onclick="createInviteLink()" 
                    style="margin-bottom: 15px; width: 100%; padding: 12px;">
                📨 Davet Linki Oluştur
            </button>
            <div class="invite-info" style="font-size: 12px; color: #b9bbbe;">
                <p>• Davetler 7 gün geçerlidir</p>
                <p>• Her davet 10 kişi tarafından kullanılabilir</p>
                <p>• Davet formatı: <code>siteniz.com?invite=KOD</code></p>
            </div>
        </div>
    `;
    
    overviewTab.insertAdjacentHTML('beforeend', inviteSection);
}
    // Genel bakış tab'ının sonuna ekle
    overviewTab.insertAdjacentHTML('beforeend', inviteSection);
}