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
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

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
    // Nova Micro: the cheapest/fastest Bedrock text model, well suited to a
    // one-word classification task. Override with `-c bedrockModelId=...`
    // (e.g. an Anthropic Claude Haiku model id) if your account's Bedrock
    // model access differs.
    const bedrockModelId = (this.node.tryGetContext("bedrockModelId") as string) || "amazon.nova-micro-v1:0";

    const classifyIntentFn = new lambdaNode.NodejsFunction(this, "ClassifyIntentFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(8),
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: { minify: true, sourceMap: true },
      entry: path.join(__dirname, "..", "lambda", "classifyIntent.ts"),
      environment: { BEDROCK_MODEL_ID: bedrockModelId },
    });

    // Bedrock foundation-model ARNs carry no account segment (they are not
    // account-owned resources), unlike every other ARN in this stack.
    const bedrockModelArn = `arn:${cdk.Aws.PARTITION}:bedrock:${this.region}::foundation-model/${bedrockModelId}`;
    classifyIntentFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [bedrockModelArn],
      }),
    );

    const httpApi = new apigwv2.HttpApi(this, "CoachApi", {
      apiName: `kaki-mahjong-coach-${envName}`,
      corsPreflight: {
        allowOrigins: ["*"], // static-site frontend + local dev; no cookies/credentials involved
        allowMethods: [apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ["content-type"],
      },
    });
    httpApi.addRoutes({
      path: "/classify-intent",
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2i.HttpLambdaIntegration("ClassifyIntentIntegration", classifyIntentFn),
    });

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

    // ---------------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------------
    new cdk.CfnOutput(this, "WebSocketUrl", { value: stage.url });
    new cdk.CfnOutput(this, "ClassifyIntentUrl", { value: `${httpApi.apiEndpoint}/classify-intent` });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "AssetsBucketName", { value: assetsBucket.bucketName });
    new cdk.CfnOutput(this, "AssetsDomainName", { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, "GameTableName", { value: gameTable.tableName });
  }
}
