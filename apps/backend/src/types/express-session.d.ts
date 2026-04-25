import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    entraId?: string;
    googleId?: string;
    email: string;
    displayName: string;
    oauthState?: string;
  }
}