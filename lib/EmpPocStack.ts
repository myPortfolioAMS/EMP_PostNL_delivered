import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as eventbridge from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as customResources from "aws-cdk-lib/custom-resources";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";

export class EmpPocStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "EMP_PostNL_UserPool",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      authFlows: { userPassword: true },
      generateSecret: false,
    });

    const usersTable = new dynamodb.Table(this, "EMP_PostNL_UserTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // TODO - remove this before deployment
    });

    const lambdaLayer = new lambda.LayerVersion(this, "CommonLayer", {
      code: lambda.Code.fromAsset("layers/layer.zip"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: "Shared dependencies for Lambda functions",
    });

    const registerLambda = new lambda.Function(this, "RegisterFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("dist/lambda/auth/register"),
      layers: [lambdaLayer],
      environment: {
        TABLE_NAME: usersTable.tableName,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      memorySize: 1024,
      timeout: cdk.Duration.seconds(6),
    });

    usersTable.grantWriteData(registerLambda);

    const loginLambda = new lambda.Function(this, "LoginFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("dist/lambda/auth/login"),
      layers: [lambdaLayer],
      environment: {
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      memorySize: 1024,
      timeout: cdk.Duration.seconds(6),
    });

    usersTable.grantReadData(loginLambda);

    const parcelsEventsTable = new dynamodb.Table(this, "EventStatusTable", {
      partitionKey: { name: "eventId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "eventType", type: dynamodb.AttributeType.STRING },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // TODO Change to RETAIN in production
      billingMode: dynamodb.BillingMode.PROVISIONED,
    });

    //Enable DynamoDB Auto Scaling on Read/Write Throughput - billingMode above switch to PROVISIONED
    parcelsEventsTable
      .autoScaleWriteCapacity({
        minCapacity: 5,
        maxCapacity: 50,
      })
      .scaleOnUtilization({ targetUtilizationPercent: 75 });

    const parcelEventQueue = new sqs.Queue(this, "ParcelEventQueue", {
      queueName: "PostNLParcelEventQueue",
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(7),
    });

    const trackTraceEventQueue = new sqs.Queue(this, "TrackTraceEventQueue", {
      queueName: "PostNLTrackTraceEventQueue",
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(7),
    });

    const digitalLabelEventQueue = new sqs.Queue(
      this,
      "DigitalLabelEventQueue",
      {
        queueName: "PostNLDigitalLabelEventQueue",
        visibilityTimeout: cdk.Duration.seconds(60),
        retentionPeriod: cdk.Duration.days(7),
      },
    );

    const eventBus = new eventbridge.EventBus(this, "PostNLEventBus", {
      eventBusName: "PostNLEventBus",
    });

    // SECOND STACK - EventManagementStack
    const executionPlansTable = new dynamodb.Table(this, "ExecutionPlans", {
      partitionKey: { name: "eventId", type: dynamodb.AttributeType.STRING },
      tableName: "ExecutionPlans",
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      billingMode: dynamodb.BillingMode.PROVISIONED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    executionPlansTable
      .autoScaleWriteCapacity({
        minCapacity: 5,
        maxCapacity: 50,
      })
      .scaleOnUtilization({ targetUtilizationPercent: 75 });

    const masterPlansTable = new dynamodb.Table(this, "MasterPlans", {
      partitionKey: {
        name: "shipment_type",
        type: dynamodb.AttributeType.STRING,
      },
      tableName: "MasterPlans",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const priorityMasterPlansTable = new dynamodb.Table(
      this,
      "PriorityMasterPlans",
      {
        partitionKey: {
          name: "shipment_type",
          type: dynamodb.AttributeType.STRING,
        },
        tableName: "PriorityMasterPlans",
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      },
    );

    const addMasterPlanLambda = new lambda.Function(
      this,
      "AddMasterPlanLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("dist/lambda/master-plan"),
        environment: {
          TABLE_NAME: masterPlansTable.tableName,
        },
      },
    );

    masterPlansTable.grantWriteData(addMasterPlanLambda);

    const addPriorityMasterPlanLambda = new lambda.Function(
      this,
      "AddPriorityMasterPlanLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("dist/lambda/priority-master-plan"),
        environment: {
          TABLE_NAME: priorityMasterPlansTable.tableName,
        },
      },
    );

    priorityMasterPlansTable.grantWriteData(addPriorityMasterPlanLambda);

    const listenerExecutionPlanLambda = new lambda.Function(
      this,
      "ListenerExecutionPlanLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("dist/lambda/listener-execution-plan"),
        environment: {
          EXECUTION_PLANS_TABLE_NAME: executionPlansTable.tableName,
          MASTER_PLANS_TABLE_NAME: masterPlansTable.tableName,
        },
      },
    );

    masterPlansTable.grantReadData(listenerExecutionPlanLambda);
    executionPlansTable.grantReadWriteData(listenerExecutionPlanLambda);

    listenerExecutionPlanLambda.addEventSource(
      new lambdaEventSources.DynamoEventSource(executionPlansTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 5,
        retryAttempts: 2,
      }),
    );

    const eventManagementLambda = new lambda.Function(
      this,
      "EventManagementLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("dist/lambda/event-management"),
        environment: {
          EXECUTION_TABLE_NAME: executionPlansTable.tableName,
          EVENT_BUS_NAME: eventBus.eventBusName,
        },
        timeout: cdk.Duration.seconds(10),
        memorySize: 1024,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    eventManagementLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
        ],
        resources: [
          executionPlansTable.tableArn,
          "arn:aws:dynamodb:eu-central-1:640168440129:table/EmPocStack-EventManagementTable509CFB8F-1UNXTVPS59MFZ",
        ],
      }),
    );

    eventManagementLambda.addPermission("EventBridgeInvoke", {
      principal: new iam.ServicePrincipal("events.amazonaws.com"),
      sourceArn: eventBus.eventBusArn,
    });

    const warmupLambda = new lambda.Function(this, "WarmupLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("dist/lambda/keepThemWarm"),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        listenerExecutionPlanLambda_ARN:
          listenerExecutionPlanLambda.functionArn,
        eventManagementLambda_ARN: eventManagementLambda.functionArn,
      },
    });

    warmupLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [registerLambda.functionArn, loginLambda.functionArn],
      }),
    );

    new cdk.aws_events.Rule(this, "WarmupSchedule", {
      schedule: cdk.aws_events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new cdk.aws_events_targets.LambdaFunction(warmupLambda)],
    });

    const lambdaDLQ = new sqs.Queue(this, "LambdaDLQ", {
      retentionPeriod: cdk.Duration.days(7),
    });

    const eventProducerLambda = new lambda.Function(
      this,
      "EventProducerLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("dist/lambda/event-producer"),
        environment: {
          EVENT_BUS_NAME: eventBus.eventBusName,
          EVENT_MANAGEMENT_LAMBDA_NAME: eventManagementLambda.functionName,
          MASTER_PLANS_TABLE_NAME: masterPlansTable.tableName,
        },
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        //reservedConcurrentExecutions: 100, // tune based on load testing & free tier
        deadLetterQueue: lambdaDLQ,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    masterPlansTable.grantReadData(eventProducerLambda);

    // eventProducerLambda.addToRolePolicy(
    //   new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     actions: ["dynamodb:GetItem"],
    //     resources: [masterPlansTable.tableArn],
    //   }),
    // );

    eventManagementLambda.grantInvoke(eventProducerLambda);

    eventProducerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [eventManagementLambda.functionArn],
      }),
    );

    eventBus.grantPutEventsTo(eventProducerLambda);

    const lambdaErrorAlarm_eventProducerLambda = new cloudwatch.Alarm(
      this,
      "LambdaErrorAlarm_eventProducerLambda",
      {
        metric: eventProducerLambda.metricErrors(),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: "Lambda errors detected eventProducerLambda",
        actionsEnabled: true,
      },
    );

    const eventProducerFirstSortingLambda = new lambda.Function(
      this,
      "EventProducerFirstSortingLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("dist/lambda/event-producer-first-sorting"),
        environment: {
          EVENT_BUS_NAME: eventBus.eventBusName,
          EVENT_MANAGEMENT_LAMBDA_NAME: eventManagementLambda.functionName,
          MASTER_PLANS_TABLE_NAME: masterPlansTable.tableName,
        },
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        //reservedConcurrentExecutions: 100,
        deadLetterQueue: lambdaDLQ,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    const eventProducerCrossDockingLambda = new lambda.Function(
      this,
      "EventProducerCrossDockingLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("dist/lambda/event-producer-cross-docking"),
        environment: {
          EVENT_BUS_NAME: eventBus.eventBusName,
          EVENT_MANAGEMENT_LAMBDA_NAME: eventManagementLambda.functionName,
          MASTER_PLANS_TABLE_NAME: masterPlansTable.tableName,
        },
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        //reservedConcurrentExecutions: 100,
        deadLetterQueue: lambdaDLQ,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    const eventProducerSecondSortingLambda = new lambda.Function(
      this,
      "EventProducerSecondSortingLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          "dist/lambda/event-producer-second-sorting",
        ),
        environment: {
          EVENT_BUS_NAME: eventBus.eventBusName,
          EVENT_MANAGEMENT_LAMBDA_NAME: eventManagementLambda.functionName,
          MASTER_PLANS_TABLE_NAME: masterPlansTable.tableName,
        },
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        //reservedConcurrentExecutions: 100,
        deadLetterQueue: lambdaDLQ,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    const eventProducerDistributionLambda = new lambda.Function(
      this,
      "EventProducerDistributionLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("dist/lambda/event-producer-distribution"),
        environment: {
          EVENT_BUS_NAME: eventBus.eventBusName,
          EVENT_MANAGEMENT_LAMBDA_NAME: eventManagementLambda.functionName,
          MASTER_PLANS_TABLE_NAME: masterPlansTable.tableName,
        },
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        deadLetterQueue: lambdaDLQ,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    const eventProducerFinalConsumerLambda = new lambda.Function(
      this,
      "EventProducerFinalConsumerLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          "dist/lambda/event-producer-final-consumer",
        ),
        environment: {
          EVENT_BUS_NAME: eventBus.eventBusName,
          EVENT_MANAGEMENT_LAMBDA_NAME: eventManagementLambda.functionName,
          MASTER_PLANS_TABLE_NAME: masterPlansTable.tableName,
        },
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        //reservedConcurrentExecutions: 100,
        deadLetterQueue: lambdaDLQ,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    masterPlansTable.grantReadData(eventProducerFirstSortingLambda);
    masterPlansTable.grantReadData(eventProducerCrossDockingLambda);
    masterPlansTable.grantReadData(eventProducerSecondSortingLambda);
    masterPlansTable.grantReadData(eventProducerDistributionLambda);
    masterPlansTable.grantReadData(eventProducerFinalConsumerLambda);

    eventManagementLambda.grantInvoke(eventProducerLambda);
    eventManagementLambda.grantInvoke(eventProducerFirstSortingLambda);
    eventManagementLambda.grantInvoke(eventProducerCrossDockingLambda);
    eventManagementLambda.grantInvoke(eventProducerSecondSortingLambda);
    eventManagementLambda.grantInvoke(eventProducerDistributionLambda);
    eventManagementLambda.grantInvoke(eventProducerFinalConsumerLambda);

    eventProducerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [eventManagementLambda.functionArn],
      }),
    );

    eventProducerFirstSortingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [eventManagementLambda.functionArn],
      }),
    );

    eventProducerCrossDockingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [eventManagementLambda.functionArn],
      }),
    );

    eventProducerSecondSortingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [eventManagementLambda.functionArn],
      }),
    );

    eventProducerDistributionLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [eventManagementLambda.functionArn],
      }),
    );

    eventProducerFinalConsumerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [eventManagementLambda.functionArn],
      }),
    );

    eventBus.grantPutEventsTo(eventProducerLambda);
    eventBus.grantPutEventsTo(eventProducerFirstSortingLambda);
    eventBus.grantPutEventsTo(eventProducerCrossDockingLambda);
    eventBus.grantPutEventsTo(eventProducerSecondSortingLambda);
    eventBus.grantPutEventsTo(eventProducerDistributionLambda);
    eventBus.grantPutEventsTo(eventProducerFinalConsumerLambda);

    const eventProcessingRule = new eventbridge.Rule(
      this,
      "EventProcessingRule",
      {
        eventBus: eventBus,
        eventPattern: {
          source: ["postnl.event"],
        },
      },
    );

    eventProcessingRule.addTarget(
      new targets.LambdaFunction(eventManagementLambda),
    );

    eventBus.grantPutEventsTo(eventManagementLambda);

    const executionRule = new eventbridge.Rule(this, "ExecutionRule", {
      eventBus: eventBus,
      eventPattern: {
        source: ["event.management"],
      },
    });

    executionRule.addTarget(new targets.SqsQueue(parcelEventQueue));
    executionRule.addTarget(new targets.SqsQueue(trackTraceEventQueue));
    executionRule.addTarget(new targets.SqsQueue(digitalLabelEventQueue));

    const parcelEventDLQ = new sqs.Queue(this, "ParcelEventDLQ", {
      queueName: "ParcelEventDeadLetterQueue",
      retentionPeriod: cdk.Duration.days(14),
    });

    const parcelEventRule = new eventbridge.Rule(this, "ParcelEventRule", {
      eventBus: eventBus,
      eventPattern: {
        source: ["postnl.event"],
        detailType: ["ParcelEvent"],
      },
    });
    parcelEventRule.addTarget(
      new targets.SqsQueue(parcelEventQueue, {
        deadLetterQueue: parcelEventDLQ,
      }),
    );

    const trackTraceEventDLQ = new sqs.Queue(this, "TrackTraceEventDLQ", {
      queueName: "TrackTraceEventDeadLetterQueue",
      retentionPeriod: cdk.Duration.days(14),
    });

    const trackTraceEventRule = new eventbridge.Rule(
      this,
      "TrackTraceEventRule",
      {
        eventBus: eventBus,
        eventPattern: {
          source: ["postnl.event"],
          detailType: ["TrackTraceEvent"],
        },
      },
    );
    trackTraceEventRule.addTarget(
      new targets.SqsQueue(trackTraceEventQueue, {
        deadLetterQueue: trackTraceEventDLQ,
      }),
    );

    const digitalLabelEventDLQ = new sqs.Queue(this, "DigitalLabelEventDLQ", {
      queueName: "DigitalLabelEventDeadLetterQueue",
      retentionPeriod: cdk.Duration.days(14),
    });

    const digitalLabelEventRule = new eventbridge.Rule(
      this,
      "DigitalLabelEventRule",
      {
        eventBus: eventBus,
        eventPattern: {
          source: ["postnl.event"],
          detailType: ["DigitalLabelEvent"],
        },
      },
    );
    digitalLabelEventRule.addTarget(
      new targets.SqsQueue(digitalLabelEventQueue, {
        deadLetterQueue: digitalLabelEventDLQ,
      }),
    );

    const toDynamoLambdaParcelEvent = new lambda.Function(
      this,
      "ToDynamoLambdaParcelEvent",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          "dist/lambda/event-consumer/to-dynamodb-parcel-event",
        ),
        environment: {
          TABLE_NAME: parcelsEventsTable.tableName,
        },
        events: [
          new lambdaEventSources.SqsEventSource(parcelEventQueue, {
            batchSize: 10, // TODO - LOAD TEST with free tier between 10 - 50
            maxBatchingWindow: cdk.Duration.seconds(5),
          }),
        ],
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        //reservedConcurrentExecutions: 50,
        deadLetterQueue: lambdaDLQ,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    toDynamoLambdaParcelEvent.addEnvironment(
      "TABLE_NAME",
      parcelsEventsTable.tableName,
    );
    parcelsEventsTable.grantWriteData(toDynamoLambdaParcelEvent);

    parcelsEventsTable.grantWriteData(toDynamoLambdaParcelEvent);

    const lambdaErrorAlarm_toDynamoLambdaParcelEvent = new cloudwatch.Alarm(
      this,
      "LambdaErrorAlarm_toDynamoLambdaParcelEvent",
      {
        metric: toDynamoLambdaParcelEvent.metricErrors(),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: "Lambda errors detected toDynamoLambdaParcelEvent",
        actionsEnabled: true,
      },
    );

    const fromDynamoLambdaParcelEvent = new lambda.Function(
      this,
      "fromDynamoLambdaParcelEvent",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          "dist/lambda/event-consumer/from-dynamodb-parcel-event",
        ),
        environment: {
          TABLE_NAME: parcelsEventsTable.tableName,
        },
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        //reservedConcurrentExecutions: 50,
        deadLetterQueue: lambdaDLQ,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    parcelsEventsTable.grantReadData(fromDynamoLambdaParcelEvent);

    const lambdaErrorAlarm_fromDynamoLambdaParcelEvent = new cloudwatch.Alarm(
      this,
      "LambdaErrorAlarm_fromDynamoLambdaParcelEvent",
      {
        metric: fromDynamoLambdaParcelEvent.metricErrors(),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: "Lambda errors detected fromDynamoLambdaParcelEvent",
        actionsEnabled: true,
      },
    );

    const trackTraceEventConsumerLambda = new lambda.Function(
      this,
      "TrackTraceEventConsumerLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          "dist/lambda/event-consumer/track-trace-event",
        ),
        environment: {
          TRACK_TRACE_EVENT_QUEUE_URL: trackTraceEventQueue.queueUrl,
        },
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        //reservedConcurrentExecutions: 50,
        deadLetterQueue: lambdaDLQ,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );
    trackTraceEventConsumerLambda.addEnvironment(
      "TRACK_TRACE_QUEUE_URL",
      trackTraceEventQueue.queueUrl,
    );
    trackTraceEventQueue.grantConsumeMessages(trackTraceEventConsumerLambda);

    const lambdaErrorAlarm_trackTraceEventConsumerLambda = new cloudwatch.Alarm(
      this,
      "LambdaErrorAlarm_trackTraceEventConsumerLambda",
      {
        metric: trackTraceEventConsumerLambda.metricErrors(),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription:
          "Lambda errors detected trackTraceEventConsumerLambda",
        actionsEnabled: true,
      },
    );

    const digitalLabelEventConsumerLambda = new lambda.Function(
      this,
      "DigitalLabelEventConsumerLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          "dist/lambda/event-consumer/digital-label-event",
        ),
        environment: {
          DIGITAL_LABEL_EVENT_QUEUE_URL: digitalLabelEventQueue.queueUrl,
        },
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        //reservedConcurrentExecutions: 50,
        deadLetterQueue: lambdaDLQ,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );
    digitalLabelEventConsumerLambda.addEnvironment(
      "DIGITAL_LABEL_QUEUE_URL",
      digitalLabelEventQueue.queueUrl,
    );
    digitalLabelEventQueue.grantConsumeMessages(
      digitalLabelEventConsumerLambda,
    );

    const lambdaErrorAlarm_digitalLabelEventConsumerLambda =
      new cloudwatch.Alarm(
        this,
        "LambdaErrorAlarm_digitalLabelEventConsumerLambda",
        {
          metric: digitalLabelEventConsumerLambda.metricErrors(),
          threshold: 1,
          evaluationPeriods: 1,
          alarmDescription:
            "Lambda errors detected digitalLabelEventConsumerLambda",
          actionsEnabled: true,
        },
      );

    const topic = new sns.Topic(this, "EventProcessingAlert");
    topic.addSubscription(
      new snsSubscriptions.EmailSubscription("miguel.gustavo.gil@gmail.com"),
    );

    const errorNotificationTopic = new sns.Topic(
      this,
      "LambdaErrorNotificationTopic",
      {
        displayName: "Lambda Error Notifications",
      },
    );

    errorNotificationTopic.addSubscription(
      new snsSubscriptions.EmailSubscription("miguel.gustavo.gil@gmail.com"),
    );

    lambdaErrorAlarm_eventProducerLambda.addAlarmAction(
      new cloudwatchActions.SnsAction(errorNotificationTopic),
    );
    lambdaErrorAlarm_toDynamoLambdaParcelEvent.addAlarmAction(
      new cloudwatchActions.SnsAction(errorNotificationTopic),
    );
    lambdaErrorAlarm_fromDynamoLambdaParcelEvent.addAlarmAction(
      new cloudwatchActions.SnsAction(errorNotificationTopic),
    );
    lambdaErrorAlarm_trackTraceEventConsumerLambda.addAlarmAction(
      new cloudwatchActions.SnsAction(errorNotificationTopic),
    );
    lambdaErrorAlarm_digitalLabelEventConsumerLambda.addAlarmAction(
      new cloudwatchActions.SnsAction(errorNotificationTopic),
    );

    const eventProcessingTopic = new sns.Topic(this, "EventProcessingTopic", {
      displayName: "Event Processing Alerts",
    });

    eventProcessingTopic.addSubscription(
      new snsSubscriptions.EmailSubscription("miguel.gustavo.gil@gmail.com"),
    );

    const eventProcessingAlarm = new cloudwatch.Alarm(
      this,
      "EventProcessingAlarm",
      {
        metric: eventManagementLambda.metricErrors(),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: "Event Management Lambda is failing!",
        actionsEnabled: true,
      },
    );

    eventProcessingAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(eventProcessingTopic),
    );

    const schemaLambda = new lambda.Function(this, "SchemaRegisterLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("dist/lambda/register-schema"),
      timeout: cdk.Duration.seconds(30),
    });

    schemaLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["schemas:CreateSchema", "schemas:CreateRegistry"],
        resources: ["*"], // TODO Adjust this for least privilege
      }),
    );

    new customResources.AwsCustomResource(this, "SchemaRegistrationResource", {
      onCreate: {
        service: "Lambda",
        action: "invoke",
        parameters: {
          FunctionName: schemaLambda.functionName,
          Payload: "{}",
        },
        physicalResourceId:
          customResources.PhysicalResourceId.of("SchemaRegistration"),
      },
      policy: customResources.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["lambda:InvokeFunction"],
          resources: [schemaLambda.functionArn],
        }),
      ]),
    });

    schemaLambda.addPermission("CustomResourceInvoke", {
      principal: new iam.ServicePrincipal("cloudformation.amazonaws.com"),
      action: "lambda:InvokeFunction",
    });

    schemaLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "schemas:ListSchemas",
          "schemas:CreateSchema",
          "schemas:DescribeSchema",
          "schemas:DeleteSchema",
          "schemas:UpdateSchema",
          "schemas:CreateRegistry",
          "schemas:DescribeRegistry",
          "schemas:ListRegistries",
        ],
        resources: ["*"], // TODO : need to evaluate least privilege access
      }),
    );

    trackTraceEventConsumerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sqs:ReceiveMessage", "sqs:DeleteMessage"],
        resources: [trackTraceEventQueue.queueArn],
      }),
    );

    digitalLabelEventConsumerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sqs:ReceiveMessage", "sqs:DeleteMessage"],
        resources: [digitalLabelEventQueue.queueArn],
      }),
    );

    const logGroup = new logs.LogGroup(this, "ApiGatewayLogGroup", {
      logGroupName: `/aws/apigateway/PostNLApiLogs`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const api = new apigateway.RestApi(this, "EventApi", {
      restApiName: "PostNL - CORE TRANSPORT LAYER - Event Management API",
      description: "API for event ingestion and querying statuses.",
      deployOptions: {
        stageName: "prod",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        tracingEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        metricsEnabled: true,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
        cachingEnabled: true,
        cacheClusterEnabled: true,
        cacheClusterSize: "1.6",
        cacheTtl: cdk.Duration.seconds(60),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Authorization", "Content-Type"],
      },
    });

    // TODO - enable authentication before final deployment
    // const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
    //   this,
    //   "CognitoAuthorizer",
    //   {
    //     cognitoUserPools: [userPool],
    //   },
    // );

    const register = api.root.addResource("register");
    register.addMethod(
      "POST",
      new apigateway.LambdaIntegration(registerLambda),
    );

    const login = api.root.addResource("login");
    login.addMethod("POST", new apigateway.LambdaIntegration(loginLambda));

    // ✅ EVENT MANAGEMENT - lets route all events through the Event Management Layer
    // TODO - enable authentication before final deployment
    const postEventProducer = api.root.addResource("eventProducer");
    postEventProducer.addMethod(
      "POST",
      new apigateway.LambdaIntegration(eventProducerLambda),
      // {
      //   authorizationType: apigateway.AuthorizationType.COGNITO,
      //   authorizer,
      // },
    );

    const postEventProducerFirstSorting = api.root.addResource(
      "eventProducerFirstSorting",
    );
    postEventProducerFirstSorting.addMethod(
      "POST",
      new apigateway.LambdaIntegration(eventProducerFirstSortingLambda),
    );

    const postEventProducerCrossDocking = api.root.addResource(
      "eventProducerCrossDocking",
    );
    postEventProducerCrossDocking.addMethod(
      "POST",
      new apigateway.LambdaIntegration(eventProducerCrossDockingLambda),
    );

    const postEventProducerSecondSorting = api.root.addResource(
      "eventProducerSecondSorting",
    );
    postEventProducerSecondSorting.addMethod(
      "POST",
      new apigateway.LambdaIntegration(eventProducerSecondSortingLambda),
    );

    const postEventProducerDistribution = api.root.addResource(
      "eventProducerDistribution",
    );
    postEventProducerDistribution.addMethod(
      "POST",
      new apigateway.LambdaIntegration(eventProducerDistributionLambda),
    );

    const postEventProducerFinalConsumer = api.root.addResource(
      "eventProducerFinalConsumer",
    );
    postEventProducerFinalConsumer.addMethod(
      "POST",
      new apigateway.LambdaIntegration(eventProducerFinalConsumerLambda),
    );

    const masterPlan = api.root.addResource("master-plan");
    masterPlan.addMethod(
      "POST",
      new apigateway.LambdaIntegration(addMasterPlanLambda),
    );

    const priorityMasterPlan = api.root.addResource("priority-master-plan");
    priorityMasterPlan.addMethod(
      "POST",
      new apigateway.LambdaIntegration(addPriorityMasterPlanLambda),
    );

    const eventsResource = api.root.addResource("events");

    const parcelEventResourceFromDB =
      eventsResource.addResource("fromDB-parcel");

    const getParcelEventResourceFromDB =
      parcelEventResourceFromDB.addResource("{eventId}");
    getParcelEventResourceFromDB.addMethod(
      "GET",
      new apigateway.LambdaIntegration(fromDynamoLambdaParcelEvent),
    );

    const trackTraceEventResource = eventsResource.addResource("track-trace");
    const getTrackTraceEventResource =
      trackTraceEventResource.addResource("{eventId}");
    getTrackTraceEventResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(trackTraceEventConsumerLambda),
    );

    const digitalLabelEventResource =
      eventsResource.addResource("digital-label");
    const getDigitalLabelEventResource =
      digitalLabelEventResource.addResource("{eventId}");
    getDigitalLabelEventResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(digitalLabelEventConsumerLambda),
    );

    const usagePlan = api.addUsagePlan("UsagePlan", {
      name: "HighTrafficUsagePlan",
      description:
        "API usage plan with rate limits for high traffic - initial values - need to be adjusted according to traffic",
      throttle: {
        rateLimit: 1000,
        burstLimit: 2000,
      },
      quota: {
        limit: 1000000,
        period: apigateway.Period.MONTH,
      },
    });

    usagePlan.addApiStage({ stage: api.deploymentStage });

    const deadLetterQueue = new sqs.Queue(this, "EventDLQ", {
      queueName: "EventDLQ",
      retentionPeriod: cdk.Duration.days(14),
    });

    const alertTopic = new sns.Topic(this, "EventAlertsTopic", {
      topicName: "EventAlerts",
    });

    alertTopic.addSubscription(
      new snsSubscriptions.EmailSubscription("miguel.gustavo.gil@gmail.com"),
    );

    const lambdaRole = new iam.Role(this, "EventLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:UpdateItem", "dynamodb:Scan", "sqs:SendMessage"],
        resources: [executionPlansTable.tableArn, deadLetterQueue.queueArn],
      }),
    );

    const eventMonitorLambda = new lambda.Function(this, "EventMonitorLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("dist/lambda/event-monitor"),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(10),
      role: lambdaRole,
      environment: {
        EXECUTION_TABLE_NAME: executionPlansTable.tableName,
        DLQ_URL: deadLetterQueue.queueUrl,
        ALERT_TOPIC_ARN: alertTopic.topicArn,
      },
    });

    const missingEventsAlarm = new cloudwatch.Alarm(
      this,
      "MissingEventsAlarm",
      {
        metric: executionPlansTable.metric("ConsumedReadCapacityUnits"),
        threshold: 10,
        evaluationPeriods: 2,
        alarmName: "MissingEventsAlarm",
        alarmDescription: "Triggers if missing events exceed threshold",
        actionsEnabled: true,
      },
    );

    missingEventsAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(alertTopic),
    );

    const rule = new eventbridge.Rule(this, "EventMonitorSchedule", {
      schedule: eventbridge.Schedule.rate(cdk.Duration.minutes(5)),
    });

    rule.addTarget(new targets.LambdaFunction(eventMonitorLambda));

    new cdk.CfnOutput(this, "ExecutionPlansTableArn", {
      value: executionPlansTable.tableArn,
    });

    new cdk.CfnOutput(this, "DLQArn", {
      value: deadLetterQueue.queueArn,
    });

    new cdk.CfnOutput(this, "EventAlertsTopicArn", {
      value: alertTopic.topicArn,
    });

    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.url,
    });
  }
}
