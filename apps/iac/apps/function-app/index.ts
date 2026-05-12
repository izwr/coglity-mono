import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure-native';

export interface FunctionAppArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  storageConnectionString: pulumi.Input<string>;
  storageAccountName: pulumi.Input<string>;
  storageAccountId: pulumi.Input<string>;
  recordingsContainerName: string;
  serviceBusConnectionString: pulumi.Input<string>;
  aiServicesEndpoint: pulumi.Input<string>;
  aiFoundryProjectEndpoint: pulumi.Input<string>;
  aiServicesAccountId: pulumi.Input<string>;
  aiServicesLocation: pulumi.Input<string>;
  speechServicesAccountId: pulumi.Input<string>;
  speechServicesLocation: pulumi.Input<string>;
  speechServicesCustomDomain: pulumi.Input<string>;
  backendFqdn: pulumi.Input<string>;
  executorWebhookSecret: pulumi.Input<string>;
  appInsightsConnectionString: pulumi.Input<string>;
}

export function createFunctionApp(args: FunctionAppArgs) {
  const plan = new azure.web.AppServicePlan('executor-plan', {
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    name: 'coglity-executor-plan',
    kind: 'linux',
    reserved: true,
    sku: { name: 'Y1', tier: 'Dynamic' },
  });

  const realtimeEndpoint = pulumi
    .output(args.aiFoundryProjectEndpoint)
    .apply((ep) => ep.replace(/^https:\/\//, 'wss://').replace(/\/$/, ''));

  const functionApp = new azure.web.WebApp('executor', {
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    name: 'coglity-executor',
    kind: 'functionapp,linux',
    serverFarmId: plan.id,
    identity: {
      type: 'SystemAssigned',
    },
    siteConfig: {
      linuxFxVersion: 'Node|22',
    },
  });

  new azure.web.WebAppApplicationSettings('executor-settings', {
    name: functionApp.name,
    resourceGroupName: args.resourceGroupName,
    properties: {
      FUNCTIONS_WORKER_RUNTIME: 'node',
      FUNCTIONS_EXTENSION_VERSION: '~4',
      WEBSITE_RUN_FROM_PACKAGE: '1',
      AzureWebJobsStorage: args.storageConnectionString,
      ServiceBusConnection: args.serviceBusConnectionString,
      EXECUTOR_WEBHOOK_SECRET: args.executorWebhookSecret,
      BACKEND_INTERNAL_URL: 'https://studio.coglity.com',
      AZURE_OPENAI_ENDPOINT: args.aiServicesEndpoint,
      AZURE_OPENAI_CHAT_DEPLOYMENT: 'gpt-5-mini',
      AZURE_OPENAI_REALTIME_ENDPOINT: realtimeEndpoint,
      AZURE_OPENAI_REALTIME_DEPLOYMENT: 'gpt-realtime',
      AZURE_OPENAI_REALTIME_API_VERSION: '2024-10-01-preview',
      AZURE_SPEECH_REGION: args.speechServicesLocation,
      AZURE_SPEECH_RESOURCE_ID: args.speechServicesAccountId,
      AZURE_SPEECH_CUSTOM_DOMAIN: args.speechServicesCustomDomain,
      AZURE_STORAGE_ACCOUNT: args.storageAccountName,
      AZURE_STORAGE_RECORDINGS_CONTAINER: args.recordingsContainerName,
      EXECUTOR_MAX_DURATION_MS: '180000',
      EXECUTOR_MAX_TURNS: '12',
      EXECUTOR_SILENCE_MS: '8000',
      APPLICATIONINSIGHTS_CONNECTION_STRING: args.appInsightsConnectionString,
    },
  });

  // Cognitive Services OpenAI User role
  const openAiUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd';
  new azure.authorization.RoleAssignment('executor-openai-user', {
    principalId: functionApp.identity.apply((id) => id!.principalId!),
    principalType: 'ServicePrincipal',
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${openAiUserRoleId}`,
    scope: args.aiServicesAccountId,
  });

  // Cognitive Services Speech User role on dedicated Speech account
  const speechUserRoleId = 'f2dc8367-1007-4938-bd23-fe263f013447';
  new azure.authorization.RoleAssignment('executor-speech-user', {
    principalId: functionApp.identity.apply((id) => id!.principalId!),
    principalType: 'ServicePrincipal',
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${speechUserRoleId}`,
    scope: args.speechServicesAccountId,
  });

  // Storage Blob Data Contributor role
  const storageBlobRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe';
  new azure.authorization.RoleAssignment('executor-storage-contributor', {
    principalId: functionApp.identity.apply((id) => id!.principalId!),
    principalType: 'ServicePrincipal',
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${storageBlobRoleId}`,
    scope: args.storageAccountId,
  });

  return {
    functionApp,
    name: functionApp.name,
    defaultHostName: functionApp.defaultHostName,
  };
}
