import {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const dynamoDb = new DynamoDBClient({});
const sns = new SNSClient({});
const sqs = new SQSClient({});
const EXECUTION_TABLE_NAME = process.env.EXECUTION_TABLE_NAME;
const DLQ_URL = process.env.DLQ_URL;
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN;

export const handler = async () => {
  console.log("Checking for missing events...");

  const scanParams = {
    TableName: EXECUTION_TABLE_NAME,
    FilterExpression: "size(received_events) < size(expected_events)",
  };

  const response = await dynamoDb.send(new ScanCommand(scanParams));

  if (!response.Items || response.Items.length === 0) {
    console.log("All execution plans are complete.");
    return;
  }

  for (const item of response.Items) {
    const eventId = item.eventId.S || "UNKNOWN_EVENT";
    console.log(`Missing events for eventId: ${eventId}`);

    await sns.send(
      new PublishCommand({
        TopicArn: ALERT_TOPIC_ARN,
        Message: `Missing events for eventId ${eventId}.`,
      }),
    );

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: DLQ_URL,
        MessageBody: JSON.stringify({ eventId, reason: "Missing events" }),
      }),
    );

    await dynamoDb.send(
      new UpdateItemCommand({
        TableName: EXECUTION_TABLE_NAME,
        Key: { eventId: { S: eventId } },
        UpdateExpression: "SET status = :status",
        ExpressionAttributeValues: { ":status": { S: "FAILED" } },
      }),
    );

    console.log(`Event ${eventId} marked as FAILED.`);
  }
};
