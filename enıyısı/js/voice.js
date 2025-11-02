// voice.js — WebRTC (peer-to-peer) + Firestore sinyallemeli tam çalışan sürüm
// Destek: DM (dm_uid_uid) ve sunucu ses odaları (ör. voice_...)
// Gereksinimler: global `db` (Firestore) ve `auth` mevcut.

class VoiceChat {
    constructor() {
        this.localStream = null;
        // peerConnections keyed by remotePeerId (for mesh it could be uid, for 1:1 single pc 'peer')
        this.peerConnections = {}; 
        this.currentVoiceChannel = null; // { id, name }
        this.isConnected = false;

        // Firestore listeners to cleanup
        this._offerListenerUnsub = null;
        this._answerListenerUnsub = null;
        this._candidatesListenerUnsub = null;

        // UI elements
        this.localAudio = document.getElementById('local-audio') || null;
        this.remoteAudios = document.getElementById('remote-audios') || null;
        this.setupVoiceElements();
    }

    setupVoiceElements() {
        if (!this.localAudio) {
            this.localAudio = document.createElement('audio');
            this.localAudio.id = 'local-audio';
            this.localAudio.autoplay = true;
            this.localAudio.muted = true; // local playback muted
            this.localAudio.style.display = 'none';
            document.body.appendChild(this.localAudio);
        }
        if (!this.remoteAudios) {
            this.remoteAudios = document.createElement('div');
            this.remoteAudios.id = 'remote-audios';
            this.remoteAudios.style.display = 'none';
            document.body.appendChild(this.remoteAudios);
        }
    }

    // ENTRY POINT: join a channel (DM or server). channelId must be deterministic among peers
    async connectToVoiceChannel(channelName, channelId) {
        console.log('🎧 connectToVoiceChannel', channelName, channelId);

        this.currentVoiceChannel = { name: channelName, id: channelId };

        try {
            // get microphone
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false
            });
            // show local stream for visual/monitoring
            this.localAudio.srcObject = this.localStream;

            // show small UI
            this.showVoiceControls(channelName);

            // Update presence
            await this.updateVoiceStatus(true);

            // Setup WebRTC via Firestore
            await this._startSignaling(channelId);
            this.playJoinSound();
            const prevUsers = this._currentVoiceUsers || [];
const newUsers = [];
this.watchVoiceParticipants(channelId);


            this.isConnected = true;
            console.log('✅ Ses kanalına bağlanıldı ve sinyalleme başlatıldı');
        } catch (err) {
            console.error('❌ connectToVoiceChannel hata:', err);
            this.showVoiceError(err);
        }
    }

    async disconnectFromVoiceChannel() {
    console.log('🔇 disconnectFromVoiceChannel');
    try {
        // 🔻 Mikrofon akışını durdur
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }

        // 🔻 Peer bağlantılarını kapat
        Object.values(this.peerConnections).forEach(pc => {
            try { pc.close(); } catch(e) {}
        });
        this.peerConnections = {};

        // 🔻 Uzak sesleri temizle
        if (this.remoteAudios) this.remoteAudios.innerHTML = '';

        // 🔻 Firestore listener’larını kapat
        if (this._offerListenerUnsub) { this._offerListenerUnsub(); this._offerListenerUnsub = null; }
        if (this._answerListenerUnsub) { this._answerListenerUnsub(); this._answerListenerUnsub = null; }
        if (this._candidatesListenerUnsub) { this._candidatesListenerUnsub(); this._candidatesListenerUnsub = null; }

        // 🔻 Sesli kullanıcı listesini kapat
        if (typeof this.stopWatchingParticipants === 'function') {
            this.stopWatchingParticipants();
        }

        // 🔻 UI’yi gizle
        this.hideVoiceControls();

        // 🔻 Kullanıcı durumunu güncelle
        if (typeof this.updateVoiceStatus === 'function') {
            await this.updateVoiceStatus(false);
        }

        // 🔊 Ayrılma sesi çal
        this.playLeaveSound();

        this.currentVoiceChannel = null;
        this.isConnected = false;

        console.log('✅ Ses bağlantısı kapatıldı ve kaynaklar temizlendi');
    } catch (e) {
        console.warn('disconnect error', e);
    }
}



    showVoiceControls(channelName) {
        this.hideVoiceControls();
        const voicePanel = document.createElement('div');
        voicePanel.id = 'voice-control-panel';
        voicePanel.innerHTML = `
            <div class="voice-panel" style="position:fixed;right:18px;bottom:18px;z-index:10000;background:#2f3136;padding:12px;border-radius:10px;color:#fff;box-shadow:0 8px 30px rgba(0,0,0,0.4);min-width:220px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <i class="fas fa-volume-up"></i>
                        <strong style="font-size:14px;">${channelName}</strong>
                    </div>
                    <button id="voice-hangup" title="Ayrıl" style="background:transparent;border:0;color:#ff6b6b;cursor:pointer;font-size:18px;"><i class="fas fa-phone-slash"></i></button>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <button id="voice-mic" class="btn" style="padding:6px 10px;border-radius:8px;border:0;cursor:pointer;">🎤</button>
                    <button id="voice-mute" class="btn" style="padding:6px 10px;border-radius:8px;border:0;cursor:pointer;">🔈</button>
                    <div id="voice-status-text" style="margin-left:auto;font-size:12px;opacity:0.9">Bağlandı</div>
                </div>
            </div>
        `;
        document.body.appendChild(voicePanel);

        document.getElementById('voice-hangup').addEventListener('click', () => {
            disconnectFromVoiceChannel();
        });
        document.getElementById('voice-mic').addEventListener('click', () => {
            this._toggleMicButton();
        });
        document.getElementById('voice-mute').addEventListener('click', () => {
            this._toggleRemoteMute();
        });
    }

    hideVoiceControls() {
        const p = document.getElementById('voice-control-panel');
        if (p) p.remove();
    }

    _toggleMicButton() {
        if (!this.localStream) return;
        const track = this.localStream.getAudioTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        const btn = document.getElementById('voice-mic');
        if (btn) btn.textContent = track.enabled ? '🎤' : '🔇';
    }

    _toggleRemoteMute() {
        // toggle mute on all remote audio elements
        const audios = document.querySelectorAll('.voice-remote-audio');
        if (!audios.length) return;
        const firstMuted = audios[0].muted;
        audios.forEach(a => a.muted = !firstMuted);
        const btn = document.getElementById('voice-mute');
        if (btn) btn.textContent = firstMuted ? '🔈' : '🔇';
    }

    async updateVoiceStatus(active) {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await db.collection('users').doc(user.uid).update({
                inVoiceChannel: active,
                currentVoiceChannel: active ? this.currentVoiceChannel : null,
                voiceStatusUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.warn('voice status update error', e);
        }
    }

    showVoiceError(err) {
        const msg = document.createElement('div');
        msg.style = 'position:fixed;top:20px;right:20px;background:#e74c3c;color:#fff;padding:10px 14px;border-radius:8px;z-index:10001;';
        msg.textContent = 'Ses başlatılamadı: ' + (err && err.message ? err.message : '');
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 4500);
    }

    // ---------------------------
    // WebRTC + Firestore signaling
    // ---------------------------
    async _startSignaling(channelId) {
        // Firestore doc for this voice channel
        const callsRef = db.collection('voice_calls').doc(channelId);

        // Listen for an offer/answer changes and candidate subcollection
        // Strategy: if no doc or no offer -> create offer (caller)
        // if doc has offer but no answer -> become callee and create answer
        const snap = await callsRef.get();

        if (!snap.exists || !snap.data().offer) {
            // create offer (caller)
            console.log('🔔 Bu kanal için offer yok — offer oluşturuluyor (caller)');
            await this._createOffer(callsRef);
            // listen for answer/candidates
            this._listenForAnswerAndCandidates(callsRef);
        } else {
            // offer exists -> become callee
            console.log('🔔 Offer bulundu — cevap oluşturuluyor (callee)');
            await this._createAnswer(callsRef, snap.data().offer);
            // listen for candidates (others) and for future offers/answers if needed
            this._listenForCandidates(callsRef);
        }

        // Always listen for remote candidates (both roles)
        this._listenForCandidates(callsRef);
    }

    async _createPeerConnection(peerId) {
        // peerId here is logical; for simple 1:1 we'll just have 'peer' key
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        // add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));
        }

        // handle incoming tracks
        pc.ontrack = (evt) => {
            // create or update remote audio element
            let remoteEl = document.getElementById('voice-remote-' + peerId);
            if (!remoteEl) {
                remoteEl = document.createElement('audio');
                remoteEl.id = 'voice-remote-' + peerId;
                remoteEl.className = 'voice-remote-audio';
                remoteEl.autoplay = true;
                remoteEl.controls = false;
                remoteEl.style.display = 'block';
                // place it in remoteAudios container
                if (this.remoteAudios) {
                    this.remoteAudios.style.display = 'block';
                    this.remoteAudios.appendChild(remoteEl);
                } else {
                    document.body.appendChild(remoteEl);
                }
            }
            // Attach the first stream
            remoteEl.srcObject = evt.streams[0];
            console.log('🔊 remote track attached for', peerId);
        };

        // ICE candidate => push to firestore later per role
        const localUser = auth.currentUser;
        pc.onicecandidate = (event) => {
            if (!event.candidate) return;
            // add candidate to collection: voice_calls/{channelId}/candidates
            // We'll push candidate with sender id
            const candidate = event.candidate.toJSON();
            if (this.currentVoiceChannel && localUser) {
                const docId = this.currentVoiceChannel.id;
                db.collection('voice_calls').doc(docId).collection('candidates').add({
                    candidate,
                    sender: localUser.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(e => console.warn('candidate add err', e));
            }
        };

        return pc;
    }

    // Caller path: create offer and write to doc
    async _createOffer(callsRef) {
        const pc = await this._createPeerConnection('peer'); // single peer for 1:1
        this.peerConnections['peer'] = pc;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Save offer to Firestore doc
        await callsRef.set({
            offer: {
                type: offer.type,
                sdp: offer.sdp
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            caller: auth.currentUser ? auth.currentUser.uid : null
        });

        // Listen for remote candidates and later answer
        this._answerListenerUnsub = callsRef.onSnapshot(async snapshot => {
            const data = snapshot.data();
            if (!data) return;
            if (data.answer && data.answer.sdp) {
                console.log('📩 answer geldi, setRemoteDescription yapılıyor');
                const answerDesc = new RTCSessionDescription(data.answer);
                try {
                    await pc.setRemoteDescription(answerDesc);
                } catch (e) {
                    console.warn('setRemoteDescription error (caller):', e);
                }
            }
        });
    }

    // Callee path: read offer, create pc, setRemote, create answer, write answer
    async _createAnswer(callsRef, offer) {
        const pc = await this._createPeerConnection('peer');
        this.peerConnections['peer'] = pc;

        const offerDesc = new RTCSessionDescription(offer);
        await pc.setRemoteDescription(offerDesc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // save answer into doc
        await callsRef.update({
            answer: {
                type: answer.type,
                sdp: answer.sdp
            },
            callee: auth.currentUser ? auth.currentUser.uid : null,
            answeredAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // Listen for candidate subcollection and add incoming candidates to PC
    _listenForCandidates(callsRef) {
        if (this._candidatesListenerUnsub) return; // already listening
        this._candidatesListenerUnsub = callsRef.collection('candidates')
            .orderBy('createdAt')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        const sender = data.sender;
                        const c = data.candidate;
                        // Avoid applying our own candidate
                        if (sender === auth.currentUser.uid) return;
                        const pc = this.peerConnections['peer'];
                        if (pc) {
                            pc.addIceCandidate(new RTCIceCandidate(c)).catch(e => console.warn('addIceCandidate err', e));
                            console.log('🟢 ICE candidate eklendi from', sender);
                        }
                    }
                });
            }, err => console.warn('candidates onSnapshot err', err));
    }

    _listenForAnswerAndCandidates(callsRef) {
        // for caller: already set _answerListenerUnsub in _createOffer. candidates listener set in _startSignaling.
        this._listenForCandidates(callsRef);
    }
}

// global instance
let voiceChat = null;
function initializeVoiceChat() {
    if (!voiceChat) {
        voiceChat = new VoiceChat();
        console.log('🎧 VoiceChat initialized');
    }
    return voiceChat;
}

// exported helpers
async function connectToVoiceChannel(channelName, channelId) {
    const v = initializeVoiceChat();
    await v.connectToVoiceChannel(channelName, channelId);
}

async function disconnectFromVoiceChannel() {
    if (voiceChat) await voiceChat.disconnectFromVoiceChannel();
}

// make available to window (optional)
window.connectToVoiceChannel = connectToVoiceChannel;
window.disconnectFromVoiceChannel = disconnectFromVoiceChannel;

// 🔊 Ses kanalı giriş sesi ve katılımcı listesi

VoiceChat.prototype.playJoinSound = function () {
    try {
        const audio = new Audio('/sounds/join.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    } catch (e) {
        console.warn('join sound error', e);
    }
};
// 🔊 Ses kanalından ayrılma sesi
VoiceChat.prototype.playLeaveSound = function () {
    try {
        const audio = new Audio('/sounds/leave.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    } catch (e) {
        console.warn('leave sound error', e);
    }
};


// 🔹 Ses kanalındaki kullanıcıları canlı listele
VoiceChat.prototype.watchVoiceParticipants = function (channelId) {
    const sidebar = document.getElementById('members-sidebar');
    if (!sidebar) return;

    // Eski listeyi kaldır
    let section = document.getElementById('voice-participants-section');
    if (section) section.remove();

    section = document.createElement('div');
    section.id = 'voice-participants-section';
    section.innerHTML = `
        <div style="margin-top:10px;border-top:1px solid #444;padding-top:8px;">
            <h4 style="font-size:13px;color:#bbb;">🎧 SES KANALINDAKİLER</h4>
            <div id="voice-participants-list" style="margin-top:6px;color:#fff;font-size:14px;"></div>
        </div>
    `;
    sidebar.appendChild(section);

    const listDiv = document.getElementById('voice-participants-list');
    if (!listDiv) return;

    // Canlı Firestore listener
    if (this._voiceWatchUnsub) this._voiceWatchUnsub();
    this._voiceWatchUnsub = db.collection('users')
        .where('inVoiceChannel', '==', true)
        .onSnapshot(snapshot => {
            listDiv.innerHTML = '';
            let found = 0;
            snapshot.forEach(doc => {
                // Kullanıcı farklarını bul (katılan / ayrılan)
const prevSet = new Set(prevUsers);
const newSet = new Set(newUsers);

newSet.forEach(u => {
    if (!prevSet.has(u)) this._showVoiceNotification(u, 'join');
});
prevSet.forEach(u => {
    if (!newSet.has(u)) this._showVoiceNotification(u, 'leave');
});
this._currentVoiceUsers = newUsers;

                const data = doc.data();
                if (data.currentVoiceChannel && data.currentVoiceChannel.id === channelId) {
                    found++;
                    const el = document.createElement('div');
                    el.style = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
                    el.innerHTML = `
                        <div style="width:26px;height:26px;border-radius:50%;background:${data.avatarColor || '#5865F2'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;">
                            ${data.username ? data.username.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span>${data.username || 'Kullanıcı'}</span>
                    `;
                    listDiv.appendChild(el);
                }
            });
            if (found === 0) {
                listDiv.innerHTML = `<div style="color:#888;font-size:13px;">Kimse yok</div>`;
            }
        });
};

// 🔹 Kanal ayrılınca listener temizle
VoiceChat.prototype.stopWatchingParticipants = function () {
    if (this._voiceWatchUnsub) {
        this._voiceWatchUnsub();
        this._voiceWatchUnsub = null;
    }
    const sec = document.getElementById('voice-participants-section');
    if (sec) sec.remove();
};
// 🔔 Ses kanalı katılma/ayrılma bildirimi
VoiceChat.prototype._showVoiceNotification = function (username, action = 'join') {
    const box = document.createElement('div');
    box.className = 'voice-notification-popup';
    box.style = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${action === 'join' ? '#3ba55d' : '#ed4245'};
        color: white;
        padding: 10px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 14px;
        font-weight: 500;
        z-index: 99999;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    const icon = action === 'join' ? 'fa-microphone' : 'fa-microphone-slash';
    box.innerHTML = `<i class="fas ${icon}"></i> ${username} ${action === 'join' ? 'katıldı' : 'ayrıldı'}`;

    document.body.appendChild(box);
    setTimeout(() => {
        box.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    }, 20);

    setTimeout(() => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(20px)';
        setTimeout(() => box.remove(), 400);
    }, 4000);
};
