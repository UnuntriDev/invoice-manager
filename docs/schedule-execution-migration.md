# Migracja stanu wykonania harmonogramów KSeF

Migracja `20260715190000_schedule_execution_state` dodaje wyłącznie nullable
kolumny stanu wykonania oraz indeks wyszukiwania aktywnych harmonogramów. Nie
jest uruchamiana automatycznie przez aplikację.

## Kopia zapasowa

Przed wdrożeniem wykonaj kopię PostgreSQL:

```powershell
pg_dump $env:DATABASE_URL --format=custom --file=backup-before-schedule-state.dump
```

Zweryfikuj, że plik kopii istnieje i ma niezerowy rozmiar.

## Wdrożenie

Po zatrzymaniu starszych instancji aplikacji:

```powershell
npx prisma migrate deploy
```

Następnie uruchom aplikację i sprawdź log startowy crona zawierający
`timezone Europe/Warsaw`.

## Wycofanie

Najpierw przywróć poprzednią wersję aplikacji. Usunięcie nowych kolumn kasuje
zapisane informacje diagnostyczne, dlatego wykonuj je tylko po dodatkowej kopii:

```sql
DROP INDEX IF EXISTS "KSeFSchedule_isActive_hour_minute_idx";
ALTER TABLE "KSeFSchedule"
  DROP COLUMN IF EXISTS "lastError",
  DROP COLUMN IF EXISTS "lastErrorAt",
  DROP COLUMN IF EXISTS "lockToken",
  DROP COLUMN IF EXISTS "lockedAt";
```
