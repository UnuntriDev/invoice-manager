# Deployment produkcyjny

Repozytorium zawiera gotowy profil `docker-compose.production.yml`, ale nie
zawiera poświadczeń ani fikcyjnego publicznego URL. Samo utworzenie publicznej
usługi wymaga dostępu do wybranej platformy i jest oznaczone w raporcie napraw
jako `BLOCKED_EXTERNAL`.

## Wymagane zasoby

- PostgreSQL 16 dostępny w prywatnej sieci;
- trwały volume montowany jako `/app/uploads` (lub adapter trwałego object
  storage w przyszłości);
- stale działająca instancja Node, ponieważ scheduler działa w procesie;
- TLS/reverse proxy i monitoring endpointu `/api/health`.

## Zmienne środowiskowe

Wymagane bez wartości domyślnej w profilu produkcyjnym:

- `DATABASE_URL`;
- `COMPANY_NIP` (poprawny polski NIP własnej firmy);
- `KSEF_NIP` i `KSEF_TOKEN`;
- `CRON_SECRET` (losowy sekret);
- opcjonalnie `KSEF_ENV` (obecnie obsługiwane i domyślne: `mock`);
- opcjonalnie `MAX_FILE_SIZE_MB` (1–100, domyślnie 10).

`KSEF_NIP` i `KSEF_TOKEN` są wymagane przez profil produkcyjny, ale przy
aktualnym adapterze `mock` pełnią rolę przygotowania konfiguracji pod przyszłą
realną integrację i nie są jeszcze używane do komunikacji z KSeF.

Żadna z tych wartości nie może mieć prefiksu `NEXT_PUBLIC_`.

## Backup i preflight

Przed każdą migracją istniejącego środowiska:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=invoice-manager-before-migrate.dump
npm ci
npx prisma generate
npm run db:preflight
```

Preflight nie modyfikuje danych i przerywa pracę, jeżeli nazwy kategorii
naruszają nową unikalność rodzeństwa. Nie scala i nie usuwa rekordów.

Odtworzenie kopii w nowej bazie testowej:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" invoice-manager-before-migrate.dump
```

## Migracja i start

Migracje są osobnym krokiem release, a nie częścią startu każdej repliki:

```bash
npx prisma migrate deploy
npx prisma migrate status
node .next/standalone/server.js
```

Albo profilem kontenerowym:

```bash
docker compose -f docker-compose.production.yml config
docker compose -f docker-compose.production.yml up --build -d
docker compose -f docker-compose.production.yml ps
```

Serwis `migrate` musi zakończyć się kodem 0 przed uruchomieniem `app`.
Runtime jest minimalnym standalone image i otrzymuje `SIGTERM` bezpośrednio.

## Walidacja po deployu

```bash
curl --fail https://PUBLIC_HOST/api/health
```

Następnie wykonać smoke test: upload kosztowego i sprzedażowego XML, upload PDF,
akceptacja bufora, odczyt rejestru, podgląd pliku, ręczny dokument i ręczne
uruchomienie harmonogramu. Po restarcie kontenera ponownie sprawdzić załączniki
oraz log `[attachment-reconciliation]`.

## Rollback

1. zatrzymać aplikację;
2. przywrócić poprzedni obraz;
3. jeżeli zmiana schematu nie jest kompatybilna wstecz, odtworzyć zweryfikowany
   dump do nowej bazy i przełączyć `DATABASE_URL`;
4. nie uruchamiać ręcznych `DELETE`/`UPDATE` na produkcji bez osobnego skryptu i
   kopii.
