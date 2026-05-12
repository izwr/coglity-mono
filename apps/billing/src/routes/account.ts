import { z } from "zod/v4";
import { router } from "../lib/router";
import {
  updateAccount,
  addCredits,
  AccountNotFoundError,
} from "../services/billing";

const updateAccountSchema = z.object({
  organisation_id: z.uuid(),
  account_type: z.enum(["credit", "debit"]).optional(),
  consumption_limit: z.number().min(0).optional(),
});

const addCreditsSchema = z.object({
  organisation_id: z.uuid(),
  amount: z.number().positive("Amount must be positive"),
});

router.put("/api/account", async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { organisation_id, account_type, consumption_limit } = parsed.data;

  if (account_type === undefined && consumption_limit === undefined) {
    return Response.json(
      { error: "At least one field (account_type or consumption_limit) is required" },
      { status: 400 },
    );
  }

  try {
    const updated = await updateAccount(organisation_id, {
      accountType: account_type,
      consumptionLimit: consumption_limit,
    });
    return Response.json(updated);
  } catch (err) {
    if (err instanceof AccountNotFoundError) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
});

router.post("/api/account/add-credits", async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = addCreditsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const updated = await addCredits(
      parsed.data.organisation_id,
      parsed.data.amount,
    );
    return Response.json(updated);
  } catch (err) {
    if (err instanceof AccountNotFoundError) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
});
