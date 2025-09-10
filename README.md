# MovliqBot - Canlı Yarış Uygulaması Bot Sistemi

Bu proje, canlı yarış uygulaması için NodeJS tabanlı bir bot sistemi içerir. Bot, belirtilen kullanıcı bilgileriyle API'ye otomatik olarak login işlemi gerçekleştirir.

## Kurulum

1. Projeyi bilgisayarınıza klonlayın veya indirin
2. Gerekli paketleri yüklemek için terminal/komut satırında şu komutu çalıştırın:
   ```
   npm install
   ```
3. `.env` dosyasını düzenleyerek API URL'sini doğru şekilde ayarlayın
4. `script.js` dosyasındaki kullanıcı bilgilerini güncelleyin veya credentials.json dosyası oluşturun

## Kullanım

Botu çalıştırmak için:

```
npm run bot
```

ya da 

```
npm start
```

## Kullanıcı Bilgileri

Bot, kullanıcı bilgilerini iki şekilde alabilir:

1. Doğrudan `script.js` içerisinde tanımlanmış değişkenlerden
2. `credentials.json` dosyasından (eğer `index.js` kullanılıyorsa)

### Credential Yapısı

```json
[
  {
    "email": "kullanici1@ornek.com",
    "password": "sifre123"
  },
  {
    "email": "kullanici2@ornek.com",
    "password": "sifre456"
  }
]
```

## Notlar

- Her login işlemi arasında 1 saniye bekletme süresi vardır (API limit aşımını önlemek için)
- Hata yönetimi için temel kontroller içerir
- Alınan token değerleri konsola yazdırılır 