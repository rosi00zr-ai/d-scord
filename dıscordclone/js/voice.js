// Sesli sohbet sistemi - TAMAMEN YENİLENDİ
class VoiceChat {
    constructor() {
        this.localStream = null;
        this.peerConnections = {};
        this.dataChannel = null;
        this.currentVoiceChannel = null;
        this.isConnected = false;
        this.localAudio = document.getElementById('local-audio');
        this.remoteAudios = document.getElementById('remote-audios');
        
        this.setupVoiceElements();
    }

    // Ses elementlerini kur
    setupVoiceElements() {
        // Yerel ses elementi yoksa oluştur
        if (!this.localAudio) {
            this.localAudio = document.createElement('audio');
            this.localAudio.id = 'local-audio';
            this.localAudio.autoplay = true;
            this.localAudio.muted = true;
            this.localAudio.style.display = 'none';
            document.body.appendChild(this.localAudio);
        }

        // Uzak sesler konteyneri yoksa oluştur
        if (!this.remoteAudios) {
            this.remoteAudios = document.createElement('div');
            this.remoteAudios.id = 'remote-audios';
            this.remoteAudios.style.display = 'none';
            document.body.appendChild(this.remoteAudios);
        }
    }

    // Ses kanalına bağlan
    async connectToVoiceChannel(channelName, channelId) {
        console.log('🎧 Ses kanalına bağlanılıyor:', channelName);
        
        try {
            // Mikrofon erişimi iste
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });

            // Yerel akışı ayarla
            this.localAudio.srcObject = this.localStream;
            
            this.currentVoiceChannel = { name: channelName, id: channelId };
            this.isConnected = true;

            // Ses kontrol panelini göster
            this.showVoiceControls(channelName);
            
            // Firestore'a ses durumunu güncelle
            await this.updateVoiceStatus(true);
            
            console.log('✅ Ses kanalına bağlanıldı:', channelName);
            
        } catch (error) {
            console.error('❌ Mikrofon erişimi hatası:', error);
            this.showVoiceError();
        }
    }

    // Ses kanalından ayrıl
    async disconnectFromVoiceChannel() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Peer bağlantılarını kapat
        Object.values(this.peerConnections).forEach(pc => pc.close());
        this.peerConnections = {};

        this.isConnected = false;
        this.currentVoiceChannel = null;

        // Ses kontrollerini gizle
        this.hideVoiceControls();

        // Firestore'a ses durumunu güncelle
        await this.updateVoiceStatus(false);

        console.log('🔇 Ses kanalından ayrıldı');
    }

    // Ses kontrol panelini göster
    showVoiceControls(channelName) {
        // Eski kontrol panelini temizle
        this.hideVoiceControls();

        const voicePanel = document.createElement('div');
        voicePanel.id = 'voice-control-panel';
        voicePanel.innerHTML = `
            <div class="voice-panel">
                <div class="voice-header">
                    <i class="fas fa-volume-up"></i>
                    <span>Sesli Sohbet - ${channelName}</span>
                    <button class="voice-disconnect-btn">
                        <i class="fas fa-phone-slash"></i>
                    </button>
                </div>
                <div class="voice-controls">
                    <div class="voice-control-group">
                        <button class="voice-control-btn mic-toggle active" id="mic-toggle">
                            <i class="fas fa-microphone"></i>
                        </button>
                        <span>Mikrofon</span>
                    </div>
                    <div class="voice-control-group">
                        <button class="voice-control-btn headphone-toggle active" id="headphone-toggle">
                            <i class="fas fa-headphones"></i>
                        </button>
                        <span>Ses</span>
                    </div>
                    <div class="voice-control-group">
                        <div class="voice-users">
                            <div class="voice-user">
                                <div class="user-avatar"></div>
                                <span>Sen</span>
                                <div class="voice-indicator"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="voice-status">
                    <div class="status-connected">
                        <i class="fas fa-circle"></i>
                        Ses kanalına bağlı
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(voicePanel);

        // Event listeners
        voicePanel.querySelector('.voice-disconnect-btn').addEventListener('click', () => {
            this.disconnectFromVoiceChannel();
        });

        voicePanel.querySelector('#mic-toggle').addEventListener('click', (e) => {
            this.toggleMicrophone(e.target.closest('.mic-toggle'));
        });

        voicePanel.querySelector('#headphone-toggle').addEventListener('click', (e) => {
            this.toggleHeadphones(e.target.closest('.headphone-toggle'));
        });
    }

    // Ses kontrol panelini gizle
    hideVoiceControls() {
        const existingPanel = document.getElementById('voice-control-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
    }

    // Mikrofonu aç/kapa
    toggleMicrophone(button) {
        if (!this.localStream) return;

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            button.classList.toggle('active', audioTrack.enabled);
            button.classList.toggle('muted', !audioTrack.enabled);
            
            console.log('🎤 Mikrofon:', audioTrack.enabled ? 'Açık' : 'Kapalı');
        }
    }

    // Kulaklığı aç/kapa
    toggleHeadphones(button) {
        const audioElements = document.querySelectorAll('audio');
        const isMuted = audioElements[0]?.muted || false;
        
        audioElements.forEach(audio => {
            audio.muted = !isMuted;
        });

        button.classList.toggle('active', !isMuted);
        button.classList.toggle('muted', isMuted);
        
        console.log('🔊 Ses:', isMuted ? 'Açık' : 'Kapalı');
    }

    // Ses durumunu Firestore'a kaydet
    async updateVoiceStatus(isInVoiceChannel) {
        const user = auth.currentUser;
        if (!user) return;

        try {
            await db.collection('users').doc(user.uid).update({
                inVoiceChannel: isInVoiceChannel,
                currentVoiceChannel: isInVoiceChannel ? this.currentVoiceChannel : null,
                voiceStatusUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Ses durumu güncelleme hatası:', error);
        }
    }

    // Ses hatası göster
    showVoiceError() {
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--dnd-color);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        errorMsg.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            Mikrofon erişimi reddedildi
        `;
        
        document.body.appendChild(errorMsg);
        
        setTimeout(() => {
            errorMsg.remove();
        }, 5000);
    }
}

// Global voice chat instance
let voiceChat = null;

// Ses sistemi başlat
function initializeVoiceChat() {
    if (!voiceChat) {
        voiceChat = new VoiceChat();
        console.log('🎧 Ses sistemi başlatıldı');
    }
    return voiceChat;
}

// Ses kanalına bağlan fonksiyonu
async function connectToVoiceChannel(channelName, channelId) {
    const voiceSystem = initializeVoiceChat();
    await voiceSystem.connectToVoiceChannel(channelName, channelId);
}