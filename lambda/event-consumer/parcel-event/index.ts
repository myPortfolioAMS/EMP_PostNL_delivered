import { APIGatewayProxyHandler } from "aws-lambda";
import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({});
const queueUrl = process.env.PARCEL_EVENT_QUEUE_URL;

export const handler: APIGatewayProxyHandler = async (event) => {
  //console.log("Fetching PARCEL EVENTS from SQS...:", event);

  try {
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing eventId" }),
      };
    }
    //console.log("queueUrl:", queueUrl);
    const response = await client
      .send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 5,
        }),
      )
      .catch((sqsError) => {
        console.error("Error fetching messages from SQS:", sqsError);
        throw new Error("SQS request failed: " + JSON.stringify(sqsError));
      });

    //console.log("SQS response:", JSON.stringify(response, null, 2));

    if (!response.Messages || response.Messages.length === 0) {
      //console.log("No messages found in SQS.");
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "No events found" }),
      };
    }

    const events = response.Messages.map((msg) => {
      try {
        return JSON.parse(msg.Body || "{}");
      } catch (error) {
        console.error("Error parsing message body:", msg.Body, error);
        return null;
      }
    }).filter(Boolean);

    console.log("Parsed events:", JSON.stringify(events, null, 2));

    const matchingEvents =
      response.Messages?.map((msg) => JSON.parse(msg.Body || "{}")).filter(
        (e) => e.detail?.data?.eventId === eventId,
      ) || [];

    if (matchingEvents.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: `No ParcelEvent found with eventId ${eventId}`,
        }),
      };
    }

    return { statusCode: 200, body: JSON.stringify(matchingEvents) };
  } catch (error) {
    console.error("Error retrieving PARCEL EVENTS from SQS:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error HERE" }),
    };
  }
};
