import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    entraId: string;
    email: string;
    displayName: string;
    oauthState?: string;
  }
}