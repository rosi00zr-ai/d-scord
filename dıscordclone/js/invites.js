// invites.js - TAM ÇALIŞAN VERSİYON
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Invites.js yüklendi');
    checkURLForInvite();
});

let inviteProcessed = false;

function checkURLForInvite() {
    if (inviteProcessed) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('invite');
    
    if (inviteCode && inviteCode.length === 8) {
        inviteProcessed = true;
        console.log('📨 Davet kodu bulundu:', inviteCode);
        
        // URL'yi temizle
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        if (auth.currentUser) {
            setTimeout(() => useInviteCode(inviteCode), 1000);
        } else {
            sessionStorage.setItem('pendingInvite', inviteCode);
        }
    }
}

// Giriş kontrolü
auth.onAuthStateChanged((user) => {
    if (user) {
        const pendingInvite = sessionStorage.getItem('pendingInvite');
        if (pendingInvite) {
            setTimeout(() => {
                useInviteCode(pendingInvite);
                sessionStorage.removeItem('pendingInvite');
            }, 1500);
        }
    }
});

// Davet kodu kullan
async function useInviteCode(inviteCode) {
    try {
        console.log('🔍 Davet kodu kullanılıyor:', inviteCode);
        
        const inviteDoc = await db.collection('invites').doc(inviteCode.toUpperCase()).get();
        
        if (!inviteDoc.exists) {
            alert('❌ Geçersiz davet kodu!');
            return;
        }

        const inviteData = inviteDoc.data();
        
        if (inviteData.used) {
            alert('❌ Bu davet zaten kullanılmış!');
            return;
        }
        
        if (inviteData.expiresAt.toDate() < new Date()) {
            alert('❌ Davetin süresi dolmuş!');
            return;
        }

        // Kullanıcı zaten sunucuda mı?
        const serverDoc = await db.collection('servers').doc(inviteData.serverId).get();
        const serverData = serverDoc.data();
        
        if (serverData.members && serverData.members.includes(auth.currentUser.uid)) {
            alert('ℹ️ Zaten bu sunucudasınız!');
            if (window.currentServer && window.switchToServer) {
                window.switchToServer(inviteData.serverId);
            }
            return;
        }

        // Sunucuya üye ekle
        await db.collection('servers').doc(inviteData.serverId).update({
            members: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
        });

        // Sunucu üyeleri koleksiyonuna ekle
        await db.collection('server_members').add({
            serverId: inviteData.serverId,
            userId: auth.currentUser.uid,
            roles: ['member'],
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Daveti kullanıldı olarak işaretle
        await db.collection('invites').doc(inviteDoc.id).update({
            used: true,
            usedBy: auth.currentUser.uid,
            usedAt: firebase.firestore.FieldValue.serverTimestamp(),
            usedCount: firebase.firestore.FieldValue.increment(1)
        });

        alert(`✅ "${inviteData.serverName}" sunucusuna katıldınız!`);
        
        // Sunucuya geç
        if (window.switchToServer) {
            setTimeout(() => window.switchToServer(inviteData.serverId), 1000);
        }
        
    } catch (error) {
        console.error('❌ Davet hatası:', error);
        alert('❌ Davet kullanılamadı: ' + error.message);
    }
}

// Davet oluştur
window.createInviteLink = async function() {
    const user = auth.currentUser;
    if (!user) {
        alert('Giriş yapmalısınız!');
        return;
    }

    const currentServer = window.currentServer;
    if (!currentServer) {
        alert('Önce bir sunucu seçin!');
        return;
    }

    try {
        const inviteCode = generateInviteCode();
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        const inviteData = {
            code: inviteCode,
            serverId: currentServer.id,
            serverName: currentServer.name,
            createdBy: user.uid,
            createdByName: userData?.username || 'Kullanıcı',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            maxUses: 10,
            usedCount: 0,
            used: false,
            isActive: true
        };

        await db.collection('invites').doc(inviteCode).set(inviteData);
        
        const inviteLink = `${window.location.origin}?invite=${inviteCode}`;
        showInviteCreatedModal(inviteLink, inviteCode);
        
    } catch (error) {
        console.error('❌ Davet oluşturma hatası:', error);
        alert('Davet oluşturulamadı: ' + error.message);
    }
};

function showInviteCreatedModal(inviteLink, inviteCode) {
    const modalHTML = `
        <div class="modal" id="inviteCreatedModal" style="display: block; z-index: 10000;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✅ Davet Oluşturuldu!</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Sunucu:</strong> ${window.currentServer?.name}</p>
                    <p><strong>Davet Kodu:</strong> <code>${inviteCode}</code></p>
                    
                    <div class="invite-link-box">
                        <input type="text" value="${inviteLink}" readonly id="createdInviteLink" 
                               style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ccc; border-radius: 4px;">
                        <button onclick="copyCreatedInvite()" class="btn-primary" style="width: 100%; padding: 10px; margin: 5px 0;">
                            📋 Linki Kopyala
                        </button>
                    </div>
                    
                    <div class="invite-info" style="margin-top: 15px; padding: 10px; background: #2f3136; border-radius: 4px;">
                        <p>⏰ 7 gün geçerli</p>
                        <p>👥 10 kişi kullanabilir</p>
                        <p>🔗 Link formatı: <code>?invite=${inviteCode}</code></p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Eski modal varsa sil
    const oldModal = document.getElementById('inviteCreatedModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById('inviteCreatedModal');
    const closeBtn = modal.querySelector('.modal-close');
    
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

window.copyCreatedInvite = async function() {
    const input = document.getElementById('createdInviteLink');
    if (!input) return;
    
    try {
        await navigator.clipboard.writeText(input.value);
        alert('✅ Link kopyalandı! Arkadaşlarınıza gönderin.');
    } catch (error) {
        input.select();
        document.execCommand('copy');
        alert('✅ Link kopyalandı!');
    }
};

function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

window.useInviteCode = useInviteCode;