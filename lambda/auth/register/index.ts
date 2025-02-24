import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDB = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: any) => {
  const { email, password, firstname, lastname } = JSON.parse(
    event.body || "{}",
  );

  if (!email || !password || !firstname || !lastname) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "All fields are required." }),
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    const signUpCommand = new SignUpCommand({
      ClientId: process.env.USER_POOL_CLIENT_ID!,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    });
    const signUpResponse = await cognitoClient.send(signUpCommand);
    const userId = signUpResponse.UserSub;

    const putCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        userId,
        email,
        firstname,
        lastname,
        createdAt: new Date().toISOString(),
      },
    });
    await dynamoDB.send(putCommand);

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "User registered successfully.",
        userId,
      }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (error) {
    console.error("Error in user registration:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Registration failed",
        error: error instanceof Error ? error.message : error,
      }),
      headers: { "Content-Type": "application/json" },
    };
  }
};
