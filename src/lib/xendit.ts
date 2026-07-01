const API_BASE = "https://api.xendit.co";

function authHeader(): string {
  // Xendit API auth: HTTP Basic with the secret key as username, blank password.
  return "Basic " + Buffer.from(`${process.env.XENDIT_SECRET_KEY}:`).toString("base64");
}

export type CreateInvoiceParams = {
  externalId: string;
  amount: number;
  payerEmail: string;
  payerName: string;
  description: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
};

export async function createInvoice(
  params: CreateInvoiceParams
): Promise<{ id: string; invoice_url: string } | null> {
  if (!process.env.XENDIT_SECRET_KEY) return null;

  const res = await fetch(`${API_BASE}/v2/invoices`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: authHeader(),
    },
    body: JSON.stringify({
      external_id: params.externalId,
      amount: params.amount,
      currency: "PHP",
      payer_email: params.payerEmail,
      description: params.description,
      customer: { given_names: params.payerName, email: params.payerEmail },
      success_redirect_url: params.successRedirectUrl,
      failure_redirect_url: params.failureRedirectUrl,
    }),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.id || !json?.invoice_url) return null;
  return { id: json.id, invoice_url: json.invoice_url };
}

export async function getInvoiceStatus(
  invoiceId: string
): Promise<{ status: string; paid_amount: number | null } | null> {
  if (!process.env.XENDIT_SECRET_KEY) return null;

  const res = await fetch(`${API_BASE}/v2/invoices/${encodeURIComponent(invoiceId)}`, {
    headers: { authorization: authHeader() },
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.status) return null;
  return { status: json.status, paid_amount: json.paid_amount ?? null };
}

export function verifyWebhookToken(headerValue: string | null): boolean {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || !headerValue) return false;
  return headerValue === expected;
}

// Best-effort: Xendit's refund support varies by the channel the customer
// actually paid with (card vs e-wallet vs bank transfer). Rather than branch
// on channel ourselves, we attempt the refund against the invoice and let
// the caller fall back to a manual reference number if Xendit rejects it.
export async function refundInvoicePayment(params: {
  invoiceId: string;
  amount: number;
}): Promise<{ id: string } | null> {
  if (!process.env.XENDIT_SECRET_KEY) return null;

  const res = await fetch(`${API_BASE}/refunds`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: authHeader(),
      "idempotency-key": `refund-${params.invoiceId}`,
    },
    body: JSON.stringify({
      invoice_id: params.invoiceId,
      amount: params.amount,
      reason: "REQUESTED_BY_CUSTOMER",
    }),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.id) return null;
  return { id: json.id };
}
