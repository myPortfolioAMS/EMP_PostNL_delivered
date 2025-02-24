import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { DynamoDBStreamEvent } from "aws-lambda";

const MASTER_PLANS_TABLE_NAME = process.env.MASTER_PLANS_TABLE_NAME;

const dynamoDb = new DynamoDBClient({});

export const handler = async (event: DynamoDBStreamEvent) => {
  //console.log("event from LISTENER EXECUTION PLAN:", event);
  for (const record of event.Records) {
    if (record.eventName === "MODIFY" || record.eventName === "INSERT") {
      const executionPlan = record.dynamodb?.NewImage;

      const executionSteps: AttributeValue[] =
        (executionPlan?.execution_plan?.L as AttributeValue[]) ?? [];

      if (!executionPlan) {
        console.warn("Skipping record: Missing execution plan data.");
        continue;
      }
      const eventId = executionPlan.eventId?.S;
      const execution_plan = executionPlan.execution_plan?.L;
      const currentPhase = executionPlan.current_phase?.S;

      if (!eventId || !execution_plan || execution_plan.length === 0) {
        console.warn("Skipping record: Missing event ID or execution plan.");
        continue;
      }

      /* eslint-disable prettier/prettier */
      const phaseIndexMap: Record<string, number> = {
        "COLLECTION": 0,
        "FIRST_SORTING": 1,
        "CROSS_DOCKING": 2,
        "SECOND_SORTING": 3,
        "DISTRIBUTION": 4,
        "FINAL_DESTINATION": 5,
      };
      /* eslint-disable prettier/prettier */

      
      const stepIndex = phaseIndexMap[currentPhase ?? ""] ?? -1;

      let currentStep = "UNKNOWN_STEP";
      let currentLocation = "UNKNOWN_LOCATION";
      let currentTime = "UNKNOWN_CURRRENT_TIME";
      let currentStatus = "UNKNOWN_STATUS";

      if (stepIndex !== -1) {
        currentStep =
          executionPlan.execution_plan?.L?.[stepIndex]?.M?.step?.S ??
          "UNKNOWN_STEP";
          currentLocation = executionPlan.execution_plan?.L?.[stepIndex]?.M?.location?.S ??
          "UNKNOWN_LOCATION";
          currentTime = executionPlan.execution_plan?.L?.[stepIndex]?.M?.timestamp?.S ?? "UNKNOWN_CURRRENT_TIME";
          currentStatus = executionPlan.execution_plan?.L?.[stepIndex]?.M?.status?.S ?? "UNKNOWN_STATUS";

      }
      console.log("current Status:", currentStatus);

      const masterPlanResult = await dynamoDb.send(
        new GetItemCommand({
          TableName: MASTER_PLANS_TABLE_NAME,
          Key: { shipment_type: { S: "Standard_Shipping" } },
        }),
      );

      if (!masterPlanResult.Item) {
        console.error("Master plan not found for Standard_Shipping");
        continue;
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
        continue;
      }

      const masterPlanSteps = masterPlanResult.Item.steps.L.filter(
        (step) => step.M,
      )
        .map((step) => ({
          step: step.M?.step?.S ?? "UNKNOWN_STEP",
          expected_location: step.M?.expected_location?.S ?? "UNKNOWN_LOCATION",
          expected_time: step.M?.expected_time?.S ?? "UNKNOWN_TIME",
        }));

      console.log(
        "Parsed masterPlanSteps:",
        JSON.stringify(masterPlanSteps, null, 2),
      );

      const expectedStep = masterPlanSteps.find(
        (step) => step.step === currentPhase,
      );
      

      let expectedLocation = expectedStep?.expected_location || "UNKNOWN_EXPECTED_LOCATION";
      let expected_time = expectedStep?.expected_time || "UNKNOWN_EXPECTED_TIME"


      if (!expectedStep) continue;

      if (expectedLocation === currentLocation && expected_time > currentTime) {
        console.log(
          `NO Deviation: Step ${currentStep} related to ${eventId} is ON-schedule - execution plan matches master plan.`
        );
      } else {
        console.log(
          `Deviation detected: Step ${currentStep} related to ${eventId} is OFF-schedule.`
        );
      }
      // if (
      //   currentStep.M?.location.S !== expectedStep.expected_location ||
      //   new Date(currentStep.M.timestamp.S!) >
      //     new Date(expectedStep.expected_time)
      // ) {
      //   console.log(
      //     `Deviation detected: Step ${currentStep.M?.step.S} is off-schedule.`,
      //   );

        // Logic to correct deviations
        await dynamoDb.send(
          new UpdateItemCommand({
            TableName: "ExecutionPlanTable",
            Key: { eventId: { S: eventId } },
            UpdateExpression: "SET execution_plan = :updatedPlan",
            ExpressionAttributeValues: {
              ":updatedPlan": fixExecutionPlan(executionSteps),
            },
          }),
        );
      }
    }
  }


const fixExecutionPlan = (
  currentPlan: AttributeValue[],
): { L: AttributeValue[] } => {
  const updatedPlan = [...currentPlan];

  const formattedPlan = updatedPlan.map((step) => ({
    M: {
      step: { S: step.M?.step?.S || "UNKNOWN_STEP" },
      location: { S: step.M?.location?.S || "UNKNOWN_LOCATION" },
      timestamp: { S: step.M?.timestamp?.S || new Date().toISOString() },
    },
  }));

  return { L: formattedPlan };
};
