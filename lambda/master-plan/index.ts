import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME!;

const dynamoDb = new DynamoDBClient({});

export const handler = async () => {
  const params = {
    TableName: TABLE_NAME,
    Item: {
      shipment_type: { S: "Standard_Shipping" },
      steps: {
        L: [
          {
            M: {
              step: { S: "COLLECTION" },
              expected_location: { S: "1181 CR - Amstelveen" },
              expected_time: { S: "2025-02-25T08:30:00Z" },
            },
          },
          {
            M: {
              step: { S: "FIRST_SORTING" },
              expected_location: { S: "RONKIN_01" },
              expected_time: { S: "2025-02-25T10:10:00Z" },
            },
          },
          {
            M: {
              step: { S: "CROSS_DOCKING" },
              expected_location: { S: "Hoofdrop" },
              expected_time: { S: "2025-02-25T15:00:00Z" },
            },
          },
          {
            M: {
              step: { S: "SECOND_SORTING" },
              expected_location: { S: "Leiden" },
              expected_time: { S: "2025-02-25T21:00:00Z" },
            },
          },
          {
            M: {
              step: { S: "DISTRIBUTION" },
              expected_location: { S: "Voorburg" },
              expected_time: { S: "2025-02-26T01:00:00Z" },
            },
          },
          {
            M: {
              step: { S: "FINAL_DESTINATION" },
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
    //console.log("Master Plan added successfully!");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Master Plan added successfully!" }),
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
