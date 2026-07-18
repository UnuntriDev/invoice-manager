-- Pierwsza migracja danych użyła czytelnych identyfikatorów technicznych,
-- podczas gdy API i formularze wymagają identyfikatorów w formacie CUID.
-- Relacja Document.documentTypeId ma ON UPDATE CASCADE, więc istniejące
-- dokumenty zachowują powiązanie podczas zmiany klucza głównego.
UPDATE "DocumentType"
SET "id" = 'cme586d83fb138b370614fda95'
WHERE
    "name" = 'Faktura sprzedażowa'
    AND "id" <> 'cme586d83fb138b370614fda95';

UPDATE "DocumentType"
SET "id" = 'cmbd12ee662a528ef45f904d00'
WHERE
    "name" = 'Faktura kosztowa'
    AND "id" <> 'cmbd12ee662a528ef45f904d00';
