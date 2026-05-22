export type CoraTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

export type CoraInvoiceResponse = {
  id?: string;
  code?: string;
  status?: string;
  bank_slip?: {
    our_number?: string;
    type_full_code?: string;
    barcode?: string;
    url?: string;
  };
  pix?: {
    qr_code?: string;
    qr_code_url?: string;
  };
};

export type CoraInvoicePayload = {
  code: string;
  customer: {
    name: string;
    email: string;
    document: { identity: string; type: "CPF" | "CNPJ" };
    address: {
      street: string;
      number: string;
      district: string;
      city: string;
      state: string;
      complement?: string;
      zip_code: string;
    };
  };
  services: Array<{ name: string; description: string; amount: number }>;
  payment_terms: { due_date: string };
  payment_forms: Array<"BANK_SLIP" | "PIX">;
};
