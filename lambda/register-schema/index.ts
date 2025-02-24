import {
  SchemasClient,
  CreateSchemaCommand,
  CreateRegistryCommand,
  ListSchemasCommand,
} from "@aws-sdk/client-schemas";

const client = new SchemasClient({ region: process.env.AWS_REGION });

export const handler = async () => {
  const registryName = "PostNLEventSchemaRegistry";
  //console.log("Starting schema registration...");

  try {
    try {
      await client.send(
        new CreateRegistryCommand({ RegistryName: registryName }),
      );
      console.log(`Created registry: ${registryName}`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("already exists")) {
        console.log(
          `Registry ${registryName} already exists, skipping creation.`,
        );
      } else {
        throw error;
      }
    }

    const existingSchemas = await client.send(
      new ListSchemasCommand({ RegistryName: registryName }),
    );
    const existingSchemaNames = new Set(
      existingSchemas.Schemas?.map((s) => s.SchemaName),
    );

    const schemas = [
      {
        name: "ParcelEventSchema",
        content: `{
                    "$schema": "http://json-schema.org/draft-04/schema#",
                    "title": "ParcelEvent",
                    "type": "object",
                    "properties": {
                        "metadata": {
                            "type": "object",
                            "properties": {
                                "postnl_correlation_id": { "type": "string" },
                                "event_date_time": { "type": "string", "format": "date-time" }
                            },
                            "required": ["postnl_correlation_id", "event_date_time"]
                        },
                        "event_attributes": {
                            "type": "object",
                            "properties": {
                                "source_distribution_center": { "type": "string" },
                                "target_distribution_center": { "type": "string" }
                            },
                            "required": ["source_distribution_center", "target_distribution_center"]
                        },
                        "data": {
                            "type": "object",
                            "properties": {
                                "eventId": { "type": "string" },
                                "issuer": { "type": "string" },
                                "zipcode_destination": { "type": "string" },
                                "street_destination": { "type": "string" },
                                "house_number_destination": { "type": "string" },
                                "city_of_destination": {"type":"string"},
                                "country_of_destination": { "type": "string" },
                                "isPriority": { "type": "boolean" },
                                "isInsured": { "type": "boolean" },
                                "isRegistered": { "type": "boolean" },
                                "isReRouting": { "type": "boolean" },
                                "isReturning": { "type": "boolean" },
                                "track_and_trace": { "type": "string" },
                                "package_box_type": { "type": "string" },
                                "parcel_weight": { "type": "number" },
                                "execution_status": { "type": "string" },
                                "current_phase": { "type": "string" },
                                "execution_plan": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "step": { "type": "string" },
                                            "location": { "type": "string" },
                                            "status": { "type": "string", "enum": ["pending", "wip","completed", "failed"] },
                                            "timestamp": { "type": "string", "format": "date-time" }
                                        },
                                        "required": ["step", "location", "status", "timestamp"]
                                    }
                                },
                                "dueDate": { "type": "string", "format": "date-time" },
                                "timestamp": { "type": "string", "format": "date-time" }
                            },
                            "required": ["eventId", "issuer", "zipcode_destination", "execution_status", "timestamp"]
                        }
                    },
                    "required": ["metadata", "event_attributes", "data"]
                }`,
      },
      {
        name: "TrackTraceEventSchema",
        content: `{
                    "$schema": "http://json-schema.org/draft-04/schema#",
                    "title": "TrackTraceEvent",
                    "type": "object",
                    "properties": {
                        "metadata": {
                            "type": "object",
                            "properties": {
                                "postnl_correlation_id": { "type": "string" },
                                "event_date_time": { "type": "string", "format": "date-time" }
                            },
                            "required": ["postnl_correlation_id", "event_date_time"]
                        },
                        "event_attributes": {
                            "type": "object",
                            "properties": {
                                "source_distribution_center": { "type": "string" },
                                "target_distribution_center": { "type": "string" }
                            },
                            "required": ["source_distribution_center", "target_distribution_center"]
                        },
                        "data": {
                            "type": "object",
                            "properties": {
                                "eventId": { "type": "string" },
                                "track_and_trace": { "type": "string" },
                                "execution_status": { "type": "string" },
                                "current_phase": { "type": "string" },
                                "execution_plan": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "step": { "type": "string" },
                                            "location": { "type": "string" },
                                            "status": { "type": "string", "enum": ["pending", "completed", "failed"] },
                                            "timestamp": { "type": "string", "format": "date-time" }
                                        },
                                        "required": ["step", "location", "status", "timestamp"]
                                    }
                                },
                                "dueDate": { "type": "string", "format": "date-time" },
                                "timestamp": { "type": "string", "format": "date-time" }
                            },
                            "required": ["eventId", "execution_status", "timestamp", "dueDate"]
                        }
                    },
                    "required": ["metadata", "event_attributes", "data"]
                }`,
      },
      {
        name: "DigitalLabelEventSchema",
        content: `{
                    "$schema": "http://json-schema.org/draft-04/schema#",
                    "title": "DigitalLabelEvent",
                    "type": "object",
                    "properties": {
                        "metadata": {
                            "type": "object",
                            "properties": {
                                "postnl_correlation_id": { "type": "string" },
                                "event_date_time": { "type": "string", "format": "date-time" }
                            },
                            "required": ["postnl_correlation_id", "event_date_time"]
                        },
                        "event_attributes": {
                            "type": "object",
                            "properties": {
                                "source_distribution_center": { "type": "string" },
                                "target_distribution_center": { "type": "string" }
                            },
                            "required": ["source_distribution_center", "target_distribution_center"]
                        },
                        "data": {
                            "type": "object",
                            "properties": {
                                "eventId": { "type": "string" },
                                "issuer": { "type": "string" },
                                "zipcode_destination": { "type": "string" },
                                "street_destination": { "type": "string" },
                                "house_number_destination": { "type": "string" },
                                "city_of_destination": {"type":"string"},
                                "country_of_destination": { "type": "string" },
                                "current_phase": { "type": "string" },
                                "dueDate": { "type": "string", "format": "date-time" },
                                "timestamp": { "type": "string", "format": "date-time" }
                            },
                            "required": ["eventId", "issuer", "zipcode_destination", "street_destination", "house_number_destination", "city_of_destination", "country_of_destination"]
                        }
                    },
                    "required": ["metadata", "event_attributes", "data"]
                }`,
      },
    ];

    for (const schema of schemas) {
      if (!existingSchemaNames.has(schema.name)) {
        await client.send(
          new CreateSchemaCommand({
            RegistryName: registryName,
            SchemaName: schema.name,
            Type: "JSONSchemaDraft4",
            Content: schema.content,
          }),
        );
        console.log(`Registered schema: ${schema.name}`);
      } else {
        console.log(`Schema ${schema.name} already exists, skipping.`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Schemas registered successfully!" }),
    };
  } catch (error: unknown) {
    console.error("Error registering the schema:", error);
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
