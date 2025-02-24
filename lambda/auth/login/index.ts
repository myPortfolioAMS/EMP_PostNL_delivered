import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

export const handler = async (event: any) => {
  const { email, password } = JSON.parse(event.body || "{}");

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: process.env.USER_POOL_CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    });

    const authResponse = await client.send(command);

    if (!authResponse.AuthenticationResult?.IdToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: "Authentication failed: No token received",
        }),
        headers: { "Content-Type": "application/json" },
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        token: authResponse.AuthenticationResult.IdToken,
      }),
      headers: { "Content-Type": "application/json" },
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Internal Server Error",
          error: error.message,
        }),
        headers: { "Content-Type": "application/json" },
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Unknown error occurred",
          error: "Unknown error occurred",
        }),
        headers: { "Content-Type": "application/json" },
      };
    }
  }
};
