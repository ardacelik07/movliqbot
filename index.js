const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// API endpoint
const API_URL = 'http://movliq.echmetalicakir.tr:5000/api/User/login';

// Kullanıcı bilgilerini JSON dosyasından okuma
async function readCredentials() {
  try {
    const data = fs.readFileSync('./credentials.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Credentials dosyası okunamadı:', error.message);
    return [];
  }
}

// Login işlemini gerçekleştiren fonksiyon
async function login(email, password) {
  try {
    const response = await axios.post(API_URL, {
      email,
      password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*'
      }
    });

    console.log(`Login başarılı: ${email}`);
    return response.data;
  } catch (error) {
    console.error(`Login başarısız (${email}):`, error.message);
    if (error.response) {
      console.error('Sunucu yanıtı:', error.response.status, error.response.data);
    }
    return null;
  }
}

// Tüm kullanıcılar için sırayla login işlemi yapan ana fonksiyon
async function loginSequentially() {
  const credentials = await readCredentials();
  
  if (credentials.length === 0) {
    console.error('Kullanıcı bilgileri bulunamadı!');
    return;
  }

  console.log(`Toplam ${credentials.length} kullanıcı için login işlemi başlatılıyor...`);
  
  for (const user of credentials) {
    console.log(`${user.email} için login deneniyor...`);
    const result = await login(user.email, user.password);
    
    if (result) {
      console.log(`${user.email} için token: ${result.token || 'Token bulunamadı'}`);
    }
    
    // Her istek arasında bekletme (istek limiti vs. önlemek için)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Uygulamayı başlat
loginSequentially().then(() => {
  console.log('Tüm login işlemleri tamamlandı.');
}).catch(error => {
  console.error('Bir hata oluştu:', error.message);
}); 