# Bezpieczna deduplikacja kategorii seedowych

Skrypt `scripts/database/deduplicate-categories.sql` naprawia wyłącznie 10 znanych
ścieżek kategorii tworzonych przez seed. Nie jest migracją uruchamianą automatycznie.
Bez jawnej flagi wykonuje wszystkie kontrole w transakcji i kończy pracę przez
`ROLLBACK`.

## Jak wybierany jest rekord kanoniczny

Dla każdej pełnej ścieżki, np. `Koszty operacyjne / Opakowania`, rekordy są
sortowane po `createdAt`, a następnie po `id`. Najstarszy rekord zostaje
kanoniczny. Pozostałe identyfikatory są mapowane na niego.

Przed usunięciem nadmiarowych kategorii skrypt aktualizuje:

- `Document.categoryId`,
- `Contractor.defaultCategoryId`,
- `CategorizationRule.categoryId`,
- `Category.parentId` dla podkategorii.

Skrypt przerywa pracę, jeżeli drzewo zawiera kategorię nieosiągalną od korzenia
(np. cykl), po mapowaniu pozostają zależności albo nadal istnieją duplikaty
znanych ścieżek.

## 1. Zatrzymanie zapisów i wykonanie kopii zapasowej

Zatrzymaj aplikację, pozostawiając bazę uruchomioną:

```powershell
docker compose stop app
```

Utwórz backup w formacie custom wewnątrz kontenera i sprawdź, czy jego katalog
jest czytelny:

```powershell
docker compose exec -T db pg_dump -U invoices -d invoices -Fc -f /tmp/invoices-before-category-dedup.dump
docker compose exec -T db pg_restore --list /tmp/invoices-before-category-dedup.dump
```

Skopiuj backup poza repozytorium i wolumen Dockera, np. do
`C:\Backups\invoice-manager`:

```powershell
New-Item -ItemType Directory -Force C:\Backups\invoice-manager
docker compose cp db:/tmp/invoices-before-category-dedup.dump C:\Backups\invoice-manager\invoices-before-category-dedup.dump
Get-Item C:\Backups\invoice-manager\invoices-before-category-dedup.dump
```

Nie przechodź dalej, jeśli `pg_dump`, `pg_restore --list` albo kopiowanie pliku
zakończy się błędem.

## 2. Obowiązkowy dry run

Poniższa komenda pokazuje wykryte duplikaty, rekordy kanoniczne, pełną mapę
identyfikatorów oraz wynik symulacji. Wszystkie zmiany zostaną wycofane:

```powershell
Get-Content -Raw .\scripts\database\deduplicate-categories.sql | docker compose exec -T db psql -U invoices -d invoices
```

Przed zatwierdzeniem sprawdź, czy:

- lista obejmuje wyłącznie oczekiwane ścieżki seedowe,
- `canonical_id` wskazuje najstarszy właściwy rekord,
- `remaining_seed_categories` wynosi `10`,
- liczba `removed_duplicates` odpowiada oczekiwanej liczbie nadmiarowych rekordów.

## 3. Jawne zatwierdzenie

Dopiero po wykonaniu i zweryfikowaniu backupu oraz dry runu uruchom:

```powershell
Get-Content -Raw .\scripts\database\deduplicate-categories.sql | docker compose exec -T db psql -v APPLY_CATEGORY_DEDUP=YES -U invoices -d invoices
```

Bez dokładnej wartości `APPLY_CATEGORY_DEDUP=YES` skrypt zawsze wykona
`ROLLBACK`.

## 4. Walidacja po operacji

Uruchom ponownie dry run. Nie powinien już pokazać duplikatów, a
`removed_duplicates` powinno wynosić `0`. Następnie uruchom aplikację i sprawdź
rejestr dokumentów, kontrahentów oraz drzewo kategorii:

```powershell
docker compose up -d app
```

W razie niezgodności nie wykonuj kolejnych zmian. Zatrzymaj aplikację i odtwórz
backup najpierw do osobnej bazy kontrolnej, aby potwierdzić jego poprawność.
