-- Typy wymagane przez import KSeF i upload XML muszą istnieć również wtedy,
-- gdy produkcyjna baza nie została wypełniona danymi demonstracyjnymi.
INSERT INTO "DocumentType" (
    "id",
    "name",
    "direction",
    "isSystem",
    "createdAt",
    "updatedAt"
)
VALUES
    (
        'system-invoice-receivable',
        'Faktura sprzedażowa',
        'RECEIVABLE',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'system-invoice-payable',
        'Faktura kosztowa',
        'PAYABLE',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT ("name") DO UPDATE
SET
    "direction" = EXCLUDED."direction",
    "isSystem" = true,
    "updatedAt" = CURRENT_TIMESTAMP;
