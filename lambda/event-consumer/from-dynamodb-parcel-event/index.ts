import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";

const ddbClient = new DynamoDBClient({});
const tableName = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandler = async (event) => {
  //console.log("Querying Parcel Event from DynamoDB...");

  const eventId = event.pathParameters?.eventId;
  const eventType = "ParcelEvent-COLLECTION";
  if (!eventId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing eventId" }),
    };
  }

  try {
    const getParams = {
      TableName: tableName,
      Key: {
        eventId: { S: eventId },
        eventType: { S: eventType },
      },
    };

    const result = await ddbClient.send(new GetItemCommand(getParams));

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: `No ParcelEvent found with eventId ${eventId}`,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        eventId: result.Item.eventId.S,
        eventType: result.Item.eventType.S,
        issuer: result.Item.issuer.S,
        zipcode_destination: result.Item.zipcode_destination.S,
        street_destination: result.Item.street_destination.S,
        house_number_destination: result.Item.house_number_destination.S,
        city_of_destination: result.Item.city_of_destination.S,
        country_of_destination: result.Item.country_of_destination.S,
        isPriority: result.Item.isPriority.BOOL,
        isInsured: result.Item.isInsured.BOOL,
        isRegistered: result.Item.isRegistered.BOOL,
        isReRouting: result.Item.isReRouting.BOOL,
        isReturning: result.Item.isReturning.BOOL,
        track_and_trace: result.Item.track_and_trace.S,
        package_box_type: result.Item.package_box_type.S,
        parcel_weight: result.Item.parcel_weight?.N
          ? parseFloat(result.Item.parcel_weight.N)
          : 0,
        execution_status: result.Item.execution_status.S,
        current_phase: result.Item.current_phase.S,
        execution_plan: result.Item.execution_plan.L?.map((step) => ({
          step: step.M?.step.S,
          location: step.M?.location.S,
          status: step.M?.status.S,
          timestamp: step.M?.timestamp.S,
        })),
        dueDate: result.Item.dueDate.S,
        timestamp: result.Item.timestamp.S,
      }),
    };
  } catch (error) {
    console.error("Error querying DynamoDB:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
