import {
  createKSeFClient,
  MockKSeFClient,
} from "@/lib/ksef/ksef-mock.client";
import { validateNip } from "@/lib/validators/nip";

it("returns the same deterministic KSeF documents for the same request", async () => {
  const client = new MockKSeFClient();
  const params = {
    dateFrom: "2026-07-01",
    dateTo: "2026-07-31",
    type: "SALES" as const,
  };

  const first = await client.fetchInvoices(params);
  const second = await client.fetchInvoices(params);

  expect(second).toEqual(first);
  expect(new Set(first.map((invoice) => invoice.ksefNumber)).size).toBe(
    first.length,
  );
  for (const invoice of first) {
    expect(validateNip(invoice.seller.nip).valid).toBe(true);
    expect(validateNip(invoice.buyer.nip).valid).toBe(true);
  }
});

it("returns valid sales-party NIPs for the range that previously selected Hurtownia Smakosz", async () => {
  const client = new MockKSeFClient();
  const invoices = await client.fetchInvoices({
    dateFrom: "2026-06-16",
    dateTo: "2026-07-16",
    type: "SALES",
  });

  expect(invoices.some((invoice) => invoice.buyer.nip === "9988776652")).toBe(
    true,
  );
  for (const invoice of invoices) {
    expect(validateNip(invoice.seller.nip).valid).toBe(true);
    expect(validateNip(invoice.buyer.nip).valid).toBe(true);
  }
});

it("does not silently fall back to mock for an unsupported environment", () => {
  const previous = process.env.KSEF_ENV;
  process.env.KSEF_ENV = "production";
  try {
    expect(() => createKSeFClient()).toThrow("Nieobsługiwane środowisko KSeF");
  } finally {
    if (previous === undefined) delete process.env.KSEF_ENV;
    else process.env.KSEF_ENV = previous;
  }
});
