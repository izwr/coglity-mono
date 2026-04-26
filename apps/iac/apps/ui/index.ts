import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

export interface UiArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  environmentId: pulumi.Input<string>;
  environmentName: pulumi.Input<string>;
  uiCertificateId: pulumi.Input<string>;
  customDomainVerificationId: pulumi.Input<string>;
  acrLoginServer: pulumi.Input<string>;
  acrIdentityId: pulumi.Input<string>;
  imageTag: string;
}

export function createUi(args: UiArgs) {
  const app = new azure.app.ContainerApp("ui", {
    resourceGroupName: args.resourceGroupName,
    containerAppName: "coglity-ui",
    location: args.location,
    managedEnvironmentId: args.environmentId,
    configuration: {
      activeRevisionsMode: "Single",
      ingress: {
        external: true,
        targetPort: 80,
        transport: "auto",
        customDomains: [
          {
            name: "studio.coglity.com",
            certificateId: args.uiCertificateId,
            bindingType: "SniEnabled",
          },
        ],
      },
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
          name: "ui",
          image: pulumi.interpolate`${args.acrLoginServer}/coglity-ui:${args.imageTag}`,
          resources: { cpu: 0.25, memory: "0.5Gi" },
        },
      ],
      scale: { minReplicas: 0, maxReplicas: 2 },
    },
    identity: {
      type: "UserAssigned",
      userAssignedIdentities: [args.acrIdentityId],
    },
  });

  const fqdn = app.configuration.apply((c) => c!.ingress!.fqdn!);

  return { app, fqdn };
}
