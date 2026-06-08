import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure-native';

export interface BackendArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  environmentId: pulumi.Input<string>;
  environmentDefaultDomain: pulumi.Input<string>;
  databaseUrl: pulumi.Input<string>;
  serviceBusNamespaceFqdn: pulumi.Input<string>;
  serviceBusQueueName: string;
  serviceBusNamespaceId: pulumi.Input<string>;
  storageAccountName: pulumi.Input<string>;
  storageAccountId: pulumi.Input<string>;
  knowledgeSourcesContainerName: string;
  recordingsContainerName: string;
  openaiApiKey: pulumi.Input<string>;
  openaiBaseUrl: pulumi.Input<string>;
  sessionSecret: pulumi.Input<string>;
  azureClientId: pulumi.Input<string>;
  azureClientSecret: pulumi.Input<string>;
  azureTenantId: pulumi.Input<string>;
  googleClientId: pulumi.Input<string>;
  googleClientSecret: pulumi.Input<string>;
  executorWebhookSecret: pulumi.Input<string>;
  acrLoginServer: pulumi.Input<string>;
  acrIdentityId: pulumi.Input<string>;
  imageTag: string;
  searchServiceEndpoint: pulumi.Input<string>;
  searchServiceId: pulumi.Input<string>;
  knowledgeIndexQueueName: string;
}

export function createBackend(args: BackendArgs) {
  const secrets = [
    { name: 'database-url', value: args.databaseUrl },
    { name: 'session-secret', value: args.sessionSecret },
    { name: 'azure-client-id', value: args.azureClientId },
    { name: 'azure-client-secret', value: args.azureClientSecret },
    { name: 'azure-tenant-id', value: args.azureTenantId },
    { name: 'google-client-id', value: args.googleClientId },
    { name: 'google-client-secret', value: args.googleClientSecret },
    { name: 'openai-api-key', value: args.openaiApiKey },
    { name: 'openai-base-url', value: args.openaiBaseUrl },
    { name: 'executor-webhook-secret', value: args.executorWebhookSecret },
  ];

  const app = new azure.app.ContainerApp('backend', {
    resourceGroupName: args.resourceGroupName,
    containerAppName: 'coglity-backend',
    location: args.location,
    managedEnvironmentId: args.environmentId,
    configuration: {
      activeRevisionsMode: 'Single',
      ingress: {
        external: false,
        targetPort: 3001,
        transport: 'auto',
        allowInsecure: true,
      },
      secrets,
      registries: [
        {
          server: args.acrLoginServer,
          identity: args.acrIdentityId,
        },
      ],
    },
    template: {
      containers: [
        {
          name: 'backend',
          image: pulumi.interpolate`${args.acrLoginServer}/coglity-backend:${args.imageTag}`,
          resources: { cpu: 0.5, memory: '1Gi' },
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' },
            { name: 'PORT', value: '3001' },
            { name: 'SESSION_SECRET', secretRef: 'session-secret' },
            { name: 'AZURE_CLIENT_ID', secretRef: 'azure-client-id' },
            { name: 'AZURE_CLIENT_SECRET', secretRef: 'azure-client-secret' },
            { name: 'AZURE_TENANT_ID', secretRef: 'azure-tenant-id' },
            { name: 'AZURE_REDIRECT_URI', value: 'https://studio.coglity.com/api/auth/callback' },
            { name: 'GOOGLE_CLIENT_ID', secretRef: 'google-client-id' },
            { name: 'GOOGLE_CLIENT_SECRET', secretRef: 'google-client-secret' },
            {
              name: 'GOOGLE_REDIRECT_URI',
              value: 'https://studio.coglity.com/api/auth/google/callback',
            },
            { name: 'CLIENT_URL', value: 'https://studio.coglity.com' },
            { name: 'OPENAI_API_KEY', secretRef: 'openai-api-key' },
            { name: 'OPENAI_BASE_URL', secretRef: 'openai-base-url' },
            { name: 'EXECUTOR_WEBHOOK_SECRET', secretRef: 'executor-webhook-secret' },
            { name: 'AZURE_STORAGE_ACCOUNT', value: args.storageAccountName },
            { name: 'AZURE_STORAGE_CONTAINER', value: args.knowledgeSourcesContainerName },
            { name: 'AZURE_STORAGE_RECORDINGS_CONTAINER', value: args.recordingsContainerName },
            { name: 'AZURE_SERVICE_BUS_NAMESPACE', value: args.serviceBusNamespaceFqdn },
            { name: 'AZURE_SERVICE_BUS_QUEUE_NAME', value: args.serviceBusQueueName },
            { name: 'COOKIE_DOMAIN', value: 'studio.coglity.com' },
            { name: 'NODE_TLS_REJECT_UNAUTHORIZED', value: '0' },
            { name: 'AZURE_SEARCH_ENDPOINT', value: args.searchServiceEndpoint },
            { name: 'AZURE_SEARCH_INDEX_NAME', value: 'knowledge-sources' },
            { name: 'AZURE_SERVICE_BUS_INDEX_QUEUE_NAME', value: args.knowledgeIndexQueueName },
          ],
        },
      ],
      scale: { minReplicas: 1, maxReplicas: 2 },
    },
    identity: {
      type: 'SystemAssigned,UserAssigned',
      userAssignedIdentities: [args.acrIdentityId],
    },
  });

  // Service Bus Data Sender role
  const sbRoleId = '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39';
  new azure.authorization.RoleAssignment('backend-sb-sender', {
    principalId: app.identity.apply((id) => id!.principalId!),
    principalType: 'ServicePrincipal',
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${sbRoleId}`,
    scope: args.serviceBusNamespaceId,
  });

  // Storage Blob Data Contributor role
  const storageRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe';
  new azure.authorization.RoleAssignment('backend-storage-contributor', {
    principalId: app.identity.apply((id) => id!.principalId!),
    principalType: 'ServicePrincipal',
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${storageRoleId}`,
    scope: args.storageAccountId,
  });

  // Search Index Data Reader role
  const searchReaderRoleId = '1407120a-92aa-4202-b7e9-c0e197c71c8f';
  new azure.authorization.RoleAssignment('backend-search-reader', {
    principalId: app.identity.apply((id) => id!.principalId!),
    principalType: 'ServicePrincipal',
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${searchReaderRoleId}`,
    scope: args.searchServiceId,
  });

  const fqdn = app.configuration.apply((c) => c!.ingress!.fqdn!);

  return { app, fqdn };
}
