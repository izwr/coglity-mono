import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure-native';
import { createBackend } from './backend/index.ts';
import { createUi } from './ui/index.ts';
import { createLanding } from './landing/index.ts';
import { createFunctionApp } from './function-app/index.ts';

const config = new pulumi.Config();
const globalResourcePrefix = (config.get('globalResourcePrefix') ?? 'r7k3').toLowerCase();
const enableFunctionRunFromPackage = config.getBoolean('enableFunctionRunFromPackage') ?? false;

const coreStack = new pulumi.StackReference(config.require('coreStack'));

const coreOut = {
  resourceGroupName: coreStack.requireOutput('resourceGroupName') as pulumi.Output<string>,
  location: coreStack.requireOutput('location') as pulumi.Output<string>,
  environmentId: coreStack.requireOutput('environmentId') as pulumi.Output<string>,
  environmentName: coreStack.requireOutput('environmentName') as pulumi.Output<string>,
  environmentDefaultDomain: coreStack.requireOutput(
    'environmentDefaultDomain',
  ) as pulumi.Output<string>,
  databaseUrl: coreStack.requireOutput('databaseUrl') as pulumi.Output<string>,
  serviceBusNamespaceFqdn: coreStack.requireOutput(
    'serviceBusNamespaceFqdn',
  ) as pulumi.Output<string>,
  serviceBusConnectionString: coreStack.requireOutput(
    'serviceBusConnectionString',
  ) as pulumi.Output<string>,
  serviceBusQueueName: coreStack.requireOutput('serviceBusQueueName') as pulumi.Output<string>,
  serviceBusNamespaceId: coreStack.requireOutput('serviceBusNamespaceId') as pulumi.Output<string>,
  storageAccountName: coreStack.requireOutput('storageAccountName') as pulumi.Output<string>,
  storageAccountId: coreStack.requireOutput('storageAccountId') as pulumi.Output<string>,
  storageAccountKey: coreStack.requireOutput('storageAccountKey') as pulumi.Output<string>,
  storageConnectionString: coreStack.requireOutput(
    'storageConnectionString',
  ) as pulumi.Output<string>,
  recordingsContainerName: coreStack.requireOutput(
    'recordingsContainerName',
  ) as pulumi.Output<string>,
  knowledgeSourcesContainerName: coreStack.requireOutput(
    'knowledgeSourcesContainerName',
  ) as pulumi.Output<string>,
  customDomainVerificationId: coreStack.requireOutput(
    'customDomainVerificationId',
  ) as pulumi.Output<string>,
  uiCertificateId: coreStack.requireOutput('uiCertificateId') as pulumi.Output<string>,
  landingRootCertificateId: coreStack.requireOutput(
    'landingRootCertificateId',
  ) as pulumi.Output<string>,
  landingWwwCertificateId: coreStack.requireOutput(
    'landingWwwCertificateId',
  ) as pulumi.Output<string>,
  aiServicesEndpoint: coreStack.requireOutput('aiServicesEndpoint') as pulumi.Output<string>,
  aiFoundryProjectEndpoint: coreStack.requireOutput(
    'aiFoundryProjectEndpoint',
  ) as pulumi.Output<string>,
  aiServicesAccountId: coreStack.requireOutput('aiServicesAccountId') as pulumi.Output<string>,
  aiServicesLocation: coreStack.requireOutput('aiServicesLocation') as pulumi.Output<string>,
  speechServicesAccountId: coreStack.requireOutput('speechServicesAccountId') as pulumi.Output<string>,
  speechServicesLocation: coreStack.requireOutput('speechServicesLocation') as pulumi.Output<string>,
  speechServicesApiKey: coreStack.requireOutput('speechServicesApiKey') as pulumi.Output<string>,
  appInsightsConnectionString: coreStack.requireOutput(
    'appInsightsConnectionString',
  ) as pulumi.Output<string>,
  searchServiceEndpoint: coreStack.requireOutput('searchServiceEndpoint') as pulumi.Output<string>,
  searchServiceId: coreStack.requireOutput('searchServiceId') as pulumi.Output<string>,
  knowledgeIndexQueueName: coreStack.requireOutput(
    'knowledgeIndexQueueName',
  ) as pulumi.Output<string>,
  visionEndpoint: coreStack.requireOutput('visionEndpoint') as pulumi.Output<string>,
  visionAccountId: coreStack.requireOutput('visionAccountId') as pulumi.Output<string>,
};

const acrLoginServer = config.require('acrLoginServer');
const acrResourceId = config.require('acrResourceId');

// Shared user-assigned managed identity for ACR pull (avoids circular dependency with system-assigned)
const acrIdentity = new azure.managedidentity.UserAssignedIdentity('acr-pull-identity', {
  resourceGroupName: coreOut.resourceGroupName,
  location: coreOut.location,
  resourceName: 'coglity-acr-pull',
});

const acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d';
new azure.authorization.RoleAssignment('acr-pull-role', {
  principalId: acrIdentity.principalId,
  principalType: 'ServicePrincipal',
  roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${acrPullRoleId}`,
  scope: acrResourceId,
});

const backendImageTag = config.get('backendImageTag') ?? 'latest';
const uiImageTag = config.get('uiImageTag') ?? 'latest';
const landingImageTag = config.get('landingImageTag') ?? 'latest';

const sessionSecret = config.requireSecret('sessionSecret');
const azureClientId = config.requireSecret('azureClientId');
const azureClientSecret = config.requireSecret('azureClientSecret');
const azureTenantId = config.requireSecret('azureTenantId');
const googleClientId = config.requireSecret('googleClientId');
const googleClientSecret = config.requireSecret('googleClientSecret');
const executorWebhookSecret = config.requireSecret('executorWebhookSecret');
const openaiApiKey = config.requireSecret('openaiApiKey');
const openaiBaseUrl = config.requireSecret('openaiBaseUrl');
const twilioAccountSid = config.requireSecret('twilioAccountSid');
const twilioAuthToken = config.requireSecret('twilioAuthToken');
const twilioFromNumber = config.require('twilioFromNumber');
const twilioWsPort = config.get('twilioWsPort') ?? '8765';

// ── Backend ────────────────────────────────────────────────────────

const backend = createBackend({
  resourceGroupName: coreOut.resourceGroupName,
  location: coreOut.location,
  environmentId: coreOut.environmentId,
  environmentDefaultDomain: coreOut.environmentDefaultDomain,
  databaseUrl: coreOut.databaseUrl,
  serviceBusNamespaceFqdn: coreOut.serviceBusNamespaceFqdn,
  serviceBusQueueName: 'test-run-jobs',
  serviceBusNamespaceId: coreOut.serviceBusNamespaceId,
  storageAccountName: coreOut.storageAccountName,
  storageAccountId: coreOut.storageAccountId,
  knowledgeSourcesContainerName: 'knowledge-sources',
  recordingsContainerName: 'test-run-recordings',
  openaiApiKey,
  openaiBaseUrl,
  sessionSecret,
  azureClientId,
  azureClientSecret,
  azureTenantId,
  googleClientId,
  googleClientSecret,
  executorWebhookSecret,
  acrLoginServer,
  acrIdentityId: acrIdentity.id,
  imageTag: backendImageTag,
  searchServiceEndpoint: coreOut.searchServiceEndpoint,
  searchServiceId: coreOut.searchServiceId,
  knowledgeIndexQueueName: 'knowledge-index-jobs',
});

// ── UI ─────────────────────────────────────────────────────────────

const ui = createUi({
  resourceGroupName: coreOut.resourceGroupName,
  location: coreOut.location,
  environmentId: coreOut.environmentId,
  environmentName: coreOut.environmentName,
  environmentDefaultDomain: coreOut.environmentDefaultDomain,
  uiCertificateId: coreOut.uiCertificateId,
  customDomainVerificationId: coreOut.customDomainVerificationId,
  acrLoginServer,
  acrIdentityId: acrIdentity.id,
  backendFqdn: backend.fqdn,
  imageTag: uiImageTag,
});

// ── Landing ────────────────────────────────────────────────────────

const landing = createLanding({
  resourceGroupName: coreOut.resourceGroupName,
  location: coreOut.location,
  environmentId: coreOut.environmentId,
  environmentName: coreOut.environmentName,
  landingRootCertificateId: coreOut.landingRootCertificateId,
  landingWwwCertificateId: coreOut.landingWwwCertificateId,
  customDomainVerificationId: coreOut.customDomainVerificationId,
  acrLoginServer,
  acrIdentityId: acrIdentity.id,
  imageTag: landingImageTag,
});

// ── Function App (Executor) ────────────────────────────────────────

const executor = createFunctionApp({
  resourceGroupName: coreOut.resourceGroupName,
  location: coreOut.location,
  globalResourcePrefix,
  enableRunFromPackage: enableFunctionRunFromPackage,
  storageConnectionString: coreOut.storageConnectionString,
  storageAccountName: coreOut.storageAccountName,
  storageAccountId: coreOut.storageAccountId,
  recordingsContainerName: 'test-run-recordings',
  serviceBusConnectionString: coreOut.serviceBusConnectionString,
  aiServicesEndpoint: coreOut.aiServicesEndpoint,
  aiFoundryProjectEndpoint: coreOut.aiFoundryProjectEndpoint,
  aiServicesAccountId: coreOut.aiServicesAccountId,
  aiServicesLocation: coreOut.aiServicesLocation,
  speechServicesAccountId: coreOut.speechServicesAccountId,
  speechServicesLocation: coreOut.speechServicesLocation,
  speechServicesApiKey: coreOut.speechServicesApiKey,
  backendFqdn: backend.fqdn,
  executorWebhookSecret,
  appInsightsConnectionString: coreOut.appInsightsConnectionString,
  searchServiceEndpoint: coreOut.searchServiceEndpoint,
  searchServiceId: coreOut.searchServiceId,
  visionEndpoint: coreOut.visionEndpoint,
  visionAccountId: coreOut.visionAccountId,
  twilioAccountSid,
  twilioAuthToken,
  twilioFromNumber,
  twilioWsPort,
  openaiApiKey,
  openaiBaseUrl,
});

// ── Exports ────────────────────────────────────────────────────────

export const backendFqdn = backend.fqdn;
export const uiFqdn = ui.fqdn;
export const landingFqdn = landing.fqdn;
export const functionAppName = executor.name;
export const functionAppDefaultHostName = executor.defaultHostName;
