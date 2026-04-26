import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

export interface LandingArgs {
  resourceGroupName: pulumi.Input<string>;
  location: pulumi.Input<string>;
  environmentId: pulumi.Input<string>;
  environmentName: pulumi.Input<string>;
  landingRootCertificateId: pulumi.Input<string>;
  landingWwwCertificateId: pulumi.Input<string>;
  customDomainVerificationId: pulumi.Input<string>;
  acrLoginServer: pulumi.Input<string>;
  acrIdentityId: pulumi.Input<string>;
  imageTag: string;
}

export function createLanding(args: LandingArgs) {
  const app = new azure.app.ContainerApp("landing", {
    resourceGroupName: args.resourceGroupName,
    containerAppName: "coglity-landing",
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
            name: "coglity.com",
            certificateId: args.landingRootCertificateId,
            bindingType: "SniEnabled",
          },
          {
            name: "www.coglity.com",
            certificateId: args.landingWwwCertificateId,
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
          name: "landing",
          image: pulumi.interpolate`${args.acrLoginServer}/coglity-landing:${args.imageTag}`,
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
