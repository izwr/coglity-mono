import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";
import {
  createCloudflareProvider,
  createCnameRecord,
  createLandingCnameRecords,
  createAsuidTxtRecord,
  createOriginCertificate,
} from "../apps/src/cloudflare-dns.ts";

const config = new pulumi.Config();
const cfConfig = new pulumi.Config("cloudflare");

const location = "centralindia";
const aiLocation = "southindia";
const cfZoneId = config.require("cfZoneId");
const cfApiToken = cfConfig.requireSecret("apiToken");
const postgresAdminPassword = config.requireSecret("postgresAdminPassword");

// ── 1. Resource Group ──────────────────────────────────────────────

const resourceGroup = new azure.resources.ResourceGroup("coglity-rg", {
  resourceGroupName: "coglity-rg",
  location,
});

// ── 2. Log Analytics Workspace ─────────────────────────────────────

const logAnalytics = new azure.operationalinsights.Workspace("coglity-logs", {
  resourceGroupName: resourceGroup.name,
  location,
  sku: { name: "PerGB2018" },
  retentionInDays: 30,
});

// ── 3. Container Apps Environment ──────────────────────────────────

const environment = new azure.app.ManagedEnvironment("coglity-env", {
  resourceGroupName: resourceGroup.name,
  location,
  appLogsConfiguration: {
    destination: "log-analytics",
    logAnalyticsConfiguration: {
      customerId: logAnalytics.customerId,
      sharedKey: pulumi
        .all([resourceGroup.name, logAnalytics.name])
        .apply(([rgName, wsName]) =>
          azure.operationalinsights.getSharedKeysOutput({
            resourceGroupName: rgName,
            workspaceName: wsName,
          }),
        )
        .apply((keys) => keys.primarySharedKey!),
    },
  },
  zoneRedundant: false,
});

// ── 4. Cloudflare DNS ──────────────────────────────────────────────

const cfProvider = createCloudflareProvider(cfApiToken);

const customDomainVerificationId = azure.app
  .getCustomDomainVerificationIdOutput()
  .apply((r) => r.value!);

createCnameRecord({
  provider: cfProvider,
  zoneId: cfZoneId,
  namePrefix: "ui",
  hostname: "studio.coglity.com",
  originFqdn: environment.defaultDomain,
});

createLandingCnameRecords({
  provider: cfProvider,
  zoneId: cfZoneId,
  namePrefix: "landing",
  originFqdn: environment.defaultDomain,
});

createAsuidTxtRecord({
  provider: cfProvider,
  zoneId: cfZoneId,
  namePrefix: "ui",
  hostname: "studio",
  verificationId: customDomainVerificationId,
});

createAsuidTxtRecord({
  provider: cfProvider,
  zoneId: cfZoneId,
  namePrefix: "landing-root",
  hostname: "@",
  verificationId: customDomainVerificationId,
});

createAsuidTxtRecord({
  provider: cfProvider,
  zoneId: cfZoneId,
  namePrefix: "landing-www",
  hostname: "www",
  verificationId: customDomainVerificationId,
});

// ── 5. Origin Certificates ─────────────────────────────────────────

const uiCert = createOriginCertificate({
  provider: cfProvider,
  namePrefix: "ui",
  hostname: "studio.coglity.com",
  resourceGroupName: resourceGroup.name,
  location,
  environmentName: environment.name,
});

const landingRootCert = createOriginCertificate({
  provider: cfProvider,
  namePrefix: "landing-root",
  hostname: "coglity.com",
  resourceGroupName: resourceGroup.name,
  location,
  environmentName: environment.name,
});

const landingWwwCert = createOriginCertificate({
  provider: cfProvider,
  namePrefix: "landing-www",
  hostname: "www.coglity.com",
  resourceGroupName: resourceGroup.name,
  location,
  environmentName: environment.name,
});

// ── 6. PostgreSQL Flexible Server ──────────────────────────────────

const pgServer = new azure.dbforpostgresql.Server("coglity-pg", {
  resourceGroupName: resourceGroup.name,
  location,
  serverName: "coglity-pg",
  version: "16",
  administratorLogin: "pgadmin",
  administratorLoginPassword: postgresAdminPassword,
  authConfig: {
    activeDirectoryAuth: "Disabled",
    passwordAuth: "Enabled",
  },
  storage: { storageSizeGB: 32 },
  sku: {
    name: "Standard_B1ms",
    tier: azure.dbforpostgresql.SkuTier.Burstable,
  },
});

new azure.dbforpostgresql.FirewallRule("allow-azure-services", {
  resourceGroupName: resourceGroup.name,
  serverName: pgServer.name,
  firewallRuleName: "AllowAzureServices",
  startIpAddress: "0.0.0.0",
  endIpAddress: "0.0.0.0",
});

const pgDatabase = new azure.dbforpostgresql.Database("coglity-db", {
  resourceGroupName: resourceGroup.name,
  serverName: pgServer.name,
  databaseName: "coglity",
});

const databaseUrl = pulumi
  .all([pgServer.fullyQualifiedDomainName, postgresAdminPassword])
  .apply(
    ([fqdn, pw]) =>
      `postgres://pgadmin:${encodeURIComponent(pw)}@${fqdn}:5432/coglity?sslmode=require`,
  );

// ── 7. Service Bus Namespace + Queue ───────────────────────────────

const serviceBusNamespace = new azure.servicebus.Namespace("coglity-sb", {
  resourceGroupName: resourceGroup.name,
  location,
  namespaceName: "coglity-servicebus",
  sku: { name: "Basic", tier: "Basic" },
});

new azure.servicebus.Queue("test-run-jobs", {
  resourceGroupName: resourceGroup.name,
  namespaceName: serviceBusNamespace.name,
  queueName: "test-run-jobs",
  lockDuration: "PT5M",
  maxDeliveryCount: 3,
});

const serviceBusKeys = pulumi
  .all([resourceGroup.name, serviceBusNamespace.name])
  .apply(([rgName, nsName]) =>
    azure.servicebus.listNamespaceKeysOutput({
      resourceGroupName: rgName,
      namespaceName: nsName,
      authorizationRuleName: "RootManageSharedAccessKey",
    }),
  );

// ── 8. Storage Account + Blob Containers ───────────────────────────

const storageAccount = new azure.storage.StorageAccount("coglitysa", {
  resourceGroupName: resourceGroup.name,
  location,
  accountName: "coglitysa",
  kind: azure.storage.Kind.StorageV2,
  sku: { name: azure.storage.SkuName.Standard_LRS },
});

new azure.storage.BlobContainer("test-run-recordings", {
  resourceGroupName: resourceGroup.name,
  accountName: storageAccount.name,
  containerName: "test-run-recordings",
});

new azure.storage.BlobContainer("knowledge-sources", {
  resourceGroupName: resourceGroup.name,
  accountName: storageAccount.name,
  containerName: "knowledge-sources",
});

new azure.storage.BlobContainer("pulumi-state", {
  resourceGroupName: resourceGroup.name,
  accountName: storageAccount.name,
  containerName: "pulumi-state",
});

const storageKeys = pulumi
  .all([resourceGroup.name, storageAccount.name])
  .apply(([rgName, saName]) =>
    azure.storage.listStorageAccountKeysOutput({
      resourceGroupName: rgName,
      accountName: saName,
    }),
  );

const storageAccountKey = storageKeys.apply((k) => k.keys[0].value);

const storageConnectionString = pulumi
  .all([storageAccount.name, storageAccountKey])
  .apply(
    ([name, key]) =>
      `DefaultEndpointsProtocol=https;AccountName=${name};AccountKey=${key};EndpointSuffix=core.windows.net`,
  );

// ── 9. Key Vault ───────────────────────────────────────────────────

const keyVault = new azure.keyvault.Vault("coglity-kv", {
  resourceGroupName: resourceGroup.name,
  location,
  vaultName: "coglity-kv",
  properties: {
    tenantId: pulumi.output(azure.authorization.getClientConfig()).apply((c) => c.tenantId),
    sku: { family: "A", name: azure.keyvault.SkuName.Standard },
    enableSoftDelete: true,
    accessPolicies: [],
  },
});

// ── 10. AI Services Account ────────────────────────────────────────

const aiServices = new azure.cognitiveservices.Account("coglity-ai", {
  resourceGroupName: resourceGroup.name,
  location: aiLocation,
  accountName: "coglity-ai",
  kind: "AIServices",
  sku: { name: "S0" },
  properties: {},
});

const aiServicesKeys = pulumi
  .all([resourceGroup.name, aiServices.name])
  .apply(([rgName, accountName]) =>
    azure.cognitiveservices.listAccountKeysOutput({
      resourceGroupName: rgName,
      accountName,
    }),
  );

// ── 11. AI Model Deployments ───────────────────────────────────────

new azure.cognitiveservices.Deployment("gpt-5-mini", {
  resourceGroupName: resourceGroup.name,
  accountName: aiServices.name,
  deploymentName: "gpt-5-mini",
  properties: {
    model: {
      format: "OpenAI",
      name: "gpt-5-mini",
      version: "2025-08-07",
    },
    versionUpgradeOption: "OnceCurrentVersionExpired",
  },
  sku: { name: "GlobalStandard", capacity: 10 },
});

// ── 12. AI Foundry Hub + Project ──────���───────────────────────────

const aiHub = new azure.machinelearningservices.Workspace("coglity-ai-hub", {
  resourceGroupName: resourceGroup.name,
  location: aiLocation,
  workspaceName: "coglity-ai-hub",
  kind: "Hub",
  sku: { name: "Basic", tier: "Basic" },
  identity: { type: "SystemAssigned" },
  friendlyName: "Coglity AI Hub",
  keyVault: keyVault.id,
  storageAccount: storageAccount.id,
});

const aiProject = new azure.machinelearningservices.Workspace("coglity-foundry", {
  resourceGroupName: resourceGroup.name,
  location: aiLocation,
  workspaceName: "coglity-foundry",
  kind: "Project",
  sku: { name: "Basic", tier: "Basic" },
  identity: { type: "SystemAssigned" },
  friendlyName: "Coglity Foundry",
  hubResourceId: aiHub.id,
});

const aiFoundryProjectEndpoint = pulumi
  .all([aiServices.name, aiProject.name])
  .apply(
    ([aiName, projName]) =>
      `https://${aiName}.services.ai.azure.com/api/projects/${projName}/openai/v1/`,
  );

// ── Exports ────────────────────────────────────────────────────────

export const resourceGroupName = resourceGroup.name;
export const resourceGroupId = resourceGroup.id;
export { location };

export const environmentId = environment.id;
export const environmentName = environment.name;
export const environmentDefaultDomain = environment.defaultDomain;

export { databaseUrl };
export const serviceBusNamespaceFqdn = serviceBusNamespace.name.apply(
  (n) => `${n}.servicebus.windows.net`,
);
export const serviceBusConnectionString = pulumi.secret(
  serviceBusKeys.apply((k) => k.primaryConnectionString!),
);
export const serviceBusQueueName = "test-run-jobs";

export const storageAccountName = storageAccount.name;
export { storageAccountKey };
export const recordingsContainerName = "test-run-recordings";
export const knowledgeSourcesContainerName = "knowledge-sources";

export { customDomainVerificationId };
export const uiCertificateId = uiCert.containerAppCert.id;
export const landingRootCertificateId = landingRootCert.containerAppCert.id;
export const landingWwwCertificateId = landingWwwCert.containerAppCert.id;

export const aiServicesEndpoint = aiServices.properties.apply((p) => p.endpoint!);
export { aiFoundryProjectEndpoint };
export const aiServicesAccountId = aiServices.id;
export const aiServicesApiKey = pulumi.secret(aiServicesKeys.apply((k) => k.key1!));
export const aiServicesLocation = aiLocation;

export const keyVaultId = keyVault.id;
export const storageAccountId = storageAccount.id;
export const serviceBusNamespaceId = serviceBusNamespace.id;
export { storageConnectionString };
