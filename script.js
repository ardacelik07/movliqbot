const axios = require('axios');
require('dotenv').config();
const SignalRService = require('./signalRService');

// API endpoint 
const BASE_URL = 'https://backend.movliq.com/api';
const API_ENDPOINTS = {
  login: `${BASE_URL}/User/login`,
  getActiveRooms: `${BASE_URL}/RaceRoom/GetActivePublicNonCreatedRooms`,
  joinRoom: `${BASE_URL}/RaceRoom/match-room-roomId`
};

// Kullanıcı bilgileri doğrudan script içerisinde tanımlanmış
const credentials = [
  {
    email: "bot1@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot2@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot3@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot4@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot5@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot6@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot7@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot8@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot9@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot10@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot11@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot25@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot26@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot27@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot28@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot29@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot30@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot31@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot32@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot33@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot34@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot35@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot36@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot37@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot38@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot39@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot40@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot41@gmail.com",
    password: "Ahmetto10"
  },
  {
    email: "bot42@gmail.com",
    password: "Ahmetto10"
  }
];

// Aktif kullanıcıları saklayacak dizi
const activeUsers = [];

// Kullanıcıların katıldığı odaları takip etmek için
const userJoinedRooms = {};

// Kullanıcıların SignalR servislerini takip etmek için
const userSignalRServices = {};

// Son istek zamanlarını takip etmek için
const lastJoinRequests = {};

// Odaların durumunu takip etmek için
const roomStatus = {};

// Odaya istekleri arasındaki bekleme süresi (milisaniye)
const JOIN_REQUEST_DELAY = 15000; // 15 saniye

// Kesme tarihini hesapla (72 saat öncesi)
function getCutoffDate() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 72);
  return cutoff;
}

// Login işlemini gerçekleştiren fonksiyon
async function login(email, password) {
  try {
    console.log(`${email} için login deneniyor...`);
    
    const response = await axios.post(API_ENDPOINTS.login, {
      email,
      password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*'
      },
      timeout: 10000 // 10 saniye timeout ekleyelim
    });

    console.log(`Login başarılı: ${email}`);
    console.log('Login yanıtı:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Login başarısız (${email}):`, error.message);
    if (error.response) {
      console.error('Sunucu yanıtı:', error.response.status, error.response.data);
    }
    return null;
  }
}

// Aktif odaları getiren fonksiyon
async function getActiveRooms(accessToken) {
  try {
    console.log('Aktif odalar getiriliyor...');
    
    const response = await axios.get(API_ENDPOINTS.getActiveRooms, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': '*/*'
      },
      timeout: 10000
    });

    console.log(`Toplam ${response.data.length} adet aktif oda bulundu.`);
    
    // Odaların durumunu güncelle
    response.data.forEach(room => {
      if (!roomStatus[room.id]) {
        roomStatus[room.id] = {
          id: room.id,
          name: room.roomName,
          createdAt: room.createdAt,
          startTime: room.startTime,
          maxParticipants: room.maxParticipants || 6
        };
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Odalar getirilirken hata oluştu:', error.message);
    if (error.response) {
      console.error('Sunucu yanıtı:', error.response.status, error.response.data);
    }
    return [];
  }
}

// Odaya katılma fonksiyonu
async function joinRoom(accessToken, roomId, email) {
  try {
    // Son istek zamanını kontrol et
    const lastRequestTime = lastJoinRequests[roomId] || 0;
    const now = Date.now();
    
    // Aynı oda için son istekten sonra yeterli süre geçmemişse bekle
    if (now - lastRequestTime < JOIN_REQUEST_DELAY) {
      const waitTime = JOIN_REQUEST_DELAY - (now - lastRequestTime);
      console.log(`${roomId} ID'li oda için son istekten sonra yeterli süre geçmemiş, ${waitTime/1000} saniye bekleniyor...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    console.log(`${email} kullanıcısı ${roomId} ID'li odaya katılma isteği gönderiliyor...`);
    
    // İstek zamanını güncelle
    lastJoinRequests[roomId] = Date.now();
    
    const response = await axios.post(API_ENDPOINTS.joinRoom, {
      roomId: roomId
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': '*/*'
      },
      timeout: 10000
    });

    console.log(`${email} kullanıcısı ${roomId} ID'li odaya başarıyla katıldı!`);
    
    // Kullanıcının katıldığı odaları kaydet
    if (!userJoinedRooms[email]) {
      userJoinedRooms[email] = [];
    }
    userJoinedRooms[email].push(roomId);
    
    // API'ye katıldıktan sonra SignalR ile de odaya katıl
    await connectToSignalR(email, accessToken, roomId);
    
    return true;
  } catch (error) {
    console.error(`${roomId} ID'li odaya katılırken hata oluştu:`, error.message);
    if (error.response) {
      console.error('Sunucu yanıtı:', error.response.status, error.response.data);
      
      // "Zaten odadasınız" hatası
      if (error.response.status === 400 && error.response.data.includes("zaten oda")) {
        // Kullanıcı zaten odada olarak işaretle
        if (!userJoinedRooms[email]) {
          userJoinedRooms[email] = [];
        }
        if (!userJoinedRooms[email].includes(roomId)) {
          userJoinedRooms[email].push(roomId);
        }
        
        // SignalR ile odaya katıl (API'ye katılmış olsa bile)
        await connectToSignalR(email, accessToken, roomId);
      }
    }
    return false;
  }
}

// SignalR ile odaya bağlanma
async function connectToSignalR(email, accessToken, roomId) {
  try {
    // Kullanıcının SignalR servisi yoksa oluştur
    if (!userSignalRServices[email]) {
      console.log(`${email} için SignalR servisi oluşturuluyor...`);
      userSignalRServices[email] = new SignalRService();
      await userSignalRServices[email].startConnection(accessToken);
    }
    
    // Kullanıcının SignalR servisini kullanarak odaya katıl
    const signalRService = userSignalRServices[email];
    if (signalRService.isConnected) {
      await signalRService.joinRoom(roomId);
    } else {
      console.error(`${email} için SignalR bağlantısı kurulamadı.`);
    }
  } catch (error) {
    console.error(`SignalR ile odaya bağlanırken hata: ${error.message}`);
  }
}

// İki tarih arasındaki dakika farkını hesaplayan yardımcı fonksiyon
function getMinutesBetweenDates(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  return Math.floor(diffMs / (1000 * 60));
}

// Tarihin kesme tarihinden sonra olup olmadığını kontrol eden fonksiyon
function isAfterCutoffDate(dateStr) {
  const date = new Date(dateStr);
  const cutoff = getCutoffDate();
  return date >= cutoff;
}

// Kullanıcının belirli bir odaya daha önce katılıp katılmadığını kontrol eden fonksiyon
function hasUserJoinedRoom(email, roomId) {
  return userJoinedRooms[email] && userJoinedRooms[email].includes(roomId);
}

// Belirli bir oda için rasgele kullanıcıları seç (oda başına max 6 kullanıcı)
function selectUsersForRoom(roomId, count = 6) {
  // Bu odaya daha önce katılmamış kullanıcıları filtrele
  const availableUsers = activeUsers.filter(user => {
    return !hasUserJoinedRoom(user.email, roomId);
  });
  
  if (availableUsers.length === 0) {
    console.log(`Oda ${roomId} için katılmamış kullanıcı kalmadı!`);
    return [];
  }
  
  // Odaya katılacak kullanıcı sayısı
  const userCount = Math.min(count, availableUsers.length);
  
  // Rasgele kullanıcıları seç
  const selectedUsers = [];
  const userIndices = [];
  
  // Rasgele kullanıcı seçim algoritması
  while (selectedUsers.length < userCount && userIndices.length < availableUsers.length) {
    const randomIndex = Math.floor(Math.random() * availableUsers.length);
    
    if (!userIndices.includes(randomIndex)) {
      userIndices.push(randomIndex);
      selectedUsers.push(availableUsers[randomIndex]);
    }
  }
  
  return selectedUsers;
}

// Uygun odaları kontrol edip katılım sağlayan fonksiyon
async function checkAndJoinRooms() {
  if (activeUsers.length === 0) {
    console.log('Aktif kullanıcı bulunamadı, odalara katılım sağlanamıyor.');
    return;
  }
  
  // Herhangi bir kullanıcının token'ını kullanarak odaları getir
  const firstUser = activeUsers[0];
  if (!firstUser.accessToken) {
    console.log('Token bulunamadı, odalara katılım sağlanamıyor.');
    return;
  }
  
  // Aktif odaları getir
  const rooms = await getActiveRooms(firstUser.accessToken);
  if (rooms.length === 0) return;
  
  // Status=1 olan odaları filtrele
  const activeRooms = rooms.filter(room => room.status === 1);
  console.log(`${activeRooms.length} adet status=1 olan oda bulundu.`);
  
  // Şu anki zamanı al
  const now = new Date();
  
  // Tüm aktif odaları kontrol et (72 saat kuralı kaldırıldı)
  for (const room of activeRooms) {
    const createdAt = new Date(room.createdAt);
    const minutesSinceCreation = getMinutesBetweenDates(createdAt, now);
    
    console.log(`Oda ${room.id}: "${room.roomName}" - Oluşturulma üzerinden geçen süre: ${minutesSinceCreation} dakika`);
    
    // Eğer oda oluşturulalı 1 dakikadan fazla olduysa katıl
    if (minutesSinceCreation >= 1) {
      console.log(`Oda ${room.id} oluşturulalı 1 dakikadan fazla oldu, katılım sağlanıyor...`);
      
      // Bu oda için 6 kullanıcı seç
      const selectedUsers = selectUsersForRoom(room.id, 6);
      
      // Seçilen kullanıcıları aralarında 5 saniye bekleme ile odaya kat
      for (let i = 0; i < selectedUsers.length; i++) {
        const user = selectedUsers[i];
        console.log(`${user.email} kullanıcısı ${room.id} ID'li odaya katılmaya çalışıyor... (${i + 1}/${selectedUsers.length})`);
        
        await joinRoom(user.accessToken, room.id, user.email);
        
        // Her kullanıcı arasında 5 saniye bekleme (son kullanıcı dahil)
        if (i < selectedUsers.length) {
          console.log(`⏳ 5 saniye bekleniyor...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } else {
      console.log(`Oda ${room.id} henüz yeni oluşturulmuş, bekleniyor...`);
    }
  }
}

// Otomatik yeniden giriş işlemi (token süresini uzatmak için)
async function refreshLogin(user) {
  console.log(`${user.email} için yeniden login deneniyor...`);
  const result = await login(user.email, user.password);
  
  if (result && result.accessToken) {
    user.accessToken = result.accessToken;
    user.refreshToken = result.refreshToken || null;
    user.lastLogin = new Date();
    console.log(`${user.email} için token yenilendi.`);
    
    // SignalR bağlantısını yenile
    if (userSignalRServices[user.email]) {
      await userSignalRServices[user.email].stopConnection();
      delete userSignalRServices[user.email];
      await connectToSignalR(user.email, user.accessToken);
    }
    
    return true;
  }
  
  return false;
}

// Belirli aralıklarla token yenileme işlemi
function startTokenRefreshProcess() {
  // Her 30 dakikada bir token yenileme işlemi
  const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 dakika
  
  setInterval(() => {
    console.log("Token yenileme işlemi başlatılıyor...");
    
    activeUsers.forEach(async (user) => {
      if (user.accessToken) {
        await refreshLogin(user);
      }
    });
  }, REFRESH_INTERVAL);
}

// Belirli aralıklarla odaları kontrol edip katılma işlemi
function startRoomCheckProcess() {
  // Her 30 saniyede bir kontrol
  const CHECK_INTERVAL = 30 * 1000; // 30 saniye
  
  console.log("Oda kontrol sistemi başlatılıyor...");
  
  setInterval(() => {
    console.log("Odalar kontrol ediliyor...");
    checkAndJoinRooms();
  }, CHECK_INTERVAL);
}

// Uygulamayı sonlandırma işlemi (SignalR bağlantılarını kapatma)
async function shutdownApp() {
  console.log('Uygulama sonlandırılıyor. SignalR bağlantıları kapatılıyor...');
  
  const emails = Object.keys(userSignalRServices);
  for (const email of emails) {
    await userSignalRServices[email].stopConnection();
    console.log(`${email} için SignalR bağlantısı kapatıldı.`);
  }
  
  console.log('Tüm bağlantılar kapatıldı.');
}

// CTRL+C ile çıkış işlemi
process.on('SIGINT', async () => {
  console.log('CTRL+C algılandı.');
  await shutdownApp();
  process.exit(0);
});

// Tüm kullanıcılar için sırayla login işlemi yapan ana fonksiyon
async function loginSequentially() {
  if (credentials.length === 0) {
    console.error('Kullanıcı bilgileri bulunamadı!');
    return;
  }

  console.log(`Toplam ${credentials.length} kullanıcı için login işlemi başlatılıyor...`);
  
  for (const credential of credentials) {
    const result = await login(credential.email, credential.password);
    
    if (result && result.accessToken) {
      const user = {
        email: credential.email,
        password: credential.password,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken || null,
        lastLogin: new Date()
      };
      
      activeUsers.push(user);
      // Her kullanıcının katıldığı odaları takip etmek için boş bir dizi oluştur
      userJoinedRooms[credential.email] = [];
      console.log(`${user.email} için token alındı!`);
    }
    
    // Her istek arasında bekletme (istek limiti vs. önlemek için)
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log(`Aktif kullanıcı sayısı: ${activeUsers.length}`);
  return activeUsers.length > 0;
}

// Uygulamayı başlat
(async () => {
  try {
    const success = await loginSequentially();
    
    if (success) {
      console.log('Login işlemleri başarıyla tamamlandı.');
      console.log('Token yenileme sistemi başlatılıyor...');
      startTokenRefreshProcess();
      
      // Oda kontrol işlemini başlat
      startRoomCheckProcess();
      
      console.log('Bot çalışmaya devam ediyor...');
      
      // 72 saat kuralı kaldırıldı
      console.log(`Aynı odaya yapılan istekler arasında ${JOIN_REQUEST_DELAY/1000} saniye beklenecek.`);
    } else {
      console.error('Hiçbir kullanıcı login olamadı!');
    }
  } catch (error) {
    console.error('Bir hata oluştu:', error.message);
  }
})(); 
