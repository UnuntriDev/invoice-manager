\set ON_ERROR_STOP on

-- Domyślnie skrypt wykonuje pełną symulację i kończy ją ROLLBACK.
-- Zapis zmian wymaga jawnego: psql -v APPLY_CATEGORY_DEDUP=YES ...

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('invoice-manager-category-dedup-v1'));

CREATE TEMP TABLE seeded_category_paths (
  logical_path text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO seeded_category_paths (logical_path)
VALUES
  ('Koszty operacyjne'),
  ('Koszty operacyjne / Surowce'),
  ('Koszty operacyjne / Opakowania'),
  ('Koszty operacyjne / Transport'),
  ('Koszty plantacji'),
  ('Koszty plantacji / Nawozy'),
  ('Koszty plantacji / Narzędzia'),
  ('Przychody'),
  ('Przychody / Sprzedaż hurtowa'),
  ('Przychody / Sprzedaż detaliczna');

CREATE TEMP TABLE category_path_snapshot ON COMMIT DROP AS
WITH RECURSIVE category_paths AS (
  SELECT
    c.id,
    c."parentId" AS parent_id,
    c.name,
    c."createdAt" AS created_at,
    ARRAY[c.name]::text[] AS path_parts,
    ARRAY[c.id]::text[] AS visited_ids
  FROM "Category" c
  WHERE c."parentId" IS NULL

  UNION ALL

  SELECT
    c.id,
    c."parentId" AS parent_id,
    c.name,
    c."createdAt" AS created_at,
    p.path_parts || c.name,
    p.visited_ids || c.id
  FROM "Category" c
  JOIN category_paths p ON c."parentId" = p.id
  WHERE NOT c.id = ANY(p.visited_ids)
)
SELECT
  id,
  parent_id,
  name,
  created_at,
  array_to_string(path_parts, ' / ') AS logical_path
FROM category_paths;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM category_path_snapshot) <>
     (SELECT COUNT(*) FROM "Category") THEN
    RAISE EXCEPTION
      'Nie wszystkie kategorie są osiągalne od korzeni. Przerwano z powodu możliwego cyklu lub uszkodzonego drzewa.';
  END IF;
END
$$;

\echo 'Wykryte duplikaty kategorii seedowych i wybrane rekordy kanoniczne:'
SELECT
  s.logical_path,
  COUNT(*) AS record_count,
  (ARRAY_AGG(s.id ORDER BY s.created_at, s.id))[1] AS canonical_id,
  ARRAY_AGG(s.id ORDER BY s.created_at, s.id) AS all_ids
FROM category_path_snapshot s
JOIN seeded_category_paths p USING (logical_path)
GROUP BY s.logical_path
HAVING COUNT(*) > 1
ORDER BY s.logical_path;

CREATE TEMP TABLE category_dedup_map ON COMMIT DROP AS
SELECT
  ranked.id AS duplicate_id,
  ranked.canonical_id,
  ranked.logical_path
FROM (
  SELECT
    s.id,
    s.logical_path,
    FIRST_VALUE(s.id) OVER (
      PARTITION BY s.logical_path
      ORDER BY s.created_at, s.id
    ) AS canonical_id,
    ROW_NUMBER() OVER (
      PARTITION BY s.logical_path
      ORDER BY s.created_at, s.id
    ) AS row_number
  FROM category_path_snapshot s
  JOIN seeded_category_paths p USING (logical_path)
) ranked
WHERE ranked.row_number > 1;

\echo 'Plan mapowania rekordów nadmiarowych na kanoniczne:'
SELECT logical_path, duplicate_id, canonical_id
FROM category_dedup_map
ORDER BY logical_path, duplicate_id;

UPDATE "Document" d
SET "categoryId" = m.canonical_id
FROM category_dedup_map m
WHERE d."categoryId" = m.duplicate_id;

UPDATE "Contractor" c
SET "defaultCategoryId" = m.canonical_id
FROM category_dedup_map m
WHERE c."defaultCategoryId" = m.duplicate_id;

UPDATE "CategorizationRule" r
SET "categoryId" = m.canonical_id
FROM category_dedup_map m
WHERE r."categoryId" = m.duplicate_id;

UPDATE "Category" c
SET "parentId" = m.canonical_id
FROM category_dedup_map m
WHERE c."parentId" = m.duplicate_id;

DELETE FROM "Category" c
USING category_dedup_map m
WHERE c.id = m.duplicate_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Document" d
    JOIN category_dedup_map m ON d."categoryId" = m.duplicate_id
  ) OR EXISTS (
    SELECT 1
    FROM "Contractor" c
    JOIN category_dedup_map m ON c."defaultCategoryId" = m.duplicate_id
  ) OR EXISTS (
    SELECT 1
    FROM "CategorizationRule" r
    JOIN category_dedup_map m ON r."categoryId" = m.duplicate_id
  ) OR EXISTS (
    SELECT 1
    FROM "Category" c
    JOIN category_dedup_map m ON c."parentId" = m.duplicate_id
  ) THEN
    RAISE EXCEPTION 'Po mapowaniu pozostały zależności do nadmiarowych kategorii.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM category_path_snapshot s
    JOIN "Category" c ON c.id = s.id
    JOIN seeded_category_paths p USING (logical_path)
    GROUP BY s.logical_path
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Po deduplikacji nadal istnieją duplikaty ścieżek seedowych.';
  END IF;
END
$$;

\echo 'Stan po symulowanej deduplikacji (przed COMMIT/ROLLBACK):'
SELECT
  (SELECT COUNT(*) FROM category_dedup_map) AS removed_duplicates,
  (SELECT COUNT(*)
   FROM category_path_snapshot s
   JOIN "Category" c ON c.id = s.id
   JOIN seeded_category_paths p USING (logical_path)) AS remaining_seed_categories,
  (SELECT COUNT(*) FROM "Category") AS all_categories;

\if :{?APPLY_CATEGORY_DEDUP}
  SELECT :'APPLY_CATEGORY_DEDUP' = 'YES' AS should_apply \gset
\else
  \set should_apply false
\endif

\if :should_apply
  \echo 'APPLY_CATEGORY_DEDUP=YES: zatwierdzanie zmian.'
  COMMIT;
\else
  \echo 'Tryb bezpieczny: wycofywanie wszystkich zmian. Aby zatwierdzić, użyj -v APPLY_CATEGORY_DEDUP=YES.'
  ROLLBACK;
\endif
