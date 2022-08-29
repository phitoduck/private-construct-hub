import { App, CfnDeletionPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { ConstructHub, sources } from 'construct-hub';
import { Construct, Node } from 'constructs';
import { aws_codeartifact as code } from 'aws-cdk-lib';
import { aws_route53 as route53 } from "aws-cdk-lib"
import { aws_certificatemanager as acm } from "aws-cdk-lib"
import * as ch from "construct-hub"

export class ConstructHubStack extends Stack {

  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);
    
    const aiTeamCodeArtifactRepo = this.getCodeArtifactRepo(scope)
    const constructHub = new ConstructHub(this, "construct-hub", {
      packageSources: [
        new sources.CodeArtifact({repository: aiTeamCodeArtifactRepo})
      ],
      domain: this.makeSubdomainOnExistingHostedZone("sbox.ai.muyben.tech"),
      sensitiveTaskIsolation: ch.Isolation.UNLIMITED_INTERNET_ACCESS,
      featureFlags: {
        homeRedesign: true,
        searchRedesign: true,
      },
    })

  }

  /**
   * Return a mock of a code.CfnRepository object with data for an existing one
   * 
   * @param scope 
   * @returns 
   */
  private getCodeArtifactRepo(scope: Construct): code.CfnRepository {
    const repository = {
      attrArn: "arn:aws:codeartifact:us-east-1:785465075102:repository/ai-package-index/ai-package-index",
      attrDomainName: "ai-package-index",
      attrDomainOwner: this.account,
      attrName: "ai-package-index",
      cfnOptions: {
        deletionPolicy: CfnDeletionPolicy.RETAIN,
      },
      cfnResourceType: "AWS::CodeArtifact::Repository",
      creationStack: [...this.node.path.split("/"), "existing-code-repository"],
      logicalId: "existing-code-repository",
      ref: "arn:aws:codeartifact:us-east-1:785465075102:repository/ai-package-index/ai-package-index",
      description: "Private package repository",
      // externalConnections: [],
      node: new Node(this, scope, "existing-code-repository")
    } as code.CfnRepository;

    return repository
  }

  /**
   * Create a new hosted zone for "construct-hub.{parentHostedZoneDnsName}" and
   * delegate to that subdomain from the parent hosted zone by creating a NameSpace (NS)
   * record.
   * 
   * @param parentHostedZoneDnsName 
   * @returns {ch.Domain} object allowing ConstructHub to create a "construct-hub." subdomain
   */
  private makeSubdomainOnExistingHostedZone(parentHostedZoneDnsName: string): ch.Domain {

    const parentHostedZone = route53.HostedZone.fromLookup(
      this, `parent-hosted-zone-${parentHostedZoneDnsName}`, {
        domainName: parentHostedZoneDnsName
      }
    )

    const fullyQualifiedSubDomain = `construct-hub.${parentHostedZoneDnsName}`
    const constructHubHostedZone = new route53.HostedZone(
      this, "delegated-construct-hub-hosted-zone", {
        zoneName: fullyQualifiedSubDomain,
        comment: "Hosted Zone containing all records for the construct-hub. subdomain",
      }
    )

    // create an NS record in the parent hosted zone delegate to the subdomain's nameservers
    const subdomainNameServers = constructHubHostedZone.hostedZoneNameServers as string[]
    new route53.ZoneDelegationRecord(this, "parent-to-sub-delegation-record", {
      zone: parentHostedZone,
      nameServers: subdomainNameServers,
      comment: `Delegate ${fullyQualifiedSubDomain} to the subdomain's hosted zone.`,
      deleteExisting: true,
      recordName: fullyQualifiedSubDomain,
    })

    const cert = new acm.DnsValidatedCertificate(this, "cert", {
      domainName: fullyQualifiedSubDomain,
      hostedZone: constructHubHostedZone,
    })

    const domain: ch.Domain = {
      cert: cert,
      zone: constructHubHostedZone,
      monitorCertificateExpiration: true,
    }

    return domain
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const APP = new App();

new ConstructHubStack(APP, 'private-construct-hub-dev', { env: devEnv });
// new MyStack(APP, 'private-construct-hub-prod', { env: prodEnv });

APP.synth();