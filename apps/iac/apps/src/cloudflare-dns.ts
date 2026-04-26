import * as cloudflare from "@pulumi/cloudflare";
import * as tls from "@pulumi/tls";
import * as azure from "@pulumi/azure-native";
import * as pulumi from "@pulumi/pulumi";

export function createCloudflareProvider(
  apiToken: pulumi.Input<string>,
): cloudflare.Provider {
  return new cloudflare.Provider("cf", { apiToken });
}

export interface CnameArgs {
  provider: cloudflare.Provider;
  zoneId: pulumi.Input<string>;
  namePrefix: string;
  hostname: string;
  originFqdn: pulumi.Input<string>;
}

export function createCnameRecord(args: CnameArgs): cloudflare.Record {
  return new cloudflare.Record(
    `${args.namePrefix}-cname`,
    {
      zoneId: args.zoneId,
      name: args.hostname,
      type: "CNAME",
      content: args.originFqdn,
      ttl: 1,
      proxied: true,
    },
    { provider: args.provider },
  );
}

export interface LandingCnameArgs {
  provider: cloudflare.Provider;
  zoneId: pulumi.Input<string>;
  namePrefix: string;
  originFqdn: pulumi.Input<string>;
}

export function createLandingCnameRecords(args: LandingCnameArgs) {
  const root = new cloudflare.Record(
    `${args.namePrefix}-cname-root`,
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

  const www = new cloudflare.Record(
    `${args.namePrefix}-cname-www`,
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
  namePrefix: string;
  hostname: string;
  verificationId: pulumi.Input<string>;
}

export function createAsuidTxtRecord(args: AsuidTxtArgs): cloudflare.Record {
  return new cloudflare.Record(
    `${args.namePrefix}-asuid-txt`,
    {
      zoneId: args.zoneId,
      name: `asuid.${args.hostname}`,
      type: "TXT",
      content: args.verificationId,
      ttl: 1,
      proxied: false,
    },
    { provider: args.provider },
  );
}

export interface OriginCertArgs {
  provider: cloudflare.Provider;
  namePrefix: string;
  hostname: string;
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  environmentName: pulumi.Input<string>;
}

export function createOriginCertificate(args: OriginCertArgs) {
  const privateKey = new tls.PrivateKey(`${args.namePrefix}-origin-key`, {
    algorithm: "RSA",
    rsaBits: 2048,
  });

  const csr = new tls.CertRequest(`${args.namePrefix}-origin-csr`, {
    privateKeyPem: privateKey.privateKeyPem,
    subject: {
      commonName: args.hostname,
    },
    dnsNames: [args.hostname],
  });

  const cfCert = new cloudflare.OriginCaCertificate(
    `${args.namePrefix}-origin-cert`,
    {
      csr: csr.certRequestPem,
      hostnames: [args.hostname],
      requestType: "origin-rsa",
      requestedValidity: 5475,
    },
    { provider: args.provider },
  );

  const pemBundle = pulumi
    .all([cfCert.certificate, privateKey.privateKeyPem])
    .apply(([cert, key]) =>
      Buffer.from(`${cert.trim()}\n${key.trim()}\n`).toString("base64"),
    );

  const containerAppCert = new azure.app.Certificate(`${args.namePrefix}-origin-cert-upload`, {
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
