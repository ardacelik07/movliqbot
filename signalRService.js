const signalR = require('@microsoft/signalr');

class SignalRService {
    constructor() {
        this.connection = null;
        this.isConnected = false;
        this.activeRoomId = null;
        this.locationUpdateIntervals = {};
        // Kullanıcı hareketlerini takip etmek için
        this.userStats = {};
        // Yarış durumunu takip etmek için
        this.isRacing = false;
    }

    // SignalR bağlantısını başlat
    async startConnection(token) {
        if (this.connection) {
            console.log('Bağlantı zaten mevcut, yenisi oluşturulmayacak.');
            return;
        }

        console.log('SignalR bağlantısı başlatılıyor...');
        
        try {
            // SignalR bağlantısını oluştur
            this.connection = new signalR.HubConnectionBuilder()
                .withUrl('https://backend.movliq.com/racehub', {
                    accessTokenFactory: () => token
                })
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Information)
                .build();

            // Dinleyiciler ekle
            this.registerListeners();

            // Bağlantıyı başlat
            await this.connection.start();
            this.isConnected = true;
            console.log('SignalR bağlantısı başarıyla kuruldu.');
        } catch (error) {
            console.error('SignalR bağlantısı kurulurken hata oluştu:', error);
            this.isConnected = false;
        }
    }

    // Bağlantı kapatma
    async stopConnection() {
        if (this.connection) {
            // Tüm konum güncelleme intervallerini temizle
            this.stopAllLocationUpdates();
            
            try {
                // Eğer aktif bir oda varsa, odadan çık
                if (this.activeRoomId) {
                    await this.leaveRoom(this.activeRoomId);
                }
                
                // Bağlantıyı kapat
                await this.connection.stop();
                console.log('SignalR bağlantısı kapatıldı.');
                this.connection = null;
                this.isConnected = false;
            } catch (error) {
                console.error('SignalR bağlantısı kapatılırken hata oluştu:', error);
            }
        }
    }

    // Dinleyicileri kaydet
    registerListeners() {
        this.connection.on('UserJoined', (userName) => {
            console.log(`Kullanıcı katıldı: ${userName}`);
        });

        this.connection.on('UserLeft', (userName) => {
            console.log(`Kullanıcı ayrıldı: ${userName}`);
        });

        this.connection.on('RoomParticipants', (participants) => {
            console.log(`Odadaki katılımcılar:`, participants);
        });

        this.connection.on('LocationUpdated', (email, distance, steps) => {
            console.log(`Konum güncellendi - Email: ${email}, Mesafe: ${distance}, Adım: ${steps}`);
        });

        this.connection.on('RaceAlreadyStarted', (data) => {
            console.log(`Yarış zaten başlamış! Oda: ${data.RoomId}, Kalan süre: ${data.RemainingTimeSeconds} saniye`);
            // Yarış başlamışsa, konum güncellemesini başlat
            this.startLocationUpdates(data.RoomId);
        });

        this.connection.on('RaceEnded', (data) => {
            console.log(`Yarış bitti! Oda: ${data.RoomId}`);
            // Yarış bittiyse, konum güncellemesini durdur
            this.stopLocationUpdates(data.RoomId);
            // Yarış bittiğinde botun durumunu güncelle
            if (this.activeRoomId === data.RoomId) {
                this.isRacing = false;
                this.activeRoomId = null;
            }
        });
        
        // Ek olarak StartRace eventini de dinleyelim
        this.connection.on('StartRace', (data) => {
            console.log(`Yarış başladı! Oda: ${data.RoomId}`);
            // Yarış başladığında konum güncellemelerini başlat
            this.startLocationUpdates(data.RoomId);
        });
    }

    // Odaya katılma
    async joinRoom(roomId) {
        if (!this.isConnected || !this.connection) {
            console.error('SignalR bağlantısı kurulmadan odaya katılınamaz!');
            return false;
        }

        // Eğer zaten bir yarışa katılmış ise ve o yarış devam ediyorsa, yeni yarışa katılmayı engelle
        if (this.isRacing && this.activeRoomId !== null && this.activeRoomId !== roomId) {
            console.error(`Bot zaten ${this.activeRoomId} ID'li odada yarışıyor. Aynı anda birden fazla yarışa katılamaz!`);
            return false;
        }

        try {
            console.log(`${roomId} ID'li odaya SignalR üzerinden katılma isteği gönderiliyor...`);
            await this.connection.invoke('JoinRoom', roomId);
            this.activeRoomId = roomId;
            this.isRacing = true;
            console.log(`${roomId} ID'li odaya SignalR üzerinden başarıyla katıldı!`);
            
            //Odaya katılır katılmaz konum güncellemelerini başlat
            this.startLocationUpdates(roomId);
            
            return true;
        } catch (error) {
            console.error(`${roomId} ID'li odaya SignalR üzerinden katılırken hata oluştu:`, error);
            return false;
        }
    }

    // Odadan ayrılma
    async leaveRoom(roomId) {
        if (!this.isConnected || !this.connection) {
            console.error('SignalR bağlantısı kurulmadan odadan ayrılınamaz!');
            return false;
        }

        try {
            console.log(`${roomId} ID'li odadan SignalR üzerinden ayrılma isteği gönderiliyor...`);
            await this.connection.invoke('LeaveRoom', roomId);
            this.activeRoomId = null;
            this.isRacing = false;
            console.log(`${roomId} ID'li odadan SignalR üzerinden başarıyla ayrıldı!`);
            // İlgili konum güncelleme intervalini temizle
            this.stopLocationUpdates(roomId);
            return true;
        } catch (error) {
            console.error(`${roomId} ID'li odadan SignalR üzerinden ayrılırken hata oluştu:`, error);
            return false;
        }
    }

    // Konum güncelleme (her 5 saniyede bir)
    startLocationUpdates(roomId) {
        // Eğer bu oda için zaten bir interval varsa, durdur
        this.stopLocationUpdates(roomId);

        console.log(`${roomId} ID'li oda için konum güncellemeleri başlatılıyor...`);
        
        // 10 saniye gecikme ile başlat
        console.log(`Konum güncellemeleri 10 saniye sonra başlayacak...`);
        setTimeout(() => {
            // Kullanıcı istatistiklerini başlat
            if (!this.userStats[roomId]) {
                this.userStats[roomId] = {
                    totalDistance: 0,     // Toplam mesafe (metre)
                    totalSteps: 0,        // Toplam adım
                    totalCalories: 0,     // Toplam kalori
                    lastUpdateTime: Date.now(),
                    timeChunks: 0
                };
            }
            
            // Her 5 saniyede bir konum güncelle
            this.locationUpdateIntervals[roomId] = setInterval(async () => {
                if (!this.isConnected || !this.connection) {
                    this.stopLocationUpdates(roomId);
                    return;
                }

                const stats = this.userStats[roomId];
                const now = Date.now();
                const elapsedSec = (now - stats.lastUpdateTime) / 1000; // Son güncellemeden bu yana geçen süre (saniye)
                stats.lastUpdateTime = now;
                
                // Rastgele değerler seçelim (0.01, 0.02 veya 0.03)
                const possibleDistances = [0.01, 0.02, 0.03]; // Backend'de 10, 20, 30 metre
                const possibleSteps = [11, 27, 36]; // Mesafelere karşılık gelen adım sayıları
                
                // Rastgele bir indeks seçelim
                const randomIndex = Math.floor(Math.random() * possibleDistances.length);
                
                // Mesafe ve adım sayısını bu indekse göre belirleyelim
                const adjustedDistance = possibleDistances[randomIndex];
                const stepsForDistance = possibleSteps[randomIndex];
                
                // Kalori (gerçekçi bir değer, adım sayısı ile orantılı)
                const calories = Math.floor(stepsForDistance * 0.05);
                
                // Toplam değerleri güncelle
                stats.totalDistance += adjustedDistance;
                stats.totalSteps += stepsForDistance;
                stats.totalCalories += calories;
                
                // Zaman dilimlerini takip et (her 30 saniye bir kontrolü için)
                stats.timeChunks += elapsedSec / 30; // 30 saniyelik dilimleri say
                
                try {
                    console.log(`Konum güncelleniyor - Oda: ${roomId}, Mesafe: ${stats.totalDistance.toFixed(2)}m, Adım: ${stats.totalSteps}, Kalori: ${stats.totalCalories}`);
                    console.log(`Bu güncelleme: +${adjustedDistance.toFixed(3)}m (${adjustedDistance * 1000} metre), +${stepsForDistance} adım, +${calories} kalori`);
                    
                    // UpdateLocation metodu çağrısı (roomId, distance, steps, calories parametreleriyle)
                    await this.connection.invoke('UpdateLocation', roomId, stats.totalDistance, stats.totalSteps, stats.totalCalories);
                    
                    console.log(`Konum güncelleme isteği gönderildi.`);
                    
                    // Her 30 saniyede bir hile kontrolünü simüle et
                    if (stats.timeChunks >= 1) {
                        // Bu durumda 30 saniyede toplam mesafe değişkenlik gösterecek
                        const avgDistancePerUpdate = (possibleDistances[0] + possibleDistances[1] + possibleDistances[2]) / 3;
                        const chunkDistance = avgDistancePerUpdate * 6; // 5 saniyelik 6 güncelleme
                        const actualSteps = Math.floor(stepsForDistance * 6); // Ortalama adım sayısı
                        
                        console.log(`30 saniyelik kontrol - Ortalama Mesafe: ${chunkDistance.toFixed(3)}m, Atılan adım: ${actualSteps}`);
                        
                        // Kontrol sonrası sayacı sıfırla
                        stats.timeChunks = 0;
                    }
                    
                } catch (error) {
                    console.error(`Konum güncellenirken hata oluştu:`, error);
                    console.error(`Hata detayı:`, error.message);
                    
                    // Hata devam ederse intervali temizle
                    if (error.message && error.message.includes('connection')) {
                        console.error(`Bağlantı hatası nedeniyle konum güncellemeleri durduruluyor.`);
                        this.stopLocationUpdates(roomId);
                    }
                }
            }, 5000); // 5 saniyede bir
            
            console.log(`${roomId} ID'li oda için konum güncellemeleri başlatıldı. 5 saniyede bir güncellenecek.`);
        }, 10000); // 10 saniye bekle
    }

    // Belirli bir oda için konum güncellemesini durdur
    stopLocationUpdates(roomId) {
        if (this.locationUpdateIntervals[roomId]) {
            clearInterval(this.locationUpdateIntervals[roomId]);
            delete this.locationUpdateIntervals[roomId];
            console.log(`${roomId} ID'li oda için konum güncellemeleri durduruldu.`);
        }
    }

    // Tüm konum güncellemelerini durdur
    stopAllLocationUpdates() {
        Object.keys(this.locationUpdateIntervals).forEach(roomId => {
            this.stopLocationUpdates(parseInt(roomId));
        });
    }
    
    // Manuel olarak konum güncellemesini tetikle (test için)
    async manuallyUpdateLocation(roomId) {
        if (!this.isConnected || !this.connection) {
            console.error('SignalR bağlantısı kurulmadan konum güncellenemez!');
            return false;
        }
        
        try {
            if (!this.userStats[roomId]) {
                this.userStats[roomId] = {
                    totalDistance: 0,
                    totalSteps: 0,
                    totalCalories: 0,
                    lastUpdateTime: Date.now(),
                    timeChunks: 0
                };
            }
            
            const stats = this.userStats[roomId];
            
            // Rastgele değerler seçelim (0.01, 0.02 veya 0.03)
            const possibleDistances = [0.01, 0.02, 0.03]; // Backend'de 10, 20, 30 metre
            const possibleSteps = [11, 27, 36]; // Mesafelere karşılık gelen adım sayıları
            
            // Rastgele bir indeks seçelim
            const randomIndex = Math.floor(Math.random() * possibleDistances.length);
            
            // Mesafe ve adım sayısını bu indekse göre belirleyelim
            const distance = possibleDistances[randomIndex];
            const steps = possibleSteps[randomIndex];
            
            const calories = Math.floor(steps * 0.05);
            
            stats.totalDistance += distance;
            stats.totalSteps += steps;
            stats.totalCalories += calories;
            
            console.log(`Manuel konum güncelleniyor - Oda: ${roomId}, Toplam Mesafe: ${stats.totalDistance.toFixed(3)}m, Toplam Adım: ${stats.totalSteps}, Toplam Kalori: ${stats.totalCalories}`);
            console.log(`Bu güncelleme: +${distance.toFixed(3)}m (${distance * 1000} metre), +${steps} adım, +${calories} kalori`);
            await this.connection.invoke('UpdateLocation', roomId, stats.totalDistance, stats.totalSteps, stats.totalCalories);
            console.log('Manuel konum güncelleme başarılı!');
            return true;
        } catch (error) {
            console.error('Manuel konum güncellenirken hata oluştu:', error);
            return false;
        }
    }
}

module.exports = SignalRService; 