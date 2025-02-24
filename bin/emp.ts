import * as cdk from "aws-cdk-lib";
import { EmpPocStack } from "../lib/EmpPocStack";
// import { EventInfrastructureStack } from "../lib/old_EventInfrastructureStack";
// import { LogisticPlatformMockStack } from "../lib/old_LogisticPlatformMockStack";
// import { EventManagementStack } from "../lib/oLd_EventManagementPoCStack";

const app = new cdk.App();

const mainStack = new EmpPocStack(app, "EmPocStack");

new cdk.CfnOutput(mainStack, "StackName", {
  value: mainStack.stackName,
});

app.synth();
