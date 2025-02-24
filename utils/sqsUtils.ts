import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({});
const queueUrl = process.env.DIGITAL_LABEL_EVENT_QUEUE_URL;

export async function fetchEventFromSQS(
  eventId: string,
  retries = 3,
  delay = 2000,
) {
  for (let i = 0; i < retries; i++) {
    //console.log(`Attempt ${i + 1}/${retries} to fetch eventId: ${eventId}`);

    const response = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 10,
      }),
    );

    //console.log("SQS response:", JSON.stringify(response, null, 2));

    if (!response.Messages || response.Messages.length === 0) {
      //console.log("No messages found in SQS.");
      await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
      continue;
    }

    const events = response.Messages.map((msg) => {
      try {
        return JSON.parse(msg.Body || "{}");
      } catch (error) {
        console.error("Error parsing message body:", msg.Body, error);
        return null;
      }
    }).filter(Boolean);

    //console.log("🔍 Parsed events:", JSON.stringify(events, null, 2));

    const matchingEvents = events.filter((e) => e.detail?.eventId === eventId);

    if (matchingEvents.length > 0) {
      //console.log(`Found ${matchingEvents.length} matching event(s)`);
      return matchingEvents;
    }

    //console.log(`No matching event for eventId ${eventId}. Retrying...`);
    await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
  }

  throw new Error(
    `No Track & Trace Event found with eventId ${eventId} after ${retries} retries.`,
  );
}
