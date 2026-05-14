import { z } from "zod/v4";
import { router } from "../lib/router";
import { getUsage, AccountNotFoundError } from "../services/billing";

const orgIdSchema = z.uuid();

router.get("/api/usage", async (req) => {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("organisation_id") ?? "";
  const fromStr = url.searchParams.get("from") ?? "";
  const toStr = url.searchParams.get("to") ?? "";

  const orgParsed = orgIdSchema.safeParse(orgId);
  if (!orgParsed.success) {
    return Response.json(
      { error: "organisation_id is required and must be a valid UUID" },
      { status: 400 },
    );
  }

  const from = new Date(fromStr);
  const to = new Date(toStr);

  if (isNaN(from.getTime())) {
    return Response.json(
      { error: "from is required and must be a valid ISO date" },
      { status: 400 },
    );
  }
  if (isNaN(to.getTime())) {
    return Response.json(
      { error: "to is required and must be a valid ISO date" },
      { status: 400 },
    );
  }
  if (from >= to) {
    return Response.json(
      { error: "from must be before to" },
      { status: 400 },
    );
  }

  try {
    const data = await getUsage(orgParsed.data, from, to);
    return Response.json({ data });
  } catch (err) {
    if (err instanceof AccountNotFoundError) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
});
