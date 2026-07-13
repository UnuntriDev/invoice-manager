export interface KSeFInvoiceLineItem {
  lineNumber: number;
  description: string;
  unit: string;
  quantity: number;
  unitPriceNet: number;
  amountNet: number;
  vatRate: number;
}

export interface KSeFParty {
  nip: string;
  name: string;
  address?: string;
  countryCode?: string;
}

export interface KSeFInvoice {
  ksefNumber: string;
  invoiceNumber: string;
  issueDate: string;
  saleDate: string;
  dueDate: string;
  currency: string;
  seller: KSeFParty;
  buyer: KSeFParty;
  lineItems: KSeFInvoiceLineItem[];
  amountNet: number;
  amountVat: number;
  amountGross: number;
  bankAccountNumber?: string;
  xmlContent: string;
}

export interface KSeFFetchParams {
  dateFrom: string;
  dateTo: string;
  type: "COST" | "SALES";
}

export interface IKSeFClient {
  authenticate(): Promise<void>;
  fetchInvoices(params: KSeFFetchParams): Promise<KSeFInvoice[]>;
  isAuthenticated(): boolean;
}
