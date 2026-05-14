const BILLING_URL = (process.env.BILLING_SERVICE_URL ?? "").replace(/\/$/, "");
const BILLING_SECRET = process.env.BILLING_SECRET ?? "";

type ReserveResult = {
  allowed: boolean;
  reservation_id?: string;
  correlation_id: string;
};

export async function reserveBalance(
  organisationId: string,
  correlationId: string,
  runType: string,
): Promise<ReserveResult> {
  if (!BILLING_URL) {
    console.warn("[billing-client] BILLING_SERVICE_URL not set; skipping reservation");
    return { allowed: true, correlation_id: correlationId };
  }

  const res = await fetch(`${BILLING_URL}/api/reserve`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-billing-secret": BILLING_SECRET,
    },
    body: JSON.stringify({
      organisation_id: organisationId,
      correlation_id: correlationId,
      run_type: runType,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown billing error" }));
    throw new BillingError(
      res.status,
      (body as { error?: string }).error ?? "Billing request failed",
    );
  }

  return (await res.json()) as ReserveResult;
}

export class BillingError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}
