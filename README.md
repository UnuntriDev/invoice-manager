# System zarządzania fakturami — Gumijagoda Sp. z o.o.

## Wersja wdrożona

[Link do aplikacji](https://... — uzupełnię po deploy)

## Research rynku

Istniejące rozwiązania (Fakturownia, wFirma, SaldeoSMART) oferują integrację z KSeF, auto-pobieranie danych z GUS po NIP i dwuetapowy obieg faktur kosztowych (bufor → akceptacja). Z tych rozwiązań zaczerpnąłem wzorzec bufora jako poczekalni przed rejestrem oraz auto-kategoryzację na podstawie kontrahenta. Moje podejście różni się czystą architekturą warstwową w Next.js z adapterem KSeF (mock/real) i pełną walidacją NIP/IBAN z sumami kontrolnymi.

## Architektura

Aplikacja w architekturze warstwowej:

- **Frontend**: React + Next.js App Router + shadcn/ui + TanStack Table/Query
- **API Layer**: Next.js Route Handlers — cienka warstwa walidacji Zod
- **Service Layer**: logika biznesowa (services/) — CRUD, auto-kategoryzacja, duplikaty
- **Data Layer**: Prisma ORM + PostgreSQL
- **Integracja KSeF**: Adapter pattern (IKSeFClient → MockKSeFClient)

Logika biznesowa nie żyje w komponentach React.

## Decyzje technologiczne

- **Bufor jako status dokumentu** (BUFFER/ACCEPTED) zamiast osobnej tabeli — jedno źródło prawdy
- **Adapter pattern dla KSeF** — czysta abstrakcja, łatwe przełączenie mock↔real
- **Unique constraint** [invoiceNumber, contractorId] — duplikaty blokowane na poziomie DB
- **Idempotencja importu KSeF** — `ksefNumber` jest głównym stabilnym kluczem,
  a `invoiceNumber + NIP kontrahenta` dodatkowym kluczem biznesowym; cały batch
  jest zapisywany w jednej transakcji
- **Kategorie jako self-referencing relation** — drzewo dowolnej głębokości
- **xmlData jako JSONB** — surowy XML przechowywany raz, parsowany on-demand w podglądzie
- **shadcn/ui + TanStack Table** — konfigurowalne kolumny, sortowanie, filtrowanie
- **react-pdf** — podgląd PDF z zoomem i nawigacją stron w przeglądarce

## Uruchomienie lokalne

```bash
git clone <repo-url>
cd invoice-manager
cp .env.example .env
docker compose up -d db
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Lub jedną komendą:

```bash
docker compose up --build
```

Aplikacja będzie dostępna pod `http://localhost:3000`. Start produkcyjny
wykonuje migracje, ale celowo nie uruchamia seeda. Dane demonstracyjne można
dodać jawnie i bezpiecznie wielokrotnie:

```bash
docker compose exec app npx prisma db seed
```

Instrukcja bezpiecznego wykrywania i usuwania duplikatów kategorii znajduje się
w pliku [`docs/category-deduplication.md`](docs/category-deduplication.md).

## Dane testowe (seed)

- 5 kontrahentów (PackPol, CukroPol, TransChłód, EkoNawóz, Cukiernia Słodki Róg)
- 10 kategorii w drzewie 2-poziomowym (Koszty operacyjne → Surowce/Opakowania/Transport)
- 13 dokumentów (9 zaakceptowanych + 4 w buforze, mix źródeł KSeF/Upload/Ręczny)
- 3 typy dokumentów (2 systemowe + 1 custom)
- 3 wpisy harmonogramu KSeF (1:00, 7:00, 13:00)

## Testy

```bash
npx jest --passWithNoTests
```

Testy jednostkowe pokrywają:
- Walidację NIP (sumy kontrolne, formaty)
- Walidację IBAN (sumy kontrolne, formaty PL)
- Parser XML KSeF (parsowanie faktur, ekstrakcja danych)
- Serwis dokumentów (tworzenie, duplikaty, akceptacja, auto-kategoryzacja)
- Import KSeF (pełny batch, rollback, ponowny import, duplikaty i błędne dane)

## Znane ograniczenia

- KSeF: warstwa mock z realistycznymi danymi (adapter pattern gotowy na realną integrację)
- Brak logowania i ról (tryb jednego użytkownika, zgodnie z wymaganiami)
- Pliki przechowywane na dysku (w produkcji: S3/Azure Blob Storage)
- Brak OCR na PDF — wymaga ręcznego uzupełnienia danych
- Brak paginacji server-side (przy dużych zbiorach: cursor-based z Prisma)

## Co zrobiłbym dalej

1. Realna integracja z KSeF 2.0 API (JWT + AES-256-CBC)
2. Paginacja server-side (cursor-based)
3. OCR na PDF (Azure Document Intelligence / Tesseract)
4. Logowanie + role (NextAuth.js — admin / księgowy / viewer)
5. Full-text search (PostgreSQL tsvector)
6. Audit log — historia zmian dokumentów
7. Auto-uzupełnianie danych po NIP (API białej listy MF)
8. CI/CD (GitHub Actions: lint, testy, deploy)

## Założenia

- Upload trafia do bufora (spójny obieg ze źródłem KSeF)
- Dokumenty ręczne trafiają bezpośrednio do rejestru (nie wymagają akceptacji)
- Auto-kategoryzacja nie nadpisuje ręcznie przypisanej kategorii
- Typy systemowe nie mogą być usunięte
- Dla importu KSeF głównym kluczem idempotentności jest numer KSeF; para numer
  faktury + kontrahent pozostaje dodatkową ochroną biznesową
