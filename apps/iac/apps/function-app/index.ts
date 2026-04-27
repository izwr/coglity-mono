import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

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
  backendFqdn: pulumi.Input<string>;
  executorWebhookSecret: pulumi.Input<string>;
  appInsightsConnectionString: pulumi.Input<string>;
}

export function createFunctionApp(args: FunctionAppArgs) {
  const plan = new azure.web.AppServicePlan("executor-plan", {
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    name: "coglity-executor-plan",
    kind: "linux",
    reserved: true,
    sku: { name: "Y1", tier: "Dynamic" },
  });

  const realtimeEndpoint = pulumi
    .output(args.aiFoundryProjectEndpoint)
    .apply((ep) => ep.replace(/^https:\/\//, "wss://").replace(/\/$/, ""));

  const functionApp = new azure.web.WebApp("executor", {
    resourceGroupName: args.resourceGroupName,
    location: args.location,
    name: "coglity-executor",
    kind: "functionapp,linux",
    serverFarmId: plan.id,
    identity: {
      type: "SystemAssigned",
    },
    siteConfig: {
      linuxFxVersion: "Node|22",
      appSettings: [
        { name: "FUNCTIONS_WORKER_RUNTIME", value: "node" },
        { name: "FUNCTIONS_EXTENSION_VERSION", value: "~4" },
        { name: "AzureWebJobsStorage", value: args.storageConnectionString },
        { name: "ServiceBusConnection", value: args.serviceBusConnectionString },
        { name: "EXECUTOR_WEBHOOK_SECRET", value: args.executorWebhookSecret },
        { name: "BACKEND_INTERNAL_URL", value: pulumi.interpolate`https://${args.backendFqdn}` },
        { name: "AZURE_OPENAI_ENDPOINT", value: args.aiServicesEndpoint },
        { name: "AZURE_OPENAI_CHAT_DEPLOYMENT", value: "gpt-5-mini" },
        { name: "AZURE_OPENAI_REALTIME_ENDPOINT", value: realtimeEndpoint },
        { name: "AZURE_OPENAI_REALTIME_DEPLOYMENT", value: "gpt-realtime" },
        { name: "AZURE_OPENAI_REALTIME_API_VERSION", value: "2024-10-01-preview" },
        { name: "AZURE_SPEECH_REGION", value: args.aiServicesLocation },
        { name: "AZURE_SPEECH_RESOURCE_ID", value: args.aiServicesAccountId },
        { name: "AZURE_STORAGE_ACCOUNT", value: args.storageAccountName },
        { name: "AZURE_STORAGE_RECORDINGS_CONTAINER", value: args.recordingsContainerName },
        { name: "EXECUTOR_MAX_DURATION_MS", value: "180000" },
        { name: "EXECUTOR_MAX_TURNS", value: "12" },
        { name: "EXECUTOR_SILENCE_MS", value: "8000" },
        { name: "APPLICATIONINSIGHTS_CONNECTION_STRING", value: args.appInsightsConnectionString },
        { name: "WEBSITE_RUN_FROM_PACKAGE", value: "1" },
      ],
    },
  });

  // Cognitive Services OpenAI User role
  const openAiUserRoleId = "5e0bd9bd-7b93-4f28-af87-19fc36ad61bd";
  new azure.authorization.RoleAssignment("executor-openai-user", {
    principalId: functionApp.identity.apply((id) => id!.principalId!),
    principalType: "ServicePrincipal",
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${openAiUserRoleId}`,
    scope: args.aiServicesAccountId,
  });

  // Storage Blob Data Contributor role
  const storageBlobRoleId = "ba92f5b4-2d11-453d-a403-e96b0029c9fe";
  new azure.authorization.RoleAssignment("executor-storage-contributor", {
    principalId: functionApp.identity.apply((id) => id!.principalId!),
    principalType: "ServicePrincipal",
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${storageBlobRoleId}`,
    scope: args.storageAccountId,
  });

  return {
    functionApp,
    name: functionApp.name,
    defaultHostName: functionApp.defaultHostName,
  };
}
