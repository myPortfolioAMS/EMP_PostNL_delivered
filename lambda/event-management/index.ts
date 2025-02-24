import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

const dynamoDb = new DynamoDBClient({});
const eventBridge = new EventBridgeClient({});

const EXECUTION_TABLE_NAME = process.env.EXECUTION_TABLE_NAME;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

export const handler = async (event: any) => {
  //console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    if (!event.events) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid request, missing body" }),
      };
    }

    const eventData =
      typeof event.events === "string"
        ? JSON.parse(event.events)
        : event.events;

    if (eventData.length === 0 || !Array.isArray(eventData)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid event format. Expected an 'events' array.",
        }),
      };
    }

    const eventBridgeEntries = [];

    for (const singleEvent of eventData) {
      const { detailType, detail } = singleEvent;

      if (!detailType || !detail?.data) {
        console.warn(
          "Skipping invalid event:",
          JSON.stringify(singleEvent, null, 2),
        );
        continue;
      }

      const { eventId } = detail.data;

      if (!eventId) {
        console.warn(
          "⚠️ Skipping event due to missing eventId:",
          JSON.stringify(singleEvent, null, 2),
        );
        continue;
      }

      const {
        execution_status,
        current_phase,
        execution_plan,
        master_plan,
        dueDate,
      } = detail.data;

      if (["ParcelEvent-COLLECTION"].includes(detailType)) {
        const executionPlan = detail.data.execution_plan || [];

        await dynamoDb.send(
          new UpdateItemCommand({
            TableName: EXECUTION_TABLE_NAME,
            Key: { eventId: { S: eventId } },
            UpdateExpression:
              "SET eventType = :detailType, " +
              "current_phase = :currentPhase, " +
              "execution_status = :executionStatus, " +
              "execution_plan = list_append(if_not_exists(execution_plan, :emptyList), :newStep), " +
              "master_plan = list_append(if_not_exists(master_plan, :emptyListMaster), :masterPlan), " +
              "dueDate = :dueDate, " +
              "lastUpdated = :lastUpdated",
            ExpressionAttributeValues: {
              ":detailType": { S: detailType },
              ":currentPhase": { S: current_phase },
              ":executionStatus": { S: execution_status },
              ":newStep": {
                L: executionPlan.map((step: any) => ({
                  M: {
                    step: { S: step.step },
                    location: { S: step.location },
                    status: { S: step.status },
                    timestamp: { S: step.timestamp },
                  },
                })),
              },
              ":masterPlan": {
                L: master_plan.map((step: any) => ({
                  M: {
                    step: { S: step.step },
                    expected_location: { S: step.expected_location },
                    expected_time: { S: step.expected_time },
                  },
                })),
              },
              ":dueDate": { S: dueDate },
              ":lastUpdated": { S: new Date().toISOString() },
              ":emptyList": { L: [] },
              ":emptyListMaster": { L: [] },
            },
          }),
        );
      }

      if (
        [
          "ParcelEvent-FIRST-SORTING",
          "ParcelEvent-CROSS-DOCKING",
          "ParcelEvent-SECOND-SORTING",
          "ParcelEvent-DISTRIBUTION",
          "ParcelEvent-FINAL-CONSUMER",
        ].includes(detailType)
      ) {
        const existingItem = await dynamoDb.send(
          new GetItemCommand({
            TableName: EXECUTION_TABLE_NAME,
            Key: { eventId: { S: eventId } },
          }),
        );

        const existingExecutionPlan =
          existingItem.Item?.execution_plan?.L || [];

        await dynamoDb.send(
          new UpdateItemCommand({
            TableName: EXECUTION_TABLE_NAME,
            Key: { eventId: { S: eventId } },
            UpdateExpression:
              "SET eventType = :detailType, " +
              "current_phase = :currentPhase, " +
              "execution_status = :executionStatus, " +
              "execution_plan = list_append(:existingExecutionPlan, :newStep), " +
              "master_plan = list_append(if_not_exists(master_plan, :emptyListMaster), :masterPlan), " +
              "dueDate = :dueDate, " +
              "lastUpdated = :lastUpdated",
            ExpressionAttributeValues: {
              ":detailType": { S: detailType },
              ":currentPhase": { S: current_phase },
              ":executionStatus": { S: execution_status },
              ":existingExecutionPlan": { L: existingExecutionPlan },
              ":newStep": {
                L: execution_plan.map((step: any) => ({
                  M: {
                    step: { S: step.step },
                    location: { S: step.location },
                    status: { S: step.status },
                    timestamp: { S: step.timestamp },
                  },
                })),
              },
              ":masterPlan": {
                L: master_plan.map((step: any) => ({
                  M: {
                    step: { S: step.step },
                    expected_location: { S: step.expected_location },
                    expected_time: { S: step.expected_time },
                  },
                })),
              },
              ":dueDate": { S: dueDate },
              ":lastUpdated": { S: new Date().toISOString() },
              ":emptyListMaster": { L: [] },
            },
          }),
        );
      }

      eventBridgeEntries.push({
        EventBusName: EVENT_BUS_NAME,
        Source: "event.management",
        DetailType: detailType,
        Detail: JSON.stringify(singleEvent),
      });
    }

    if (eventBridgeEntries.length > 0) {
      const eventBridgeResponse = await eventBridge.send(
        new PutEventsCommand({ Entries: eventBridgeEntries }),
      );
      console.log(
        "EventBridge response:",
        JSON.stringify(eventBridgeResponse, null, 2),
      );
    } else {
      console.warn("⚠️ No valid events to send to EventBridge.");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Events processed successfully",
      }),
    };
  } catch (error) {
    console.error("Error processing events:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error", error }),
    };
  }
};
