import { z } from "zod/v4";
import { router } from "../lib/router";
import {
  getBalance,
  canRun,
  AccountNotFoundError,
  RunTypeNotFoundError,
} from "../services/billing";

const orgIdSchema = z.uuid();

router.get("/api/balance", async (req) => {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("organisation_id") ?? "";

  const parsed = orgIdSchema.safeParse(orgId);
  if (!parsed.success) {
    return Response.json(
      { error: "organisation_id is required and must be a valid UUID" },
      { status: 400 },
    );
  }

  try {
    const result = await getBalance(parsed.data);
    return Response.json(result);
  } catch (err) {
    if (err instanceof AccountNotFoundError) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
});

router.get("/api/can-run", async (req) => {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("organisation_id") ?? "";
  const runType = url.searchParams.get("run_type") ?? "";

  const orgParsed = orgIdSchema.safeParse(orgId);
  if (!orgParsed.success) {
    return Response.json(
      { error: "organisation_id is required and must be a valid UUID" },
      { status: 400 },
    );
  }
  if (!runType) {
    return Response.json(
      { error: "run_type is required" },
      { status: 400 },
    );
  }

  try {
    const result = await canRun(orgParsed.data, runType);
    return Response.json(result);
  } catch (err) {
    if (err instanceof AccountNotFoundError) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof RunTypeNotFoundError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
});
