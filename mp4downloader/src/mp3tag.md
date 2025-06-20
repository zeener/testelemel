Nagyon jó és **valóban fontos felvetés** – egy CD-hez, de főleg zenelejátszáshoz a jól kitöltött **ID3 tag**-ek (“Tag infók”) sokat számítanak!
A legfontosabb metaadatok általában: **Előadó (Artist), Szám címe (Title), Album, Év, Műfaj, Sorszám stb.**

## **1. Adatok forrásai – honnan szerezhetünk zenei metaadatot YouTube zenékhez?**

### **A. YouTube API + YouTube videó címe**

* **Alap:** A YouTube API vagy a videó HTML-jéből kiolvasható a cím és (gyakran) az előadó neve.
* **Gyakorlat:**

  * A legtöbb zeneszámnál a videó címe ilyen:
    **"Queen – Bohemian Rhapsody (Official Video)"**
    vagy
    **"Imagine Dragons - Believer \[Lyrics]"**
  * Ebből regex-szel/szabályal ki lehet szedni az **előadót** és a **címet**.
* **Előny:** Mindig elérhető, gyors.
* **Hátrány:** Nem mindig pontos, ha nem hivatalos feltöltés.

### **B. Külső zenei adatbázisok, API-k**

* **MusicBrainz** ([musicbrainz.org](https://musicbrainz.org/), van [API-ja](https://musicbrainz.org/doc/MusicBrainz_API))

  * Ingyenes, óriási adatbázis, előadó/cím/album/év/műfaj adatok lekérhetők.
  * Lehet keresni előadó + számcím alapján.
* **Last.fm API**

  * Szintén előadó + címre visszaad további adatokat, albumképet is.
* **Spotify API** ([Spotify Web API](https://developer.spotify.com/documentation/web-api/))

  * Előadó + számcím keresésre rengeteg extra metaadat (genre, album, release date, artwork) kérhető, DE hitelesítés szükséges.
* **Discogs API**

  * Albumokra, single-ökre kaphatunk részletes adatot.
* **iTunes Search API**

  * Ingyen, előadó/cím alapján visszaad albumot, évszámot, borítóképet.

### **C. Esetleges közösségi/felhasználói adatbevitel**

* A frontend adhat lehetőséget manuális szerkesztésre (opcionális bővítés).

---

## **2. Javasolt megközelítés – Gyors, automatizált workflow:**

1. **YouTube videó címének “parszolása”**
   → cím, előadó *gyors kinyerés*
2. **MusicBrainz/Spotify/iTunes API-n keresés**
   → pontosabb album/év/műfaj, borítókép hozzáadása
   (Előadó + számcím alapján.)
3. **Metaadatok (ID3 tag-ek) beírása**
   → letöltés után Pythonban pl. [`mutagen`](https://mutagen.readthedocs.io/en/latest/) könyvtárral, vagy Node.js-ben [node-id3](https://github.com/Zazama/node-id3)-mal.

---

## **3. Példa: Python (letöltés + taggelés MusicBrainz-zel)**

```python
from mutagen.easyid3 import EasyID3
import requests

def get_youtube_metadata(youtube_title):
    # Egyszerű szabályos feldolgozás, pl. "Előadó - Számcím"
    if " - " in youtube_title:
        artist, title = youtube_title.split(" - ", 1)
    else:
        artist, title = "", youtube_title
    return artist.strip(), title.strip()

def get_musicbrainz_info(artist, title):
    # MusicBrainz keresés
    url = f"https://musicbrainz.org/ws/2/recording/?query=artist:{artist} AND recording:{title}&fmt=json&limit=1"
    resp = requests.get(url, headers={"User-Agent": "mp3tag-app/1.0"})
    if resp.ok and resp.json().get("recordings"):
        rec = resp.json()["recordings"][0]
        album = rec["releases"][0]["title"] if rec.get("releases") else ""
        year = rec["first-release-date"][:4] if "first-release-date" in rec else ""
        return album, year
    return "", ""

def tag_mp3_file(filepath, artist, title, album="", year=""):
    audio = EasyID3(filepath)
    audio["artist"] = artist
    audio["title"] = title
    if album:
        audio["album"] = album
    if year:
        audio["date"] = year
    audio.save()

# Felhasználás példa:
yt_title = "Imagine Dragons - Believer"
artist, title = get_youtube_metadata(yt_title)
album, year = get_musicbrainz_info(artist, title)
tag_mp3_file("downloads/Imagine Dragons - Believer.mp3", artist, title, album, year)
```

---

## **Összefoglalva**

* **YouTube videó címe** – gyorskivonat (artist/title)
* **MusicBrainz / Spotify / iTunes API** – pontosítás (album/év/műfaj/borító)
* **Taggelés** – Python mutagen csomaggal (backend oldalon automatikusan!)

---

**Melyik forrást részesítenéd előnyben (gyors “YouTube cím” vagy pontos MusicBrainz/Spotify)?
Kéred a teljes Python workflow-t, vagy egy Node.js példát is mutassak?**
