import { APIGatewayProxyHandler } from "aws-lambda";
import { fetchEventFromSQS } from "../../../utils/sqsUtils";

export const handler: APIGatewayProxyHandler = async (event) => {
  //console.log("Fetching TRACK & TRACE EVENTS from SQS...");

  try {
    const eventId = event.pathParameters?.eventId;
    if (!eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing eventId" }),
      };
    }

    const matchingEvents = await fetchEventFromSQS(eventId);

    return { statusCode: 200, body: JSON.stringify(matchingEvents) };
  } catch (error) {
    console.error("Error retrieving TRACK & TRACE EVENTS from SQS:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      statusCode: 404,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};
