import { type Router as RouterType, Router } from "express";
import { requireOrgRole } from "../middleware/requireOrgRole";

const router: RouterType = Router({ mergeParams: true });

const BILLING_URL = (process.env.BILLING_SERVICE_URL ?? "").replace(/\/$/, "");
const BILLING_SECRET = process.env.BILLING_SECRET ?? "";

async function proxyGet(
  billingPath: string,
  params: URLSearchParams,
): Promise<{ status: number; body: unknown }> {
  if (!BILLING_URL) {
    return { status: 503, body: { error: "Billing service not configured" } };
  }
  try {
    const res = await fetch(`${BILLING_URL}${billingPath}?${params}`, {
      headers: { "x-billing-secret": BILLING_SECRET },
    });
    const body = await res.json();
    return { status: res.status, body };
  } catch (err) {
    console.error("[billing proxy] GET error:", err);
    return { status: 503, body: { error: "Billing service unavailable" } };
  }
}

async function proxyPost(
  billingPath: string,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  if (!BILLING_URL) {
    return { status: 503, body: { error: "Billing service not configured" } };
  }
  try {
    const res = await fetch(`${BILLING_URL}${billingPath}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-billing-secret": BILLING_SECRET,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { status: res.status, body: data };
  } catch (err) {
    console.error("[billing proxy] POST error:", err);
    return { status: 503, body: { error: "Billing service unavailable" } };
  }
}

async function proxyPut(
  billingPath: string,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  if (!BILLING_URL) {
    return { status: 503, body: { error: "Billing service not configured" } };
  }
  try {
    const res = await fetch(`${BILLING_URL}${billingPath}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-billing-secret": BILLING_SECRET,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { status: res.status, body: data };
  } catch (err) {
    console.error("[billing proxy] PUT error:", err);
    return { status: 503, body: { error: "Billing service unavailable" } };
  }
}

router.get("/balance", async (req, res) => {
  const params = new URLSearchParams({ organisation_id: req.organizationId! });
  const result = await proxyGet("/api/balance", params);
  res.status(result.status).json(result.body);
});

router.get("/can-run", async (req, res) => {
  const runType = typeof req.query.runType === "string" ? req.query.runType : "";
  if (!runType) {
    res.status(400).json({ error: "runType query parameter is required" });
    return;
  }
  const params = new URLSearchParams({
    organisation_id: req.organizationId!,
    run_type: runType,
  });
  const result = await proxyGet("/api/can-run", params);
  res.status(result.status).json(result.body);
});

router.get("/usage", async (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  if (!from || !to) {
    res.status(400).json({ error: "from and to query parameters are required" });
    return;
  }
  const params = new URLSearchParams({
    organisation_id: req.organizationId!,
    from,
    to,
  });
  const result = await proxyGet("/api/usage", params);
  res.status(result.status).json(result.body);
});

router.put("/account", requireOrgRole("super_admin"), async (req, res) => {
  const result = await proxyPut("/api/account", {
    organisation_id: req.organizationId!,
    ...req.body,
  });
  res.status(result.status).json(result.body);
});

router.post("/account/add-credits", requireOrgRole("super_admin"), async (req, res) => {
  const result = await proxyPost("/api/account/add-credits", {
    organisation_id: req.organizationId!,
    ...req.body,
  });
  res.status(result.status).json(result.body);
});

export default router;
