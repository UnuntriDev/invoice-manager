import {
  IKSeFClient,
  KSeFFetchParams,
  KSeFInvoice,
  KSeFInvoiceLineItem,
} from "./ksef-client.interface";
import { Decimal } from "@/lib/money";
import { createHash } from "crypto";
import { validateNip } from "@/lib/validators/nip";

interface MockParty {
  nip: string;
  name: string;
  address: string;
}

function mockParty(party: MockParty): MockParty {
  if (!validateNip(party.nip).valid) {
    throw new Error(
      `Nieprawidłowy NIP w danych mock KSeF dla ${party.name}: ${party.nip}`,
    );
  }
  return party;
}

const MOCK_SUPPLIERS = [
  mockParty({ nip: "5213000009", name: "PackPol Sp. z o.o.", address: "ul. Przemysłowa 15, 00-001 Warszawa" }),
  mockParty({ nip: "5261040828", name: "CukroPol S.A.", address: "ul. Cukrownicza 8, 60-100 Poznań" }),
  mockParty({ nip: "6181003642", name: "EkoNawóz Jan Kowalski", address: "ul. Rolna 3, 33-300 Nowy Sącz" }),
  mockParty({ nip: "1132191233", name: "TransChłód Sp. z o.o.", address: "ul. Logistyczna 22, 40-200 Katowice" }),
];

const MOCK_BUYERS = [
  mockParty({ nip: "6762464586", name: "Cukiernia Słodki Róg Sp. z o.o.", address: "ul. Floriańska 23, 31-019 Kraków" }),
  mockParty({ nip: "5566778891", name: "Sieć Delikatesy Natura Sp. z o.o.", address: "ul. Handlowa 5, 50-100 Wrocław" }),
  mockParty({ nip: "9988776652", name: "Hurtownia Smakosz S.A.", address: "ul. Targowa 12, 90-001 Łódź" }),
];

const GUMIJAGODA = mockParty({
  nip: "9876543210",
  name: "Gumijagoda Sp. z o.o.",
  address: "ul. Beskidzka 7, 34-500 Zakopane",
});

const MOCK_PRODUCTS_COST = [
  { desc: "Opakowania kartonowe 500ml (paleta)", unit: "szt", price: "1200.00" },
  { desc: "Cukier biały (tona)", unit: "t", price: "3200.00" },
  { desc: "Nawóz organiczny BioGrow 25kg", unit: "szt", price: "89.00" },
  { desc: "Transport chłodniczy Zakopane-Warszawa", unit: "kurs", price: "2800.00" },
  { desc: "Etykiety samoprzylepne (rolka 5000szt)", unit: "szt", price: "180.00" },
  { desc: "Folia termokurczliwa 200m", unit: "szt", price: "150.00" },
  { desc: "Słoiki szklane 350ml (paleta 500szt)", unit: "szt", price: "950.00" },
];

const MOCK_PRODUCTS_SALES = [
  { desc: "Żelki gumijagodowe premium 200g (karton 48szt)", unit: "karton", price: "180.00" },
  { desc: "Syrop gumijagodowy 500ml (karton 12szt)", unit: "karton", price: "150.00" },
  { desc: "Konfitura gumijagodowa 300g (karton 24szt)", unit: "karton", price: "220.00" },
  { desc: "Żelki gumijagodowe classic 100g (karton 96szt)", unit: "karton", price: "240.00" },
  { desc: "Mix prezentowy gumijagodowy (karton 12szt)", unit: "karton", price: "360.00" },
];

function deterministicInt(seed: string, min: number, max: number): number {
  const digest = createHash("sha256").update(seed).digest("hex");
  const value = Number.parseInt(digest.slice(0, 12), 16);
  return min + (value % (max - min + 1));
}

function deterministicDate(from: string, to: string, seed: string): string {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  const days = Math.max(0, Math.floor((end - start) / 86_400_000));
  const offset = deterministicInt(seed, 0, days);
  return new Date(start + offset * 86_400_000).toISOString().slice(0, 10);
}

function generateKSeFNumber(seed: string): string {
  const digits = createHash("sha256")
    .update(seed)
    .digest("hex")
    .split("")
    .map((char) => String(Number.parseInt(char, 16) % 10))
    .join("");
  return `${digits.slice(0, 10)}-${digits.slice(10, 12)}-${digits.slice(12, 18)}`;
}

function generateInvoiceNumber(type: "COST" | "SALES", date: string, index: number): string {
  const [year, month] = date.split("-");
  const prefix = type === "COST" ? "FV" : "GJ";
  return `${prefix}/${year}/${month}/${String(index).padStart(3, "0")}`;
}

function generateMockXml(invoice: Omit<KSeFInvoice, "xmlContent">): string {
  const lineItemsXml = invoice.lineItems
    .map(
      (item) => `
      <FaWiersz>
        <NrWiersza>${item.lineNumber}</NrWiersza>
        <P_7>${item.description}</P_7>
        <P_8A>${item.unit}</P_8A>
        <P_8B>${item.quantity}</P_8B>
        <P_9A>${item.unitPriceNet}</P_9A>
        <P_11>${item.amountNet}</P_11>
        <P_12>${item.vatRate}</P_12>
      </FaWiersz>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>${invoice.issueDate}T12:00:00</DataWytworzeniaFa>
    <SystemInfo>MockKSeF v1.0</SystemInfo>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>${invoice.seller.nip}</NIP>
      <Nazwa>${invoice.seller.name}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>${invoice.seller.address?.split(",")[0] || ""}</AdresL1>
      <AdresL2>${invoice.seller.address?.split(",")[1]?.trim() || ""}</AdresL2>
    </Adres>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>${invoice.buyer.nip}</NIP>
      <Nazwa>${invoice.buyer.name}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>${invoice.buyer.address?.split(",")[0] || ""}</AdresL1>
      <AdresL2>${invoice.buyer.address?.split(",")[1]?.trim() || ""}</AdresL2>
    </Adres>
  </Podmiot2>
  <Fa>
    <KodWaluty>${invoice.currency}</KodWaluty>
    <P_1>${invoice.issueDate}</P_1>
    <P_2>${invoice.invoiceNumber}</P_2>
    <P_6>${invoice.saleDate}</P_6>
    <P_15>VAT</P_15>
    <AdnotacjeVAT>
      <P_16>2</P_16><P_17>2</P_17><P_18>2</P_18><P_18A>2</P_18A>
      <P_19>2</P_19><P_22>2</P_22><P_23>2</P_23><P_PMarzy>2</P_PMarzy>
    </AdnotacjeVAT>
    <RodzajFaktury>VAT</RodzajFaktury>
    <FaWiersze>
      <LiczbaWierszyFaktur>${invoice.lineItems.length}</LiczbaWierszyFaktur>
      <WartoscWierszyFaktur1>${invoice.amountNet}</WartoscWierszyFaktur1>
      ${lineItemsXml}
    </FaWiersze>
    <Podsumowanie>
      <P_13_1>${invoice.amountNet}</P_13_1>
      <P_14_1>${invoice.amountVat}</P_14_1>
    </Podsumowanie>
    <Platnosc>
      <TerminPlatnosci><Termin>${invoice.dueDate}</Termin></TerminPlatnosci>
      <FormaPlatnosci>6</FormaPlatnosci>
      ${invoice.bankAccountNumber ? `<RachunekBankowy><NrRB>${invoice.bankAccountNumber}</NrRB></RachunekBankowy>` : ""}
    </Platnosc>
  </Fa>
</Faktura>`;
}

export class MockKSeFClient implements IKSeFClient {
  private authenticated = false;

  async authenticate(): Promise<void> {
    this.authenticated = true;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  async fetchInvoices(params: KSeFFetchParams): Promise<KSeFInvoice[]> {
    if (!this.authenticated) {
      await this.authenticate();
    }

    const count = 4;
    const invoices: KSeFInvoice[] = [];

    for (let i = 0; i < count; i++) {
      const isCost = params.type === "COST";
      const seed = `${params.type}:${params.dateFrom}:${params.dateTo}:${i}`;
      const products = isCost ? MOCK_PRODUCTS_COST : MOCK_PRODUCTS_SALES;
      const counterparties = isCost ? MOCK_SUPPLIERS : MOCK_BUYERS;
      const counterparty = counterparties[
        deterministicInt(`${seed}:counterparty`, 0, counterparties.length - 1)
      ];

      const issueDate = deterministicDate(
        params.dateFrom,
        params.dateTo,
        `${seed}:date`,
      );
      const dueDate = new Date(`${issueDate}T00:00:00.000Z`);
      dueDate.setUTCDate(
        dueDate.getUTCDate() + deterministicInt(`${seed}:due`, 14, 60),
      );

      const lineCount = deterministicInt(`${seed}:lines`, 1, 4);
      const lineItems: KSeFInvoiceLineItem[] = [];
      let totalNet = new Decimal(0);

      for (let j = 0; j < lineCount; j++) {
        const product = products[
          deterministicInt(`${seed}:product:${j}`, 0, products.length - 1)
        ];
        const quantity = deterministicInt(`${seed}:quantity:${j}`, 1, 50);
        const amountNet = new Decimal(product.price).times(quantity).toFixed(2);
        totalNet = totalNet.plus(amountNet);

        lineItems.push({
          lineNumber: j + 1,
          description: product.desc,
          unit: product.unit,
          quantity,
          unitPriceNet: new Decimal(product.price).toFixed(2),
          amountNet,
          vatRate: isCost ? 23 : 8,
        });
      }

      const vatRate = isCost ? "0.23" : "0.08";
      const totalVat = totalNet.times(vatRate).toDecimalPlaces(2).toFixed(2);
      const totalGross = totalNet.plus(totalVat).toFixed(2);

      const invoiceData = {
        ksefNumber: generateKSeFNumber(seed),
        invoiceNumber: generateInvoiceNumber(params.type, issueDate, i + 1),
        issueDate,
        saleDate: issueDate,
        dueDate: dueDate.toISOString().slice(0, 10),
        currency: "PLN",
        seller: isCost ? counterparty : GUMIJAGODA,
        buyer: isCost ? GUMIJAGODA : counterparty,
        lineItems,
        amountNet: totalNet.toFixed(2),
        amountVat: totalVat,
        amountGross: totalGross,
        bankAccountNumber: "61109010140000071219812874",
      };

      invoices.push({
        ...invoiceData,
        xmlContent: generateMockXml(invoiceData),
      });
    }

    return invoices;
  }
}

export function createKSeFClient(): IKSeFClient {
  const env = process.env.KSEF_ENV || "mock";

  if (env === "mock") {
    return new MockKSeFClient();
  }

  throw new Error(`Nieobsługiwane środowisko KSeF: ${env}`);
}
