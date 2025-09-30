const signalR = require("@microsoft/signalr");

class SignalRService {
    constructor() {
        this.connection = null;
        this.isConnected = false;
        this.activeRooms = []; // Birden fazla oda desteği için array
        this.locationUpdateIntervals = {};
        // Kullanıcı hareketlerini takip etmek için (oda bazlı)
        this.userStats = {};
        // Yarış durumunu takip etmek için (oda bazlı)
        this.roomRacingStatus = {};
    }

    // SignalR bağlantısını başlat
    async startConnection(token) {
        if (this.connection) {
            console.log("Bağlantı zaten mevcut, yenisi oluşturulmayacak.");
            return;
        }

        console.log("SignalR bağlantısı başlatılıyor...");

        try {
            // SignalR bağlantısını oluştur
            this.connection = new signalR.HubConnectionBuilder()
                .withUrl("https://backend.movliq.com/racehub", {
                    accessTokenFactory: () => token,
                })
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Information)
                .build();

            // Dinleyiciler ekle
            this.registerListeners();

            // Bağlantıyı başlat
            await this.connection.start();
            this.isConnected = true;
            console.log("SignalR bağlantısı başarıyla kuruldu.");
        } catch (error) {
            console.error("SignalR bağlantısı kurulurken hata oluştu:", error);
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
                console.log("SignalR bağlantısı kapatıldı.");
                this.connection = null;
                this.isConnected = false;
            } catch (error) {
                console.error(
                    "SignalR bağlantısı kapatılırken hata oluştu:",
                    error,
                );
            }
        }
    }

    // Dinleyicileri kaydet
    registerListeners() {
        this.connection.on("UserJoined", (userName) => {
            console.log(`Kullanıcı katıldı: ${userName}`);
        });

        this.connection.on("UserLeft", (userName) => {
            console.log(`Kullanıcı ayrıldı: ${userName}`);
        });

        this.connection.on("RoomParticipants", (participants) => {
            console.log(`Odadaki katılımcılar:`, participants);
        });

        this.connection.on("LocationUpdated", (email, distance, steps) => {
            console.log(
                `Konum güncellendi - Email: ${email}, Mesafe: ${distance}, Adım: ${steps}`,
            );
        });

        this.connection.on("RaceAlreadyStarted", (data) => {
            console.log(
                `Yarış zaten başlamış! Oda: ${data.RoomId}, Kalan süre: ${data.RemainingTimeSeconds} saniye`,
            );
            // Yarış başlamışsa, konum güncellemesini başlat
            this.startLocationUpdates(data.RoomId);
        });

        this.connection.on("RaceEnded", (data) => {
            console.log(`Yarış bitti! Oda: ${data.RoomId}`);
            // Yarış bittiyse, konum güncellemesini durdur
            this.stopLocationUpdates(data.RoomId);
            // Yarış bittiğinde oda durumunu güncelle
            this.roomRacingStatus[data.RoomId] = false;
            // Aktif odalar listesinden çıkar
            this.activeRooms = this.activeRooms.filter(
                (roomId) => roomId !== data.RoomId,
            );
        });

        // Ek olarak StartRace eventini de dinleyelim
        this.connection.on("StartRace", (data) => {
            console.log(`Yarış başladı! Oda: ${data.RoomId}`);
            // Yarış başladığında konum güncellemelerini başlat
            this.startLocationUpdates(data.RoomId);
        });
    }

    // Odaya katılma
    async joinRoom(roomId) {
        if (!this.isConnected || !this.connection) {
            console.error("SignalR bağlantısı kurulmadan odaya katılınamaz!");
            return false;
        }

        // Eğer zaten bu odaya katılmışsa, tekrar katılma
        if (this.activeRooms.includes(roomId)) {
            console.log(
                `${roomId} ID'li odaya zaten katılmış, tekrar katılım yapılmıyor.`,
            );
            return true;
        }

        try {
            console.log(
                `${roomId} ID'li odaya SignalR üzerinden katılma isteği gönderiliyor...`,
            );
            await this.connection.invoke("JoinRoom", roomId);

            // Aktif odalar listesine ekle
            this.activeRooms.push(roomId);
            this.roomRacingStatus[roomId] = true;

            console.log(
                `${roomId} ID'li odaya SignalR üzerinden başarıyla katıldı!`,
            );
            console.log(`Aktif odalar: [${this.activeRooms.join(", ")}]`);

            //Odaya katılır katılmaz konum güncellemelerini başlat
            this.startLocationUpdates(roomId);

            return true;
        } catch (error) {
            console.error(
                `${roomId} ID'li odaya SignalR üzerinden katılırken hata oluştu:`,
                error,
            );
            return false;
        }
    }

    // Odadan ayrılma
    async leaveRoom(roomId) {
        if (!this.isConnected || !this.connection) {
            console.error("SignalR bağlantısı kurulmadan odadan ayrılınamaz!");
            return false;
        }

        try {
            console.log(
                `${roomId} ID'li odadan SignalR üzerinden ayrılma isteği gönderiliyor...`,
            );
            await this.connection.invoke("LeaveRoom", roomId);

            // Aktif odalar listesinden çıkar
            this.activeRooms = this.activeRooms.filter((id) => id !== roomId);
            this.roomRacingStatus[roomId] = false;

            console.log(
                `${roomId} ID'li odadan SignalR üzerinden başarıyla ayrıldı!`,
            );
            console.log(`Kalan aktif odalar: [${this.activeRooms.join(", ")}]`);

            // İlgili konum güncelleme intervalini temizle
            this.stopLocationUpdates(roomId);
            return true;
        } catch (error) {
            console.error(
                `${roomId} ID'li odadan SignalR üzerinden ayrılırken hata oluştu:`,
                error,
            );
            return false;
        }
    }

    // Konum güncelleme (her 5 saniyede bir)
    startLocationUpdates(roomId) {
        // Eğer bu oda için zaten bir interval varsa, durdur
        this.stopLocationUpdates(roomId);

        console.log(
            `${roomId} ID'li oda için konum güncellemeleri başlatılıyor...`,
        );
        console.log(`Toplam aktif oda sayısı: ${this.activeRooms.length}`);

        // 10 saniye gecikme ile başlat
        console.log(`Konum güncellemeleri 10 saniye sonra başlayacak...`);
        setTimeout(() => {
            // Kullanıcı istatistiklerini başlat (oda bazlı)
            if (!this.userStats[roomId]) {
                this.userStats[roomId] = {
                    totalDistance: 0, // Toplam mesafe (metre)
                    totalSteps: 0, // Toplam adım
                    totalCalories: 0, // Toplam kalori
                    lastUpdateTime: Date.now(),
                    timeChunks: 0,
                };
            }

            // Her 5 saniyede bir konum güncelle
            this.locationUpdateIntervals[roomId] = setInterval(async () => {
                if (!this.isConnected || !this.connection) {
                    this.stopLocationUpdates(roomId);
                    return;
                }

                // Bu oda hala aktif mi kontrol et
                if (!this.activeRooms.includes(roomId)) {
                    console.log(
                        `${roomId} ID'li oda artık aktif değil, konum güncellemeleri durduruluyor.`,
                    );
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
                const randomIndex = Math.floor(
                    Math.random() * possibleDistances.length,
                );

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
                    console.log(
                        `[ODA ${roomId}] Konum güncelleniyor - Mesafe: ${stats.totalDistance.toFixed(2)}m, Adım: ${stats.totalSteps}, Kalori: ${stats.totalCalories}`,
                    );
                    console.log(
                        `[ODA ${roomId}] Bu güncelleme: +${adjustedDistance.toFixed(3)}m (${adjustedDistance * 1000} metre), +${stepsForDistance} adım, +${calories} kalori`,
                    );

                    // Pace hesapla (dakika/km) - mesafe 0'dan büyükse hesapla, değilse 0
                    const pace =
                        stats.totalDistance > 0
                            ? stats.totalSteps / stats.totalDistance / 1000
                            : 0;

                    // UpdateLocation metodu çağrısı - 5 parametre ile
                    await this.connection.invoke(
                        "UpdateLocation",
                        roomId,
                        stats.totalDistance,
                        stats.totalSteps,
                        stats.totalCalories,
                        pace,
                    );

                    console.log(
                        `[ODA ${roomId}] ✅ Konum güncelleme isteği başarıyla gönderildi! (Pace: ${pace.toFixed(2)})`,
                    );

                    // Her 30 saniyede bir hile kontrolünü simüle et
                    if (stats.timeChunks >= 1) {
                        const avgDistancePerUpdate =
                            (possibleDistances[0] +
                                possibleDistances[1] +
                                possibleDistances[2]) /
                            3;
                        const chunkDistance = avgDistancePerUpdate * 6;
                        const actualSteps = Math.floor(stepsForDistance * 6);

                        console.log(
                            `[ODA ${roomId}] 30 saniyelik kontrol - Ortalama Mesafe: ${chunkDistance.toFixed(3)}m, Atılan adım: ${actualSteps}`,
                        );
                        stats.timeChunks = 0;
                    }
                } catch (error) {
                    console.error(
                        `[ODA ${roomId}] ❌ Konum güncellenirken hata oluştu:`,
                        error,
                    );
                    console.error(
                        `[ODA ${roomId}] Hata detayı:`,
                        error.message,
                    );

                    // Bağlantı hatası durumunda intervali temizle
                    if (
                        error.message &&
                        (error.message.includes("connection") ||
                            error.message.includes("Connection"))
                    ) {
                        console.error(
                            `[ODA ${roomId}] ❌ Bağlantı hatası nedeniyle konum güncellemeleri durduruluyor.`,
                        );
                        this.stopLocationUpdates(roomId);
                    }
                }
            }, 5000); // 5 saniyede bir

            console.log(
                `${roomId} ID'li oda için konum güncellemeleri başlatıldı. 5 saniyede bir güncellenecek.`,
            );
        }, 10000); // 10 saniye bekle
    }

    // Belirli bir oda için konum güncellemesini durdur
    stopLocationUpdates(roomId) {
        if (this.locationUpdateIntervals[roomId]) {
            clearInterval(this.locationUpdateIntervals[roomId]);
            delete this.locationUpdateIntervals[roomId];
            console.log(
                `${roomId} ID'li oda için konum güncellemeleri durduruldu.`,
            );
        }
    }

    // Tüm konum güncellemelerini durdur
    stopAllLocationUpdates() {
        Object.keys(this.locationUpdateIntervals).forEach((roomId) => {
            this.stopLocationUpdates(parseInt(roomId));
        });
    }

    // Manuel olarak konum güncellemesini tetikle (test için)
    async manuallyUpdateLocation(roomId) {
        if (!this.isConnected || !this.connection) {
            console.error("SignalR bağlantısı kurulmadan konum güncellenemez!");
            return false;
        }

        try {
            if (!this.userStats[roomId]) {
                this.userStats[roomId] = {
                    totalDistance: 0,
                    totalSteps: 0,
                    totalCalories: 0,
                    lastUpdateTime: Date.now(),
                    timeChunks: 0,
                };
            }

            const stats = this.userStats[roomId];

            // Rastgele değerler seçelim
            const possibleDistances = [0.01, 0.02, 0.03];
            const possibleSteps = [11, 27, 36];

            const randomIndex = Math.floor(
                Math.random() * possibleDistances.length,
            );
            const distance = possibleDistances[randomIndex];
            const steps = possibleSteps[randomIndex];
            const calories = Math.floor(steps * 0.05);

            stats.totalDistance += distance;
            stats.totalSteps += steps;
            stats.totalCalories += calories;

            // Pace hesapla
            const pace =
                stats.totalDistance > 0
                    ? stats.totalSteps / stats.totalDistance / 1000
                    : 0;

            console.log(
                `[ODA ${roomId}] Manuel konum güncelleniyor - Toplam Mesafe: ${stats.totalDistance.toFixed(3)}m, Toplam Adım: ${stats.totalSteps}, Toplam Kalori: ${stats.totalCalories}, Pace: ${pace.toFixed(2)}`,
            );
            console.log(
                `[ODA ${roomId}] Bu güncelleme: +${distance.toFixed(3)}m, +${steps} adım, +${calories} kalori`,
            );

            // 5 parametre ile çağır
            await this.connection.invoke(
                "UpdateLocation",
                roomId,
                stats.totalDistance,
                stats.totalSteps,
                stats.totalCalories,
                pace,
            );
            console.log(`[ODA ${roomId}] ✅ Manuel konum güncelleme başarılı!`);
            return true;
        } catch (error) {
            console.error(
                `[ODA ${roomId}] ❌ Manuel konum güncellenirken hata oluştu:`,
                error,
            );
            return false;
        }
    }
}

module.exports = SignalRService;
