import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

export interface BillingArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  environmentId: pulumi.Input<string>;
  databaseUrl: pulumi.Input<string>;
  storageAccountName: pulumi.Input<string>;
  storageAccountId: pulumi.Input<string>;
  usageEventsQueueName: string;
  runCompletionsQueueName: string;
  billingSecret: pulumi.Input<string>;
  acrLoginServer: pulumi.Input<string>;
  acrIdentityId: pulumi.Input<string>;
  imageTag: string;
}

export function createBilling(args: BillingArgs) {
  const secrets = [
    { name: "database-url", value: args.databaseUrl },
    { name: "billing-secret", value: args.billingSecret },
  ];

  const app = new azure.app.ContainerApp("billing", {
    resourceGroupName: args.resourceGroupName,
    containerAppName: "coglity-billing",
    location: args.location,
    managedEnvironmentId: args.environmentId,
    configuration: {
      activeRevisionsMode: "Single",
      ingress: {
        external: false,
        targetPort: 3003,
        transport: "auto",
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
          name: "billing",
          image: pulumi.interpolate`${args.acrLoginServer}/coglity-billing:${args.imageTag}`,
          resources: { cpu: 0.5, memory: "1Gi" },
          env: [
            { name: "DATABASE_URL", secretRef: "database-url" },
            { name: "PORT", value: "3003" },
            { name: "BILLING_SECRET", secretRef: "billing-secret" },
            { name: "AZURE_STORAGE_ACCOUNT", value: args.storageAccountName },
            { name: "AZURE_QUEUE_USAGE_EVENTS", value: args.usageEventsQueueName },
            { name: "AZURE_QUEUE_COMPLETIONS", value: args.runCompletionsQueueName },
          ],
        },
      ],
      scale: { minReplicas: 1, maxReplicas: 2 },
    },
    identity: {
      type: "SystemAssigned,UserAssigned",
      userAssignedIdentities: [args.acrIdentityId],
    },
  });

  // Storage Queue Data Contributor — read + delete messages from billing queues
  const storageQueueRoleId = "974c5e8b-45b9-4653-ba55-5f855dd0fb88";
  new azure.authorization.RoleAssignment("billing-queue-contributor", {
    principalId: app.identity.apply((id) => id!.principalId!),
    principalType: "ServicePrincipal",
    roleDefinitionId: pulumi.interpolate`/subscriptions/${azure.authorization.getClientConfigOutput().apply((c) => c.subscriptionId)}/providers/Microsoft.Authorization/roleDefinitions/${storageQueueRoleId}`,
    scope: args.storageAccountId,
  });

  const fqdn = app.configuration.apply((c) => c!.ingress!.fqdn!);

  return { app, fqdn };
}
