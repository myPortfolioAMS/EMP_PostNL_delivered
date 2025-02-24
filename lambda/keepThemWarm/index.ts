import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { ScheduledEvent } from "aws-lambda";
import { Buffer } from "buffer";

const lambdaClient = new LambdaClient({});

export const handler = async (
  // eslint-disable-next-line no-unused-vars
  _event: ScheduledEvent,
): Promise<{ statusCode: number; body: string }> => {
  const lambdaArns: string[] = [];
  if (process.env.listenerExecutionPlanLambda_ARN) {
    lambdaArns.push(process.env.listenerExecutionPlanLambda_ARN);
  }
  if (process.env.eventManagementLambda_ARN) {
    lambdaArns.push(process.env.eventManagementLambda_ARN);
  }

  const payload = JSON.stringify({ warmup: true });

  await Promise.all(
    lambdaArns.map(async (arn) => {
      try {
        const command = new InvokeCommand({
          FunctionName: arn,
          InvocationType: "Event",
          Payload: Buffer.from(payload),
        });
        await lambdaClient.send(command);
        console.log(`Successfully invoked ${arn} for warmup.`);
      } catch (error) {
        console.error(`Error warming up ${arn}:`, error);
      }
    }),
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Warmup invoked for selected Lambda functions.",
    }),
  };
};
