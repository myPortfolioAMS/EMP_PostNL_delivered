import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME!;

const dynamoDb = new DynamoDBClient({});

export const handler = async () => {
  const params = {
    TableName: TABLE_NAME,
    Item: {
      shipment_type: { S: "Priority_Shipping" },
      steps: {
        L: [
          {
            M: {
              step: { S: "FIRST_SORTING" },
              expected_location: { S: "Utrecht_01" },
              expected_time: { S: "2025-02-25T17:10:00Z" },
            },
          },
          {
            M: {
              step: { S: "CROSS_DOCKING" },
              expected_location: { S: "Utrecht_01" },
              expected_time: { S: "2025-02-25T19:00:00Z" },
            },
          },
          {
            M: {
              step: { S: "SECOND_SORTING" },
              expected_location: { S: "Gouda" },
              expected_time: { S: "2025-02-25T23:00:00Z" },
            },
          },
          {
            M: {
              step: { S: "DISTRIBUTION" },
              expected_location: { S: "Voorburg" },
              expected_time: { S: "2025-02-26T05:00:00Z" },
            },
          },
          {
            M: {
              step: { S: "FINAL_CUSTOMER" },
              expected_location: { S: "2521 CA Den Haag" },
              expected_time: { S: "2025-02-26T08:15:00Z" },
            },
          },
        ],
      },
    },
  };

  try {
    await dynamoDb.send(new PutItemCommand(params));
    //console.log("Priority Master Plan added successfully!");
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Priority Master Plan added successfully!",
      }),
    };
  } catch (error: unknown) {
    console.error("Error adding master plan:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal Server Error",
        details: errorMessage,
      }),
    };
  }
};
