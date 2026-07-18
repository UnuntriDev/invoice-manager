# Gumijagoda Sp. z o.o. | System zarządzania fakturami

Aplikacja webowa do zarządzania fakturami kosztowymi i sprzedażowymi
z integracją KSeF, dwuetapowym obiegiem (bufor → akceptacja),
auto-kategoryzacją kontrahentów i podglądem PDF/XML w przeglądarce.

**Stack**: Next.js 16 (App Router) · React 19 · TypeScript 5 · Prisma 7 + PostgreSQL
· Zod 4 · TanStack Table/Query · shadcn/ui · Docker · node-cron

## Uruchomienie

Wymagane: Node.js 22+, npm, PostgreSQL (lub Docker).

```bash
git clone <repo-url>
cd invoice-manager
cp .env.example .env          # ustaw COMPANY_NIP i CRON_SECRET
docker compose up -d db
npm ci
npx prisma migrate deploy
npx prisma db seed            # 5 kontrahentów, 10 kategorii, 13 dokumentów, 3 harmonogramy
npm run dev                   # http://localhost:3000
```

Przy aktualizacji istniejącej bazy najpierw wykonaj kopię zapasową, następnie
uruchom `npm run db:preflight`, a dopiero potem `npx prisma migrate deploy`.
Preflight zakłada, że dotychczasowy schemat z tabelą `Category` już istnieje.
Pełna procedura aktualizacji znajduje się w [`docs/deployment.md`](docs/deployment.md).

Alternatywnie jedną komendą przez Docker:

```bash
docker compose up --build     # DB + migracje + app
```

Profil Docker celowo nie uruchamia seeda automatycznie. Dane demonstracyjne
można dodać jawnie z hosta przez `npx prisma db seed`, gdy baza z compose jest
dostępna na `localhost:5432`.

Seed jest idempotentny i bezpieczny do wielokrotnego uruchomienia.

### Zmienne środowiskowe

Skopiuj `.env.example` do `.env` i ustaw wartości odpowiednie dla środowiska.
Pliki `.env*` poza wersjonowanym `.env.example` są ignorowane przez Git.

| Zmienna | Wymagana | Opis |
|---------|----------|------|
| `DATABASE_URL` | tak | Łańcuch połączenia PostgreSQL używany przez Prisma |
| `COMPANY_NIP` | tak | Poprawny NIP własnej firmy; decyduje o kierunku faktury XML/KSeF |
| `KSEF_ENV` | nie | Obecnie obsługiwane jest `mock`, które jest też wartością domyślną |
| `KSEF_NIP` | w profilu produkcyjnym | NIP podmiotu; zarezerwowany dla realnego adaptera KSeF |
| `KSEF_TOKEN` | w profilu produkcyjnym | Sekret zarezerwowany dla realnego adaptera KSeF; nie wolno go commitować ani wystawiać jako `NEXT_PUBLIC_*` |
| `CRON_SECRET` | tak dla endpointu crona | Losowy, długi sekret przekazywany jako `Authorization: Bearer ...` |
| `UPLOAD_DIR` | nie | Katalog trwałego storage; domyślnie `./uploads` |
| `MAX_FILE_SIZE_MB` | nie | Maksymalny rozmiar pliku PDF/XML; domyślnie 10 MB |

Wartości w `.env.example` służą wyłącznie do lokalnego uruchomienia w trybie
mock. Przed wdrożeniem ustaw osobne, losowe sekrety i trwały wolumen dla
`UPLOAD_DIR`; szczegóły zawiera [`docs/deployment.md`](docs/deployment.md).

## Architektura

```
React UI  →  Route Handlers (walidacja Zod)  →  Service Layer  →  Prisma ORM  →  PostgreSQL
                                                     ↕
                                              IKSeFClient (adapter)
                                              MockKSeFClient / (real)
```

- Logika biznesowa w warstwie serwisów, nie w komponentach ani route handlerach
- Pliki: zapis na dysk przed transakcją DB, rollback pliku przy błędzie, tombstone cleanup z reconcilerem
- Kategorie: self-referencing tree z advisory lock, walidacją cykli i unikalnych nazw rodzeństwa

## Kluczowe decyzje

| Obszar | Decyzja | Dlaczego |
|--------|---------|----------|
| Obieg dokumentów | Status BUFFER/ACCEPTED na jednej tabeli | Jedno źródło prawdy zamiast duplikacji |
| KSeF | Adapter pattern (IKSeFClient) | Łatwe przełączenie mock↔real bez zmian w logice |
| Idempotencja importu | `ksefNumber` + `invoiceNumber+NIP` + `skipDuplicates` | Trzy warstwy ochrony przed duplikatami |
| Akceptacja bufora | `SELECT ... FOR UPDATE` + weryfikacja count | Atomowa akceptacja wielu dokumentów |
| Harmonogram | Rozproszony lease z heartbeat i TTL | Bezpieczna współbieżność wielu instancji |
| Kwoty | decimal.js, brutto = netto + VAT w schemacie Zod | Brak błędów zaokrągleń float |
| Upload | Magic bytes + UTF-8 decode + MIME cross-check | Walidacja treści, nie tylko rozszerzenia |
| XML | Blokada DTD/ENTITY, limit znaków, `processEntities: false` | Ochrona przed XXE i billion laughs |
| Załączniki | Path traversal: `normalizeKey` + `path.relative` | Dwuwarstwowa ochrona przed wyjściem z katalogu |

## Research rynku

Istniejące rozwiązania (Fakturownia, wFirma, SaldeoSMART) oferują integrację
z KSeF i dwuetapowy obieg faktur kosztowych. Zaczerpnąłem wzorzec bufora
jako poczekalni przed rejestrem oraz auto-kategoryzację po kontrahentach.
Moje podejście wyróżnia czysta architektura warstwowa z pełną walidacją
NIP/IBAN (sumy kontrolne, nie regex).

## Testy

```bash
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm test              # jednostkowe: 31 zestawów, 168 testów (Jest)
npm run test:e2e      # E2E: 10 testów (Playwright, wymaga działającej aplikacji)
npm run build         # produkcyjny build
```

**Testy jednostkowe (Jest)** — walidacja NIP/IBAN, parser XML KSeF (FA2/FA3),
bezpieczeństwo uploadu (DTD, MIME, magic bytes, limity), CRUD dokumentów z
duplikatami i auto-kategoryzacją, import KSeF z rollbackiem, współbieżność
schedulera, reconciliacja storage, daty Warsaw, dostępność klawiaturą.

**Testy E2E (Playwright)** — smoke krytycznych ścieżek w przeglądarce: nawigacja,
pełny cykl CRUD kontrahentów / kategorii / typów dokumentów / dokumentów,
walidacja NIP w formularzu, powiadomienia po akcjach oraz paleta poleceń (Ctrl+K).
Testy działają na bazie deweloperskiej i sprzątają po sobie utworzone rekordy
(unikalne nazwy + usuwanie w tym samym teście). `npm run test:e2e:ui` uruchamia
tryb interaktywny. Wymagany jednorazowo `npx playwright install chromium`.

## Znane ograniczenia

- KSeF działa na warstwie mock (adapter gotowy na realną integrację)
- Brak logowania i ról (tryb jednego użytkownika, zgodnie z wymaganiami)
- Pliki na trwałym volume; publiczna platforma wymaga trwałości `/app/uploads`
- Ekstrakcja tekstu z PDF, ale brak OCR obrazu (skany wymagają ręcznego uzupełnienia)
- Cursor pagination bez indeksu trigramowego (do zmierzenia przy dużym wolumenie)

## Co dalej

1. Realna integracja z KSeF 2.0 API (JWT + AES-256-CBC)
2. OCR skanów PDF (Azure Document Intelligence / Tesseract)
3. Full-text search (`pg_trgm` / tsvector)
4. Audit log zmian dokumentów
5. Auto-uzupełnianie po NIP (API białej listy MF)
6. Adapter S3/Azure Blob dla platform bez trwałego filesystemu

## Założenia projektowe

- Upload trafia do bufora (spójny obieg ze źródłem KSeF)
- Dokumenty ręczne trafiają bezpośrednio do rejestru
- Auto-kategoryzacja nie nadpisuje ręcznie przypisanej kategorii
- Typy systemowe nie mogą być usunięte
- NIP firmy pochodzi ze zwalidowanego `COMPANY_NIP`, nie jest zgadywany
- Harmonogram wymaga stale działającego procesu Node z rozproszonym lease w PostgreSQL
