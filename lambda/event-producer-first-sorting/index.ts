import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { createMetricsLogger } from "aws-embedded-metrics";
import { randomUUID } from "crypto";

const lambdaClient = new LambdaClient({});
const metricsLogger = createMetricsLogger();

const EVENT_MANAGEMENT_LAMBDA_NAME = process.env.EVENT_MANAGEMENT_LAMBDA_NAME!;
const MASTER_PLANS_TABLE_NAME = process.env.MASTER_PLANS_TABLE_NAME;

const dynamoDb = new DynamoDBClient({});

export const handler = async (event: any) => {
  //console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const requestBody =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;

    if (!requestBody.detailType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing event details" }),
      };
    }

    metricsLogger.putDimensions({ Service: "FirstSorting" });
    metricsLogger.putMetric("FirstSorting", 1);
    await metricsLogger.flush();

    const masterPlanResult = await dynamoDb.send(
      new GetItemCommand({
        TableName: MASTER_PLANS_TABLE_NAME,
        Key: { shipment_type: { S: "Standard_Shipping" } },
      }),
    );

    if (!masterPlanResult.Item) {
      console.error("Master plan not found for Standard_Shipping");
    }

    if (
      !masterPlanResult.Item ||
      !masterPlanResult.Item.steps ||
      !masterPlanResult.Item.steps.L
    ) {
      console.error(
        "Master plan data structure is incorrect or missing 'steps'",
      );
      console.error(
        "masterPlanResult:",
        JSON.stringify(masterPlanResult, null, 2),
      );
    }

    const masterPlanSteps = masterPlanResult?.Item?.steps?.L?.filter(
      (step) => step.M,
    ).map((step) => ({
      step: step.M?.step?.S ?? "UNKNOWN_STEP",
      expected_location: step.M?.expected_location?.S ?? "UNKNOWN_LOCATION",
      expected_time: step.M?.expected_time?.S ?? "UNKNOWN_TIME",
    }));

    let location = requestBody.execution_plan[0]?.location;
    let timestamp = requestBody.execution_plan[0]?.timestamp;
    let expected_location: string | undefined;
    let expected_time: string | undefined;

    if (Array.isArray(masterPlanSteps) && masterPlanSteps.length > 0) {
      expected_location = masterPlanSteps[1]?.expected_location;
      expected_time = masterPlanSteps[1]?.expected_time;
    } else {
      console.warn("No steps available in masterPlanSteps");
    }

    if (
      expected_location === location &&
      expected_time &&
      timestamp &&
      new Date(expected_time) >= new Date(timestamp)
    ) {
      requestBody.master_plan = masterPlanSteps;
    } else {
      console.warn("Skipping update: Invalid expected_time or timestamp");
    }

    const enrichedEvent = {
      metadata: {
        postnl_correlation_id: randomUUID(),
        event_date_time: new Date().toISOString(),
      },
      event_attributes: {
        source_distribution_center: "AMS_RONKIN_01",
        target_distribution_center: "Den_Haag_01",
      },
      data: requestBody,
    };

    // const trackTraceEvent = {
    //   metadata: {
    //     postnl_correlation_id: randomUUID(),
    //     event_date_time: new Date().toISOString(),
    //   },
    //   event_attributes: {
    //     source_distribution_center: "AMS_RONKIN_01",
    //     target_distribution_center: "Den_Haag_01",
    //   },
    //   data: {
    //     eventId: requestBody.eventId,
    //     track_and_trace: requestBody.track_and_trace,
    //     execution_status: requestBody.execution_status,
    //     current_phase: requestBody.current_phase,
    //     execution_plan:
    //       requestBody.execution_plan?.map((step: any) => ({
    //         step: step.step,
    //         location: step.location,
    //         status: step.status,
    //         timestamp: step.timestamp,
    //       })) || [],
    //     dueDate: requestBody.dueDate,
    //     timeStamp: requestBody.timestamp,
    //   },
    // };

    // const trackTraceString = JSON.stringify(trackTraceEvent);

    // const digitalLabelEvent = {
    //   metadata: {
    //     postnl_correlation_id: randomUUID(),
    //     event_date_time: new Date().toISOString(),
    //   },
    //   event_attributes: {
    //     source_distribution_center: "AMS_RONKIN_01",
    //     target_distribution_center: "Den_Haag_01",
    //   },
    //   data: {
    //     eventId: requestBody.eventId,
    //     issuer: requestBody.issuer,
    //     zipcode_destination: requestBody.zipcode_destination,
    //     street_destination: requestBody.street_destination,
    //     house_number_destination: requestBody.house_number_destination,
    //     city_of_destination: requestBody.city_of_destination,
    //     country_of_destination: requestBody.country_of_destination,
    //     current_phase: requestBody.current_phase,
    //     dueDate: requestBody.dueDate,
    //     timeStamp: requestBody.timestamp,
    //   },
    // };

    // const digitalLabelString = JSON.stringify(digitalLabelEvent);

    // const detailEnrichedString = JSON.stringify(enrichedEvent);

    const eventsToSend = [
      { detailType: "ParcelEvent-FIRST-SORTING", detail: enrichedEvent },
      // { detailType: "TrackTraceEvent", detail: trackTraceEvent },
      // { detailType: "DigitalLabelEvent", detail: digitalLabelEvent },
    ];

    console.log(
      "Sending events from FIRST SORTING to eventManagementLambda:",
      eventsToSend,
    );

    const invokeParams = {
      FunctionName: EVENT_MANAGEMENT_LAMBDA_NAME,
      InvocationType: "Event" as "Event",
      Payload: JSON.stringify({ events: eventsToSend }),
    };

    await lambdaClient.send(new InvokeCommand(invokeParams));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Events sent from FIRST SORTING to Event Management Layer",
      }),
    };
  } catch (error) {
    console.error("Error sending event:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", details: error }),
    };
  }
};
