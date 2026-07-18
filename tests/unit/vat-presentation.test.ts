import {
  COLUMN_LABELS,
  getColumns,
} from "@/components/documents/document-columns";
import { formatCurrency, inferVatRate } from "@/lib/money";

it("presents aggregate VAT as an amount, not an invented mixed rate", () => {
  // 15.5% to iloraz, nie faktyczna stawka VAT
  expect(inferVatRate("200.00", "31.00")).toBe("15.5");
  expect(COLUMN_LABELS.amountVat).toBe("VAT");

  const vatColumn = getColumns(jest.fn(), jest.fn(), jest.fn()).find(
    (column) => "accessorKey" in column && column.accessorKey === "amountVat",
  ) as unknown as {
    header: (context?: unknown) => { props: { children: string } };
    cell: (context: { getValue: () => string }) => {
      props: { children: string };
    };
  };

  expect(vatColumn.header().props.children).toBe("VAT");
  const displayed = vatColumn.cell({ getValue: () => "31.00" }).props.children;
  expect(displayed).toBe(formatCurrency("31.00"));
  expect(displayed).not.toContain("%");
});
