import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2i from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import { bedrockInvokeResources, assertModelRegionMatch } from "./bedrockResources";

export interface KakiMahjongStackProps extends cdk.StackProps {
  envName: string;
}

/**
 * Backend for the Kaki Mahjong proposal:
 *  - Cognito        -> phone-number sign-in for seniors
 *  - DynamoDB        -> live game/room state + connection lookup
 *  - API Gateway WS  -> real-time draw/discard/call events
 *  - Lambda          -> connect/disconnect/join/game-action handlers
 *  - S3 + CloudFront -> static assets and cached voice-prompt audio
 *  - Polly           -> text-to-speech narration (called from actionHandler)
 *  - CloudWatch      -> logs + an error-rate alarm on the game logic function
 */
export class KakiMahjongStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: KakiMahjongStackProps) {
    super(scope, id, props);

    const { envName } = props;

    // ---------------------------------------------------------------------
    // 1. Data layer — single DynamoDB table, on-demand billing
    //    PK/SK design:
    //      ROOM#<roomId>      / STATE                -> current game state (JSON blob)
    //      ROOM#<roomId>      / CONN#<connectionId>   -> a connected player in that room
    //      CONN#<connectionId> / CONN                 -> reverse lookup for $disconnect (GSI)
    // ---------------------------------------------------------------------
    const gameTable = new dynamodb.Table(this, "GameTable", {
      tableName: `kaki-mahjong-game-${envName}`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // student project — fine to tear down
      timeToLiveAttribute: "ttl",
    });

    // Lets $disconnect find which room a connectionId belonged to, in one query.
    gameTable.addGlobalSecondaryIndex({
      indexName: "byConnection",
      partitionKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ---------------------------------------------------------------------
    // 2. Identity — Cognito User Pool with phone-number (OTP) sign-in,
    //    the low-friction option for elderly users vs. remembering a password.
    // ---------------------------------------------------------------------
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `kaki-mahjong-users-${envName}`,
      selfSignUpEnabled: true,
      signInAliases: { phone: true },
      autoVerify: { phone: true },
      standardAttributes: {
        phoneNumber: { required: true, mutable: false },
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        // OTP-first flow; password still required by Cognito, kept simple.
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
        requireUppercase: false,
      },
      accountRecovery: cognito.AccountRecovery.PHONE_ONLY_WITHOUT_MFA,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      authFlows: { userSrp: true, custom: true },
      generateSecret: false, // mobile/web app client, not a server
    });

    // ---------------------------------------------------------------------
    // 3. Content & voice — S3 bucket behind CloudFront.
    //    Holds tile graphics/sounds (deployed separately) and Polly output
    //    audio cached under voice/ so repeated phrases aren't re-synthesized.
    // ---------------------------------------------------------------------
    const assetsBucket = new s3.Bucket(this, "AssetsBucket", {
      bucketName: `kaki-mahjong-assets-${envName}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    const distribution = new cloudfront.Distribution(this, "AssetsDistribution", {
      comment: `Kaki Mahjong assets (${envName})`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(assetsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    });

    // ---------------------------------------------------------------------
    // 4. Real-time layer — WebSocket API + Lambda handlers
    // ---------------------------------------------------------------------
    const commonEnv = {
      GAME_TABLE_NAME: gameTable.tableName,
      ASSETS_BUCKET_NAME: assetsBucket.bucketName,
      ASSETS_DOMAIN: distribution.distributionDomainName,
    };

    const nodeFnDefaults: Partial<lambdaNode.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: { minify: true, sourceMap: true },
    };

    const connectFn = new lambdaNode.NodejsFunction(this, "ConnectFn", {
      ...nodeFnDefaults,
      entry: path.join(__dirname, "..", "lambda", "connect.ts"),
    });

    const disconnectFn = new lambdaNode.NodejsFunction(this, "DisconnectFn", {
      ...nodeFnDefaults,
      entry: path.join(__dirname, "..", "lambda", "disconnect.ts"),
    });

    const joinFn = new lambdaNode.NodejsFunction(this, "JoinFn", {
      ...nodeFnDefaults,
      entry: path.join(__dirname, "..", "lambda", "join.ts"),
    });

    const actionFn = new lambdaNode.NodejsFunction(this, "ActionFn", {
      ...nodeFnDefaults,
      entry: path.join(__dirname, "..", "lambda", "gameAction.ts"),
      timeout: cdk.Duration.seconds(15), // scoring + Polly narration
    });

    // The move-advisor "chatbot": reads out opponents' discards and
    // recommends the best move (discard / chow / pong / kong / win).
    const adviseFn = new lambdaNode.NodejsFunction(this, "AdviseFn", {
      ...nodeFnDefaults,
      entry: path.join(__dirname, "..", "lambda", "advise.ts"),
      timeout: cdk.Duration.seconds(15), // shanten search + Polly narration
      memorySize: 512, // the shanten search is the most CPU-heavy handler
    });

    // The help coach's model-assisted fallback: classifies a free-text
    // question into one of coach.js's existing intent ids when the local
    // keyword patterns miss. Stateless request/response — no room, no game
    // state — so it gets a plain HTTP route below rather than a WebSocket
    // one, and it does NOT share commonEnv/nodeFnDefaults' game-table wiring.
    //
    // `us.amazon.nova-micro-v1:0` is the US cross-region inference profile
    // for Amazon Nova Micro — the cheapest/fastest Bedrock text model, and
    // in most regions now the only way to reach it (bare on-demand model
    // ids return a ValidationException). It has to match the deploy region's
    // scope: `us.` for us-*, `eu.` for eu-*, `apac.` for ap-*. Override with
    // `-c bedrockModelId=...` for a different profile or a single-region
    // model (e.g. an Anthropic Claude Haiku id) if your Bedrock access differs.
    const bedrockModelId = (this.node.tryGetContext("bedrockModelId") as string) || "us.amazon.nova-micro-v1:0";

    // Fail synth (not runtime) if a cross-region inference-profile id doesn't match the deploy
    // region — the region is independently overridable via CDK_DEFAULT_REGION, the model default
    // isn't derived from it. `bin/app.ts` always sets a concrete region; guard anyway.
    const region = this.region;
    if (!cdk.Token.isUnresolved(region)) {
      assertModelRegionMatch(region, bedrockModelId, "bedrockModelId");
    }

    // bedrock:InvokeModel resource ARNs — see backend/lib/bedrockResources.ts. Handles a plain
    // foundation-model id and the current system-defined cross-region inference-profile ids
    // (`us.` / `eu.` / `apac.` / `us-gov.` prefixes); nothing else.
    const invokeResources = (modelOrProfileId: string) =>
      bedrockInvokeResources(cdk.Aws.PARTITION, this.region, this.account, modelOrProfileId);

    // Cost guardrails: Bedrock is pay-per-call with no free tier, and this
    // route needs no credentials to hit (see the throttled HttpStage below),
    // so two independent caps bound the *rate* new Bedrock calls can be
    // made: reserved concurrency hard-stops how many invocations can ever
    // run at once (queued/throttled requests cost nothing), and the API
    // Gateway throttle below caps the request rate before it even reaches
    // Lambda. Neither is a ceiling on total spend — a caller sitting at the
    // limit continuously, forever, still accumulates unbounded cost over
    // time, just slowly. The AWS Budget below is the actual dollar-amount
    // guardrail. Both throttle numbers are intentionally conservative
    // defaults for a hackathon demo — override with `-c coachApiConcurrency=`,
    // `-c coachApiRateLimit=`, `-c coachApiBurstLimit=` if real usage needs
    // more headroom.
    //
    // `-c coachApiConcurrency=0` omits the reserved-concurrency cap entirely:
    // a restricted account (e.g. a workshop sandbox) can have a Lambda
    // concurrency limit low enough that reserving *any* leaves fewer than the
    // 10 unreserved executions AWS requires account-wide, which fails the
    // deploy. The API Gateway throttle and the Budget still bound cost.
    const coachApiConcurrency = Number(this.node.tryGetContext("coachApiConcurrency") ?? 2);
    const reservedConcurrentExecutions = coachApiConcurrency > 0 ? coachApiConcurrency : undefined;

    const classifyIntentFn = new lambdaNode.NodejsFunction(this, "ClassifyIntentFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(8),
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: { minify: true, sourceMap: true },
      entry: path.join(__dirname, "..", "lambda", "classifyIntent.ts"),
      environment: { BEDROCK_MODEL_ID: bedrockModelId },
      reservedConcurrentExecutions,
    });

    classifyIntentFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: invokeResources(bedrockModelId),
      }),
    );

    // The post-hand review agent (@kaki/agents, bundled from ../../agents). Same posture as
    // classify-intent: stateless HTTP, one Bedrock call whose output is strictly validated, any
    // failure degrading to a deterministic model-free review. Shares this route's rate caps and
    // the Budget below. `agentModelId` defaults to the same model as classify-intent; override
    // with `-c agentModelId=us.amazon.nova-lite-v1:0` (or a Claude Haiku id) if review prose
    // needs to be richer once it's been tested — match the deploy region's profile prefix.
    const agentModelId = (this.node.tryGetContext("agentModelId") as string) || bedrockModelId;
    if (!cdk.Token.isUnresolved(region)) {
      assertModelRegionMatch(region, agentModelId, "agentModelId");
    }

    const reviewHandFn = new lambdaNode.NodejsFunction(this, "ReviewHandFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(15), // one model call, then assembly; comfortably under this
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: { minify: true, sourceMap: true },
      entry: path.join(__dirname, "..", "lambda", "reviewHand.ts"),
      environment: { AGENT_MODEL_ID: agentModelId },
      reservedConcurrentExecutions,
    });

    reviewHandFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: invokeResources(agentModelId),
      }),
    );

    const httpApi = new apigwv2.HttpApi(this, "CoachApi", {
      apiName: `kaki-mahjong-coach-${envName}`,
      corsPreflight: {
        allowOrigins: ["*"], // static-site frontend + local dev; no cookies/credentials involved
        allowMethods: [apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ["content-type"],
      },
      // No default stage here — created explicitly below so it can carry a
      // throttle. This endpoint takes no credentials (see the module comment
      // on classifyIntent.ts), so request-rate throttling is the actual
      // barrier between "publicly reachable" and "unbounded Bedrock spend."
      createDefaultStage: false,
    });
    httpApi.addRoutes({
      path: "/classify-intent",
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2i.HttpLambdaIntegration("ClassifyIntentIntegration", classifyIntentFn),
    });
    httpApi.addRoutes({
      path: "/review-hand",
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2i.HttpLambdaIntegration("ReviewHandIntegration", reviewHandFn),
    });

    new apigwv2.HttpStage(this, "CoachApiDefaultStage", {
      httpApi,
      stageName: "$default", // keeps ClassifyIntentUrl's shape unchanged (no /{stage} segment)
      autoDeploy: true,
      throttle: {
        rateLimit: Number(this.node.tryGetContext("coachApiRateLimit") ?? 2), // steady-state req/s
        burstLimit: Number(this.node.tryGetContext("coachApiBurstLimit") ?? 5),
      },
    });

    // The actual dollar-amount guardrail: the throttle/concurrency above cap the *rate* of
    // Bedrock spend, not its total, so a sustained anonymous caller can still run up a real bill
    // over time. Requires a real subscriber address (AWS Budgets has no valid default), so this
    // is opt-in via context rather than a hard requirement to synth the stack at all.
    const budgetAlertEmail = this.node.tryGetContext("coachBudgetAlertEmail") as string | undefined;
    if (budgetAlertEmail) {
      new budgets.CfnBudget(this, "CoachBedrockBudget", {
        budget: {
          budgetName: `kaki-mahjong-coach-bedrock-${envName}`,
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: {
            amount: Number(this.node.tryGetContext("coachBudgetLimitUsd") ?? 20),
            unit: "USD",
          },
          costFilters: { Service: ["Amazon Bedrock"] },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              notificationType: "ACTUAL",
              comparisonOperator: "GREATER_THAN",
              threshold: 80,
              thresholdType: "PERCENTAGE",
            },
            subscribers: [{ subscriptionType: "EMAIL", address: budgetAlertEmail }],
          },
        ],
      });
    } else {
      cdk.Annotations.of(this).addWarning(
        "classify-intent is public and takes no credentials, but no coachBudgetAlertEmail context " +
          "is set, so there is no dollar-amount cost alert on its Bedrock spend — only the rate " +
          "caps above. Deploy with -c coachBudgetAlertEmail=you@example.com to add one.",
      );
    }

    const webSocketApi = new apigwv2.WebSocketApi(this, "GameSocketApi", {
      apiName: `kaki-mahjong-ws-${envName}`,
      connectRouteOptions: { integration: new apigwv2i.WebSocketLambdaIntegration("ConnectIntegration", connectFn) },
      disconnectRouteOptions: { integration: new apigwv2i.WebSocketLambdaIntegration("DisconnectIntegration", disconnectFn) },
    });

    webSocketApi.addRoute("join", {
      integration: new apigwv2i.WebSocketLambdaIntegration("JoinIntegration", joinFn),
    });
    webSocketApi.addRoute("action", {
      integration: new apigwv2i.WebSocketLambdaIntegration("ActionIntegration", actionFn),
    });
    webSocketApi.addRoute("advise", {
      integration: new apigwv2i.WebSocketLambdaIntegration("AdviseIntegration", adviseFn),
    });

    const stage = new apigwv2.WebSocketStage(this, "GameSocketStage", {
      webSocketApi,
      stageName: envName,
      autoDeploy: true,
    });

    // Handlers need to push messages back down the same socket connections.
    const connectionsArn = cdk.Stack.of(this).formatArn({
      service: "execute-api",
      resource: webSocketApi.apiId,
      resourceName: `${stage.stageName}/POST/*`,
    });
    for (const fn of [connectFn, disconnectFn, joinFn, actionFn, adviseFn]) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["execute-api:ManageConnections"],
          resources: [connectionsArn],
        }),
      );
      fn.addEnvironment("WEBSOCKET_CALLBACK_URL", stage.callbackUrl);
      gameTable.grantReadWriteData(fn);
    }

    // Only the handlers that narrate (game moves + the advisor) need Polly/S3.
    for (const fn of [actionFn, adviseFn]) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["polly:SynthesizeSpeech"],
          resources: ["*"], // Polly does not support resource-level restriction
        }),
      );
      assetsBucket.grantReadWrite(fn);
    }
    actionFn.addEnvironment("USER_POOL_ID", userPool.userPoolId);

    // ---------------------------------------------------------------------
    // 5. Monitoring — error alarm on the game-logic function
    // ---------------------------------------------------------------------
    const actionErrors = actionFn.metricErrors({ period: cdk.Duration.minutes(5) });
    new cloudwatch.Alarm(this, "ActionFnErrorAlarm", {
      alarmName: `kaki-mahjong-action-errors-${envName}`,
      metric: actionErrors,
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Both CoachApi handlers (classifyIntent.ts, reviewHand.ts) return a 5xx for a genuine
    // infrastructure failure rather than folding it into a normal 200. Each catches its own error
    // and returns a response rather than throwing, so neither trips its Lambda's error metric —
    // the 5xx only shows up on the API itself. API Gateway v2 has no per-route 5xx metric, so one
    // alarm covers the whole (small, two-route) CoachApi: any sustained 5xx here means one of the
    // model-backed routes is failing and someone should look.
    const coachApiServerErrors = httpApi.metricServerError({ period: cdk.Duration.minutes(5) });
    new cloudwatch.Alarm(this, "CoachApiServerErrorAlarm", {
      alarmName: `kaki-mahjong-coach-api-5xx-${envName}`,
      metric: coachApiServerErrors,
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ---------------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------------
    new cdk.CfnOutput(this, "WebSocketUrl", { value: stage.url });
    new cdk.CfnOutput(this, "ClassifyIntentUrl", { value: `${httpApi.apiEndpoint}/classify-intent` });
    new cdk.CfnOutput(this, "ReviewHandUrl", { value: `${httpApi.apiEndpoint}/review-hand` });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "AssetsBucketName", { value: assetsBucket.bucketName });
    new cdk.CfnOutput(this, "AssetsDomainName", { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, "GameTableName", { value: gameTable.tableName });
  }
}
