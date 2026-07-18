-- Korekta sumy kontrolnej znanego demonstracyjnego kontrahenta KSeF.
-- Nie scala rekordów: przy konflikcie przerywa migrację i wymaga ręcznego
-- wskazania rekordu kanonicznego.
DO $$
DECLARE
  source_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO source_count
  FROM "Contractor"
  WHERE "nip" IN ('9988776655', '9988776659');

  IF source_count > 1 THEN
    RAISE EXCEPTION
      'Konflikt korekty NIP Hurtowni Smakosz: istnieje więcej niż jeden stary rekord. Wybierz rekord kanoniczny ręcznie.';
  END IF;

  IF source_count = 1
     AND EXISTS (SELECT 1 FROM "Contractor" WHERE "nip" = '9988776652') THEN
    RAISE EXCEPTION
      'Konflikt korekty NIP Hurtowni Smakosz: poprawny rekord 9988776652 już istnieje. Wybierz rekord kanoniczny ręcznie.';
  END IF;

  UPDATE "Contractor"
  SET "nip" = '9988776652', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "nip" IN ('9988776655', '9988776659');
END $$;
