# Zadania dodatkowe — projekt (2026-07-19)

Trzy opcjonalne zadania z briefu rekrutacyjnego, zatwierdzone przez użytkownika.

## 1+2. Auto-uzupełnianie po NIP + weryfikacja rachunku (biała lista MF)

Jedno publiczne API pokrywa oba zadania: `https://wl-api.mf.gov.pl/api/search/nip/{nip}?date=YYYY-MM-DD`
(bez klucza; rejestr GUS/REGON odrzucony, bo wymaga rejestrowanego klucza).

- `src/lib/services/whitelist.service.ts` — server-side fetch z timeoutem 10 s;
  zwraca `{ name, address, accountNumbers, statusVat }`; mapuje błędy API na czytelne komunikaty.
- `GET /api/contractors/lookup?nip=...` — walidacja NIP z sumą kontrolną (istniejący walidator),
  potem serwis. Błędy: 400 (zły NIP), 404 (brak w wykazie), 502 (API niedostępne).
- Formularz kontrahenta: przycisk „Pobierz dane (GUS/MF)" przy NIP → wypełnia nazwę i adres;
  przycisk „Zweryfikuj" przy rachunku → porównanie ze zwróconą listą rachunków,
  wynik inline ✓/✗. Wynik nie jest zapisywany w bazie — zero migracji.

## 3. Reguły auto-kategoryzacji po słowach kluczowych

- Model `CategoryRule { id, keyword, categoryId (FK Category, onDelete Cascade), createdAt }`
  — migracja czysto addytywna.
- `resolveCategory(contractor, documentText)`: (a) domyślna kategoria kontrahenta wygrywa;
  (b) w przeciwnym razie reguły — dopasowanie case-insensitive frazy w nazwie kontrahenta
  lub numerze/tytule dokumentu; przy wielu trafieniach najdłuższa fraza.
- Podpięcie wszędzie tam, gdzie działa dziś reguła „kontrahent → kategoria"
  (import KSeF, upload, dodawanie ręczne).
- UI: Ustawienia → Reguły kategoryzacji (CRUD wzorowany na typach dokumentów).

## Testy i wdrożenie

Testy jednostkowe: resolver, whitelist.service (mock fetch). Lint + typecheck + jest.
Wdrożenie: `prisma migrate deploy` na bazę Railway (publiczny URL), push → auto-redeploy,
weryfikacja na produkcji, wpis w README.
