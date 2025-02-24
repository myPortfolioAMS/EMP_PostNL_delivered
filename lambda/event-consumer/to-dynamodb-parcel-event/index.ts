//code below was used to interact with SQS
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SQSEvent } from "aws-lambda";

const ddbClient = new DynamoDBClient({});
const tableName = process.env.TABLE_NAME!;

export const handler = async (event: SQSEvent) => {
  //console.log("Processing SQS Messages from:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const parcelEvent = JSON.parse(record.body);

      const { detailType } = parcelEvent.detail;

      if (
        detailType !== "DigitalLabelEvent" &&
        detailType !== "TrackTraceEvent"
      ) {
        const {
          eventId = "UNKNOWN_ID",
          issuer = "UNKNOWN_ISSUER",
          zipcode_destination = "UNKNOWN_ZIP",
          street_destination = "UNKNOWN_STREET",
          house_number_destination = "UNKNOWN_HOUSE",
          city_of_destination = "UNKNOWN_CITY",
          country_of_destination = "UNKNOWN_COUNTRY",
          isPriority = false,
          isInsured = false,
          isRegistered = false,
          isReRouting = false,
          isReturning = false,
          track_and_trace = "UNKNOWN_TRACK",
          package_box_type = "UNKNOWN_TYPE",
          parcel_weight = 0,
          execution_status = "UNKNOWN_STATUS",
          current_phase = "UNKNOWN_PHASE",
          execution_plan = [],
          master_plan = [],
          dueDate = new Date().toISOString(),
          timestamp = new Date().toISOString(),
        } = parcelEvent.detail.detail?.data || {};

        const putParams = {
          TableName: tableName,
          Item: {
            eventId: { S: eventId },
            eventType: { S: detailType || "ParcelEvent" },
            issuer: { S: issuer },
            zipcode_destination: { S: zipcode_destination },
            street_destination: { S: street_destination },
            house_number_destination: { S: house_number_destination },
            city_of_destination: { S: city_of_destination },
            country_of_destination: { S: country_of_destination },
            isPriority: { BOOL: isPriority },
            isInsured: { BOOL: isInsured },
            isRegistered: { BOOL: isRegistered },
            isReRouting: { BOOL: isReRouting },
            isReturning: { BOOL: isReturning },
            track_and_trace: { S: track_and_trace },
            package_box_type: { S: package_box_type },
            parcel_weight: { N: (parcel_weight ?? 0).toString() },
            execution_status: { S: execution_status },
            current_phase: { S: current_phase },
            execution_plan: {
              L: execution_plan.map((step: any) => ({
                M: {
                  step: { S: step.step || "UNKNOWN_STEP" },
                  location: { S: step.location || "UNKNOWN_LOCATION" },
                  status: { S: step.status || "UNKNOWN_STATUS" },
                  timestamp: { S: step.timestamp || new Date().toISOString() },
                },
              })),
            },
            master_plan: {
              L: master_plan.map((step: any) => ({
                M: {
                  step: { S: step.step || "UNKNOWN_STEP" },
                  expected_location: {
                    S: step.expected_location || "UNKNOWN_LOCATION",
                  },
                  expected_time: {
                    S: step.expected_time || new Date().toISOString(),
                  },
                },
              })),
            },
            dueDate: { S: dueDate },
            timestamp: { S: timestamp },
          },
        };

        await ddbClient.send(new PutItemCommand(putParams));
        console.log(`Event ${parcelEvent.detail.eventId} stored in DynamoDB`);
      } else {
        console.log(`Skipping event with detailType: ${detailType}`);
      }
    } catch (error) {
      console.error("Error processing event:", error);
    }
  }
};
