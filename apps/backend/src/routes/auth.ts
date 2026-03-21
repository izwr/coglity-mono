import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { db } from "../db.js";
import { users } from "@coglity/shared/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.AZURE_REDIRECT_URI || "http://localhost:3001/api/auth/callback";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const AUTHORIZE_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

// GET /api/auth/login — redirect to Microsoft
router.get("/login", (req, res) => {
  if (!CLIENT_ID || !TENANT_ID) {
    res.status(500).json({ error: "OAuth not configured" });
    return;
  }

  const state = crypto.randomBytes(32).toString("hex");
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "openid profile email",
    response_mode: "query",
    state,
  });

  req.session.save(() => {
    res.redirect(`${AUTHORIZE_URL}?${params.toString()}`);
  });
});

// GET /api/auth/callback — exchange code for tokens, upsert user, create session
router.get("/callback", async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    res.redirect(`${CLIENT_URL}/login?error=${encodeURIComponent(String(oauthError))}`);
    return;
  }

  if (!code || !state || state !== req.session.oauthState) {
    res.redirect(`${CLIENT_URL}/login?error=invalid_state`);
    return;
  }

  delete req.session.oauthState;

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        code: String(code),
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      console.error("Token exchange failed:", body);
      res.redirect(`${CLIENT_URL}/login?error=token_exchange_failed`);
      return;
    }

    const tokens = (await tokenResponse.json()) as { id_token: string };

    // Decode ID token payload (received directly from Microsoft over HTTPS)
    const payload = JSON.parse(
      Buffer.from(tokens.id_token.split(".")[1], "base64url").toString(),
    ) as {
      oid: string;
      preferred_username?: string;
      email?: string;
      name?: string;
    };

    const entraId = payload.oid;
    const email = payload.preferred_username || payload.email || "";
    const displayName = payload.name || email;

    // Upsert user
    const [user] = await db
      .insert(users)
      .values({ entraId, email, displayName })
      .onConflictDoUpdate({
        target: users.entraId,
        set: { email, displayName, updatedAt: new Date() },
      })
      .returning();

    // Populate session
    req.session.userId = user.id;
    req.session.entraId = user.entraId;
    req.session.email = user.email;
    req.session.displayName = user.displayName;

    req.session.save(() => {
      res.redirect(CLIENT_URL);
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.redirect(`${CLIENT_URL}/login?error=server_error`);
  }
});

// GET /api/auth/me — return current user
router.get("/me", async (req, res) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, req.session.userId));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

// POST /api/auth/logout — destroy session
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

export default router;