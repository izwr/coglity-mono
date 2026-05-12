import { reserveRequestSchema } from "@coglity/shared/schema";
import { router } from "../lib/router";
import {
  reserve,
  AccountNotFoundError,
  RunTypeNotFoundError,
} from "../services/billing";

router.post("/api/reserve", async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reserveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { organisation_id, correlation_id, run_type } = parsed.data;

  try {
    const result = await reserve(organisation_id, correlation_id, run_type);
    return Response.json({
      allowed: result.allowed,
      reservation_id: result.reservationId,
      correlation_id,
    });
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
