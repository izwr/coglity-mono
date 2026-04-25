import { ChainedTokenCredential, AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";

// Deliberately skip EnvironmentCredential: the backend's Entra SSO app creds
// (AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET) are forwarded into
// this process by turbo's globalPassThroughEnv, and DefaultAzureCredential would
// pick them up first — that identity doesn't hold storage or AOAI roles.
//
// Order: az login first (fast locally), managed identity fallback (prod).
// ManagedIdentityCredential hangs for minutes on macOS (tries to reach
// 169.254.169.254 IMDS which doesn't exist). Putting AzureCli first
// makes local dev instant; in Azure, AzureCli fails fast and MI kicks in.
export const azureCredential = new ChainedTokenCredential(
  new AzureCliCredential(),
  new ManagedIdentityCredential(),
);