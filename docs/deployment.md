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

## Railway

Repozytorium zawiera `railway.json`. Railway buduje finalny etap pliku
`Dockerfile`, wykonuje `prisma migrate deploy` jako pre-deploy command, a po
starcie sprawdza `/api/health`.

1. Utwórz projekt z repozytorium GitHub i dodaj usługę PostgreSQL.
2. W usłudze aplikacji ustaw `DATABASE_URL=${{Postgres.DATABASE_URL}}` oraz
   pozostałe zmienne opisane wyżej.
3. Dołącz trwały volume pod `/app/uploads` i ustaw `UPLOAD_DIR=/app/uploads`.
4. Ponieważ Railway montuje volume jako `root`, ustaw `RAILWAY_RUN_UID=0`.
   Obraz nadal działa jako nieuprzywilejowany `nextjs` poza Railway.
5. Po udanym deployu wygeneruj domenę publiczną i sprawdź `/api/health`.

Nie uruchamiaj seeda automatycznie podczas wdrożenia. Dane demonstracyjne można
dodać tylko świadomie, jednorazowo, z konsoli Railway.

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
