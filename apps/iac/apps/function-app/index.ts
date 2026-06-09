import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure-native';

export interface FunctionAppArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  globalResourcePrefix: string;
  enableRunFromPackage: boolean;
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
  speechServicesApiKey: pulumi.Input<string>;
  backendFqdn: pulumi.Input<string>;
  executorWebhookSecret: pulumi.Input<string>;
  appInsightsConnectionString: pulumi.Input<string>;
  searchServiceEndpoint: pulumi.Input<string>;
  searchServiceId: pulumi.Input<string>;
  visionEndpoint: pulumi.Input<string>;
  visionAccountId: pulumi.Input<string>;
  twilioAccountSid: pulumi.Input<string>;
  twilioAuthToken: pulumi.Input<string>;
  twilioFromNumber: pulumi.Input<string>;
  twilioWsPort: pulumi.Input<string>;
  openaiApiKey: pulumi.Input<string>;
  openaiBaseUrl: pulumi.Input<string>;
}

export function createFunctionApp(args: FunctionAppArgs) {
  const dashedGlobalResourcePrefix = `${args.globalResourcePrefix.toLowerCase()}-`;
  const packageSettings = args.enableRunFromPackage
    ? [{ name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }]
    : [];

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
    name: `${dashedGlobalResourcePrefix}coglity-executor`,
    kind: 'functionapp,linux',
    serverFarmId: plan.id,
    identity: {
      type: 'SystemAssigned',
    },
    siteConfig: {
      linuxFxVersion: 'Node|22',
      appSettings: [
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' },
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' },
        ...packageSettings,
        { name: 'AzureWebJobsStorage', value: args.storageConnectionString },
        { name: 'ServiceBusConnection', value: args.serviceBusConnectionString },
        { name: 'EXECUTOR_WEBHOOK_SECRET', value: args.executorWebhookSecret },
        { name: 'BACKEND_INTERNAL_URL', value: 'https://studio.coglity.com' },
        { name: 'AZURE_OPENAI_ENDPOINT', value: args.aiServicesEndpoint },
        { name: 'AZURE_OPENAI_CHAT_DEPLOYMENT', value: 'gemma-4-31B-it' },
        { name: 'AZURE_OPENAI_REALTIME_ENDPOINT', value: realtimeEndpoint },
        { name: 'AZURE_OPENAI_REALTIME_DEPLOYMENT', value: 'gpt-realtime' },
        { name: 'AZURE_OPENAI_REALTIME_API_VERSION', value: '2024-10-01-preview' },
        { name: 'AZURE_SPEECH_REGION', value: args.speechServicesLocation },
        { name: 'AZURE_SPEECH_RESOURCE_ID', value: args.speechServicesAccountId },
        { name: 'AZURE_SPEECH_KEY', value: args.speechServicesApiKey },
        { name: 'AZURE_STORAGE_ACCOUNT', value: args.storageAccountName },
        { name: 'AZURE_STORAGE_RECORDINGS_CONTAINER', value: args.recordingsContainerName },
        { name: 'EXECUTOR_MAX_DURATION_MS', value: '180000' },
        { name: 'EXECUTOR_MAX_TURNS', value: '12' },
        { name: 'EXECUTOR_SILENCE_MS', value: '8000' },
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: args.appInsightsConnectionString },
        { name: 'AZURE_SEARCH_ENDPOINT', value: args.searchServiceEndpoint },
        { name: 'AZURE_SEARCH_INDEX_NAME', value: 'knowledge-sources' },
        { name: 'AZURE_OPENAI_EMBEDDING_ENDPOINT', value: args.aiServicesEndpoint },
        { name: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', value: 'text-embedding-3-large' },
        { name: 'AZURE_VISION_ENDPOINT', value: args.visionEndpoint },
        { name: 'AZURE_STORAGE_KNOWLEDGE_CONTAINER', value: 'knowledge-sources' },
        { name: 'TWILIO_ACCOUNT_SID', value: args.twilioAccountSid },
        { name: 'TWILIO_AUTH_TOKEN', value: args.twilioAuthToken },
        { name: 'TWILIO_FROM_NUMBER', value: args.twilioFromNumber },
        { name: 'TWILIO_WS_PORT', value: args.twilioWsPort },
        { name: 'OPENAI_API_KEY', value: args.openaiApiKey },
        { name: 'OPENAI_BASE_URL', value: args.openaiBaseUrl },
        {
          name: 'TWILIO_STREAM_BASE_URL',
          value: pulumi.interpolate`wss://${dashedGlobalResourcePrefix}coglity-executor.azurewebsites.net`,
        },
      ],
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

  // Search Index Data Contributor role
  const searchContributorRoleId = '8ebe5a00-799e-43f5-93ac-243d3dce84a7';
  new azure.authorization.RoleAssignment('executor-search-contributor', {
    principalId: functionApp.identity.apply((id) => id!.principalId!),
    principalType: 'ServicePrincipal',
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${searchContributorRoleId}`,
    scope: args.searchServiceId,
  });

  // Cognitive Services User role on Computer Vision
  const cogServicesUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908';
  new azure.authorization.RoleAssignment('executor-vision-user', {
    principalId: functionApp.identity.apply((id) => id!.principalId!),
    principalType: 'ServicePrincipal',
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${cogServicesUserRoleId}`,
    scope: args.visionAccountId,
  });

  return {
    functionApp,
    name: functionApp.name,
    defaultHostName: functionApp.defaultHostName,
  };
}
