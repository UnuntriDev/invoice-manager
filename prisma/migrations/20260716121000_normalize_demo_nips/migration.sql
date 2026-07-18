-- Korekta wyłącznie znanych, demonstracyjnych numerów z poprzedniego seeda.
-- Migracja nie scala ani nie usuwa kontrahentów. Jeśli poprawny rekord już
-- istnieje obok starego, przerywa pracę i wymaga ręcznego wyboru kanonicznego.
DO $$
DECLARE
  mapping RECORD;
BEGIN
  FOR mapping IN
    SELECT * FROM (VALUES
      ('5213000000', '5213000009'),
      ('6181003648', '6181003642'),
      ('6762464585', '6762464586'),
      ('5566778899', '5566778891'),
      ('9988776655', '9988776659')
    ) AS values_table(old_nip, new_nip)
  LOOP
    IF EXISTS (SELECT 1 FROM "Contractor" WHERE "nip" = mapping.old_nip)
       AND EXISTS (SELECT 1 FROM "Contractor" WHERE "nip" = mapping.new_nip) THEN
      RAISE EXCEPTION
        'Konflikt korekty NIP: istnieją rekordy % oraz %. Wybierz rekord kanoniczny ręcznie.',
        mapping.old_nip,
        mapping.new_nip;
    END IF;

    UPDATE "Contractor"
    SET "nip" = mapping.new_nip, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "nip" = mapping.old_nip;
  END LOOP;
END $$;
