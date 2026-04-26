import * as cloudflare from "@pulumi/cloudflare";
import * as tls from "@pulumi/tls";
import * as azure from "@pulumi/azure-native";
import * as pulumi from "@pulumi/pulumi";

export function createCloudflareProvider(
  apiToken: pulumi.Input<string>,
): cloudflare.Provider {
  return new cloudflare.Provider("cf", { apiToken });
}

export interface UiCnameArgs {
  provider: cloudflare.Provider;
  zoneId: pulumi.Input<string>;
  /** Full hostname, e.g. "studio.coglity.com" */
  hostname: string;
  /** Origin FQDN that Cloudflare proxies to, e.g. <ui-app>.<env>.azurecontainerapps.io */
  originFqdn: pulumi.Input<string>;
}

export function createUiCnameRecord(args: UiCnameArgs): cloudflare.DnsRecord {
  return new cloudflare.DnsRecord(
    "ui-cname",
    {
      zoneId: args.zoneId,
      name: args.hostname,
      type: "CNAME",
      content: args.originFqdn,
      ttl: 1, // 1 = automatic (required when proxied)
      proxied: true,
    },
    { provider: args.provider },
  );
}

export interface LandingCnameArgs {
  provider: cloudflare.Provider;
  zoneId: pulumi.Input<string>;
  /** Origin FQDN for the landing container app */
  originFqdn: pulumi.Input<string>;
}

export function createLandingCnameRecords(args: LandingCnameArgs) {
  const root = new cloudflare.DnsRecord(
    "landing-cname-root",
    {
      zoneId: args.zoneId,
      name: "@",
      type: "CNAME",
      content: args.originFqdn,
      ttl: 1,
      proxied: true,
    },
    { provider: args.provider },
  );

  const www = new cloudflare.DnsRecord(
    "landing-cname-www",
    {
      zoneId: args.zoneId,
      name: "www",
      type: "CNAME",
      content: args.originFqdn,
      ttl: 1,
      proxied: true,
    },
    { provider: args.provider },
  );

  return { root, www };
}

export interface AsuidTxtArgs {
  provider: cloudflare.Provider;
  zoneId: pulumi.Input<string>;
  /** Full hostname, e.g. "studio.coglity.com" TXT will be created at asuid.<hostname> */
  hostname: string;
  /** Subscription-level customDomainVerificationId from azure.app.getCustomDomainVerificationId */
  verificationId: pulumi.Input<string>;
}

/**
 * Cloudflare TXT record at `asuid.<hostname>` for Container Apps custom hostname
 * ownership verification. Required before binding a custom domain to a Container App.
 */
export function createAsuidTxtRecord(args: AsuidTxtArgs): cloudflare.DnsRecord {
  return new cloudflare.DnsRecord(
    "ui-asuid-txt",
    {
      zoneId: args.zoneId,
      name: `asuid.${args.hostname}`,
      type: "TXT",
      content: args.verificationId,
      ttl: 1, // automatic
      proxied: false, // TXT records cannot be proxied
    },
    { provider: args.provider },
  );
}

export interface OriginCertArgs {
  provider: cloudflare.Provider;
  /** Full hostname for the cert, e.g. "studio.coglity.com" */
  hostname: string;
  /** Container Apps environment to upload the cert into */
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  environmentName: pulumi.Input<string>;
}

/**
 * Provisions a Cloudflare Origin CA certificate for the given hostname and
 * uploads it to the Container Apps environment as a regular Certificate (not
 * a managed cert no chicken-and-egg with hostname binding).
 *
 * Cloudflare Origin CA certs are free, valid for 15 years, and only trusted by
 * Cloudflare itself perfect for terminating TLS on the origin when Cloudflare
 * is the only client.
 *
 * NOTE: the Cloudflare API token must include the "SSL and Certificates: Edit"
 * permission scoped to the zone (or "User: API Tokens: Edit" if using a
 * legacy origin CA key).
 */
export function createOriginCertificate(args: OriginCertArgs) {
  // 1. Private key for the cert
  const privateKey = new tls.PrivateKey("ui-origin-key", {
    algorithm: "RSA",
    rsaBits: 2048,
  });

  // 2. Certificate Signing Request
  const csr = new tls.CertRequest("ui-origin-csr", {
    privateKeyPem: privateKey.privateKeyPem,
    subject: {
      commonName: args.hostname,
    },
    dnsNames: [args.hostname],
  });

  // 3. Submit CSR to Cloudflare → receive signed cert
  const cfCert = new cloudflare.OriginCaCertificate(
    "ui-origin-cert",
    {
      csr: csr.certRequestPem,
      hostnames: [args.hostname],
      requestType: "origin-rsa",
      requestedValidity: 5475, // 15 years (max)
    },
    { provider: args.provider },
  );

  // 4. Concatenate cert + private key into a PEM bundle, base64-encode it
  const pemBundle = pulumi
    .all([cfCert.certificate, privateKey.privateKeyPem])
    .apply(([cert, key]) =>
      Buffer.from(`${cert.trim()}\n${key.trim()}\n`).toString("base64"),
    );

  // 5. Upload to Container Apps environment as a regular Certificate
  const containerAppCert = new azure.app.Certificate("ui-origin-cert-upload", {
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    environmentName: args.environmentName,
    certificateName: `${args.hostname.replace(/\./g, "-")}-origin`,
    properties: {
      value: pemBundle,
      certificateType: azure.app.CertificateType.ServerSSLCertificate,
    },
  });

  return { containerAppCert, privateKey, cfCert };
}