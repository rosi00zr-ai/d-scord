document.addEventListener('DOMContentLoaded', function() {
    const serversSidebar = document.querySelector('.servers-sidebar');
    const channelsList = document.querySelector('.channels-list');
    
    // Örnek sunucu verileri
    const servers = [
        { id: 1, name: 'Genel', icon: '🌍' },
        { id: 2, name: 'Oyun', icon: '🎮' },
        { id: 3, name: 'Müzik', icon: '🎵' },
        { id: 4, name: 'Film', icon: '🎬' }
    ];
    
    // Örnek kanal verileri
    const channels = {
        1: [
            { category: 'METİN KANALLARI', channels: [
                { id: 1, name: 'genel', type: 'text' },
                { id: 2, name: 'yardım', type: 'text' },
                { id: 3, name: 'duyurular', type: 'text' }
            ]},
            { category: 'SES KANALLARI', channels: [
                { id: 4, name: 'Genel Ses', type: 'voice' },
                { id: 5, name: 'Müzik Dinleme', type: 'voice' }
            ]}
        ],
        2: [
            { category: 'METİN KANALLARI', channels: [
                { id: 6, name: 'oyun-haberleri', type: 'text' },
                { id: 7, name: 'takım-arıyorum', type: 'text' }
            ]},
            { category: 'SES KANALLARI', channels: [
                { id: 8, name: 'Oyun Ses 1', type: 'voice' },
                { id: 9, name: 'Oyun Ses 2', type: 'voice' }
            ]}
        ]
    };
    
    // Sunucuları yükle
    function loadServers() {
        serversSidebar.innerHTML = '';
        
        servers.forEach(server => {
            const serverElement = document.createElement('div');
            serverElement.className = 'server-icon';
            serverElement.innerHTML = server.icon;
            serverElement.setAttribute('data-server-id', server.id);
            
            serverElement.addEventListener('click', function() {
                // Aktif sunucuyu güncelle
                document.querySelectorAll('.server-icon').forEach(icon => {
                    icon.classList.remove('active');
                });
                this.classList.add('active');
                
                // Kanal listesini yükle
                loadChannels(server.id, server.name);
            });
            
            serversSidebar.appendChild(serverElement);
        });
        
        // Sunucu ekleme butonu
        const addServer = document.createElement('div');
        addServer.className = 'server-icon add-server';
        addServer.innerHTML = '+';
        addServer.addEventListener('click', function() {
            alert('Yeni sunucu oluşturma özelliği yakında eklenecek!');
        });
        serversSidebar.appendChild(addServer);
        
        // İlk sunucuyu aktif yap
        if (servers.length > 0) {
            serversSidebar.firstChild.click();
        }
    }
    
    // Kanalları yükle
    function loadChannels(serverId, serverName) {
        // Sunucu adını güncelle
        document.getElementById('current-server-name').textContent = serverName;
        
        // Kanalları temizle
        channelsList.innerHTML = '';
        
        const serverChannels = channels[serverId] || [];
        
        serverChannels.forEach(categoryData => {
            // Kategori oluştur
            const categoryElement = document.createElement('div');
            categoryElement.className = 'channel-category';
            
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            categoryHeader.innerHTML = `
                <span>${categoryData.category}</span>
                <i class="fas fa-plus"></i>
            `;
            
            categoryElement.appendChild(categoryHeader);
            
            // Kanal öğelerini oluştur
            categoryData.channels.forEach(channel => {
                const channelElement = document.createElement('div');
                channelElement.className = 'channel-item';
                channelElement.setAttribute('data-channel-id', channel.id);
                
                const icon = channel.type === 'text' ? 'fas fa-hashtag' : 'fas fa-volume-up';
                channelElement.innerHTML = `
                    <i class="${icon}"></i>
                    <span>${channel.name}</span>
                `;
                
                channelElement.addEventListener('click', function() {
                    // Aktif kanalı güncelle
                    document.querySelectorAll('.channel-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    this.classList.add('active');
                    
                    // Kanal adını güncelle
                    document.getElementById('current-channel-name').textContent = channel.name;
                    
                    // Mesajları yükle
                    loadMessages(channel.id);
                });
                
                categoryElement.appendChild(channelElement);
            });
            
            channelsList.appendChild(categoryElement);
        });
        
        // İlk kanalı aktif yap
        const firstChannel = channelsList.querySelector('.channel-item');
        if (firstChannel) {
            firstChannel.click();
        }
    }
    
    // Sunucuları başlat
    loadServers();
});