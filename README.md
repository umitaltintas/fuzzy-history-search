# Fuzzy History Search

Tarayici gecmisinizde VS Code tarzinda fuzzy arama yapan bir tarayici eklentisi. Omnibox'tan `h ` yazarak veya klavye kisayolu ile aktive edilir.

## Ozellikler

- **Omnibox entegrasyonu** — Adres cubuguna `h ` yazin, ardindan aramanizi yapin
- **Overlay modu** — Herhangi bir sayfanin uzerine acilan arama paneli (Cmd+E / Ctrl+Shift+E)
- **Popup pencere** — Overlay inject edilemeyen sayfalarda otomatik olarak ayri pencere acar
- **Fuzzy eslestirme** — fzf tarzinda DP tabanli optimal karakter hizalamasi
- **Akilli siralama** — Ziyaret sayisi, yakinlik, host eslesmesi ve boundary tespiti ile skorlama
- **Aktif sekme destegi** — Su an acik olan sekme sonuclara dahil edilir

## Kurulum

### Chrome / Edge / Chromium

1. Repoyu klonlayin veya ZIP olarak indirip cikartin:
   ```
   git clone https://github.com/umitaltintas/fuzzy-history-search.git
   ```
2. Chrome'da `chrome://extensions` adresine gidin
3. Sag ust kosedeki **Developer mode** (Gelistirici modu) toggle'ini acin
4. **Load unpacked** (Paketlenmemis oge yukle) butonuna tiklayin
5. `fuzzy-history-search` klasorunu secin
6. Eklenti listeye eklenir. Hata varsa detaylar bu sayfada gosterilir.

#### Klavye kisayolu ayarlama (Chrome)

Chrome, manifest'teki `suggested_key` degerini baska bir eklentiyle cakisiyorsa otomatik atamayabilir. Elle ayarlamak icin:

1. `chrome://extensions/shortcuts` adresine gidin
2. **Fuzzy History Search** altindaki "Open fuzzy history search window" satirini bulun
3. Kalem ikonuna tiklayip istediginiz kisayolu girin (onerilen: `Cmd+E` / `Ctrl+Shift+E`)

### Firefox

#### Imzali `.xpi` ile kurulum (onerilen)

1. [Releases](https://github.com/umitaltintas/fuzzy-history-search/releases/latest) sayfasindan `.xpi` dosyasini indirin
2. Firefox dosyayi otomatik olarak eklenti kurulum diyalogu ile acar
3. **Add** (Ekle) butonuna tiklayin

#### Gecici kurulum (gelistirici)

1. Repoyu klonlayin veya ZIP olarak indirip cikartin
2. Firefox'ta `about:debugging#/runtime/this-firefox` adresine gidin
3. **Load Temporary Add-on** (Gecici Eklenti Yukle) butonuna tiklayin
4. `fuzzy-history-search` klasorunun icindeki `manifest.json` dosyasini secin

> **Not:** Gecici eklentiler tarayici kapatildiginda kaldirilir.

#### Klavye kisayolu ayarlama (Firefox)

1. `about:addons` adresine gidin
2. Sag ust kosedeki disli ikonuna tiklayin
3. **Manage Extension Shortcuts** (Eklenti Kisayollarini Yonet) secenegine tiklayin
4. **Fuzzy History Search** altindaki kisayolu ayarlayin

## Kullanim

### Omnibox

Adres cubuguna `h ` yazin (h + bosluk), ardindan aramanizi girin. Sonuclar omnibox dropdown'unda gosterilir.

### Overlay / Popup

Klavye kisayolu (varsayilan `Cmd+E` / `Ctrl+Shift+E`) ile arama panelini acin.

| Kisayol | Islem |
|---|---|
| Yazi yazma | Gecmiste arama |
| `↑` `↓` | Sonuclar arasinda gezinme |
| `Enter` | Secili sonucu mevcut sekmede ac |
| `Cmd+Enter` / `Ctrl+Enter` | Yeni sekmede ac |
| `Shift+Enter` | Arka plan sekmesinde ac |
| `Esc` | Paneli kapat |

## Dosya Yapisi

```
fuzzy-history-search/
├── manifest.json       # Eklenti yapilandirmasi (MV3)
├── background.js       # Service worker: gecmis cache, fuzzy skorlama, omnibox
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-96.png
└── ui/
    ├── index.html      # Popup pencere HTML
    ├── ui.css           # Popup pencere stilleri
    ├── ui.js            # Popup pencere mantigi
    └── overlay.js       # Sayfa uzerine inject edilen overlay
```

## Izinler

| Izin | Neden |
|---|---|
| `history` | Tarayici gecmisini okumak icin |
| `tabs` | Aktif sekme bilgisi ve sekme acma/guncelleme icin |
| `activeTab` | Kisayol tetiklendiginde aktif sekmeye overlay inject etmek icin |
| `scripting` | Content script (overlay.js) inject etmek icin (MV3) |
