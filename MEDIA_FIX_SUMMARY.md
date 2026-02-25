# Media EISDIR Fix - Complete Summary

## Problém
Media API vracalo chybu `EISDIR` keď sa pokúsilo prečítať adresár namiesto súboru. Toto sa stalo pretože:

1. **Video generácia** vytvára DB záznam s `filePath: ''` (prázdny string) pre pending/async generácie
2. Keď sa volá `GET /api/media/[id]`, `resolve(join(UPLOAD_DIR, ''))` vráti cestu k adresáru `data/uploads/`
3. `readFile()` sa pokúsi prečítať adresár = EISDIR chyba

## Riešenie - 3 úrovne ochrany

### 1. API Level (src/app/api/media/[id]/route.ts)
- Pridaná validácia pred pokusom o čítanie súboru
- Kontrola že `filePath` existuje a nie je prázdny
- Vráti `202 Accepted` pre pending media, `404` pre failed/cancelled
- Použitie `validateMediaForServing()` a `validateMediaForDeletion()` z `@/lib/media-validation`

### 2. Business Logic Level (src/lib/media-validation.ts)
Nový validačný modul s funkciami:
- `validateMediaForServing()` - overí či media môže byť servované
- `validateMediaForDeletion()` - overí či media môže byť zmazané
- `sanitizeFilename()` - sanitizuje názvy súborov
- `generateFilePath()` - generuje bezpečné cesty

### 3. Database Level (prisma/schema.prisma)
- `filePath` je teraz `String?` (nullable) - pre pending generácie
- Nový enum `GenerationStatus` namiesto raw stringu
- Lepšia typová bezpečnosť

## Súbory ktoré sa zmenili

### 1. `src/lib/media-validation.ts` (NOVÝ)
Centrálny validačný modul pre všetky media operácie.

### 2. `src/app/api/media/[id]/route.ts`
- Pridaná validácia filePath v GET a DELETE
- Použitie nového validačného modulu
- Bezpečnejšie mazanie (kontrola či je to súbor)

### 3. `src/app/api/media/route.ts`
- Použitie `sanitizeFilename()` pre uploadované súbory
- Použitie `generateFilePath()` pre generovanie ciest

### 4. `src/app/api/generate/image/route.ts`
- Použitie `generateFilePath()` pre konzistentné cesty

### 5. `src/app/api/generate/video/route.ts`
- `filePath: null` namiesto `filePath: ''` pre pending video
- Použitie `generateFilePath()` vo finalize

### 6. `prisma/schema.prisma`
- `filePath String?` (nullable)
- Nový enum `GenerationStatus`
- `generationStatus GenerationStatus?`

### 7. `scripts/cleanup-invalid-media.ts` (NOVÝ)
Cleanup script na nájdenie a odstránenie orphan záznamov.

### 8. `prisma/migrations/fix_media_filepath/migration.sql`
SQL migrácia pre databázu.

## Deployment steps na serveri

```bash
# 1. SSH na server
ssh root@tvoj-server

# 2. Choď do app adresára
cd /home/acechange-bot/grothi

# 3. Stiahni zmeny
git pull

# 4. Aplikuj databázovú migráciu
export DATABASE_URL="postgresql://grothi:HESLO@localhost:5432/grothi"
npx prisma migrate dev --name fix_media_filepath

# ALEBO ak migrate nefunguje, použi db push:
npx prisma db push

# 5. Skontroluj či sú validné záznamy
npx ts-node scripts/cleanup-invalid-media.ts --dry-run

# 6. Vymaž orphan záznamy (ak nejaké existujú)
npx ts-node scripts/cleanup-invalid-media.ts --execute

# 7. Rebuild a restart
npm run build
pm2 restart grothi
```

## HTTP Status Codes pre Media

| Stav | Status Code | Význam |
|------|-------------|--------|
| SUCCEEDED | 200 | Media je dostupné a súbor existuje |
| PENDING | 202 | Video sa ešte generuje |
| PROCESSING | 202 | Video sa spracováva |
| FAILED | 410 | Generácia zlyhala |
| CANCELLED | 410 | Používateľ zrušil generáciu |
| filePath=null | 404 | Záznam bez súboru |
| File missing | 404 | Súbor bol zmazaný z disku |

## Testovanie

```bash
# Test pending video (mal by vrátiť 202)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/media/PENDING_VIDEO_ID

# Test existujúceho obrázka (mal by vrátiť 200)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/media/VALID_IMAGE_ID

# Test zmazania (mal by vrátiť 200)
curl -s -X DELETE http://localhost:3000/api/media/SOME_ID
```

## Bezpečnostné vylepšenia

1. **Path Traversal ochrana** - všetky cesty sa validujú cez `resolve()` a `startsWith()`
2. **Sanitizácia filename** - odstránenie nebezpečných znakov z názvov
3. **EISDIR prevencia** - kontrola `statSync().isFile()` pred čítaním
4. **Null safety** - filePath je nullable, validácia pred použitím
