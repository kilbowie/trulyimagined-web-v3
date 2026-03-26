#!/usr/bin/env node

/**
 * AWS MCP Server Script
 * 
 * This script initializes the AWS MCP server for Claude Desktop integration.
 * It provides read-only access to AWS resources for infrastructure monitoring.
 * 
 * Usage:
 *   node aws-mcp-server.js
 * 
 * Environment Variables Required:
 *   - AWS_ACCESS_KEY_ID: IAM user access key
 *   - AWS_SECRET_ACCESS_KEY: IAM user secret key  
 *   - AWS_REGION: AWS region (default: us-east-1)
 * 
 * @see aws-iam-policy.json for required IAM permissions
 * @see aws-mcp-config.json for server configuration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// AWS SDK v3 imports
import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import { LambdaClient, ListFunctionsCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { S3Client, ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import {
  SecretsManagerClient,
  ListSecretsCommand,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from '@aws-sdk/client-cost-explorer';

// Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const config = {
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
};

// AWS Clients
const rdsClient = new RDSClient(config);
const lambdaClient = new LambdaClient(config);
const s3Client = new S3Client(config);
const secretsClient = new SecretsManagerClient(config);
const logsClient = new CloudWatchLogsClient(config);
const costClient = new CostExplorerClient(config);

// Create MCP server
const server = new Server(
  {
    name: 'trulyimagined-aws-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'describe_rds_instances',
        description: 'List and describe RDS database instances',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Optional: specific instance ID to describe',
            },
          },
        },
      },
      {
        name: 'list_lambda_functions',
        description: 'List Lambda functions with basic info',
        inputSchema: {
          type: 'object',
          properties: {
            functionName: {
              type: 'string',
              description: 'Optional: specific function name to get details',
            },
          },
        },
      },
      {
        name: 'list_s3_buckets',
        description: 'List S3 buckets and their contents',
        inputSchema: {
          type: 'object',
          properties: {
            bucketName: {
              type: 'string',
              description: 'Optional: specific bucket to list objects from',
            },
            prefix: {
              type: 'string',
              description: 'Optional: prefix to filter objects (e.g., /headshots)',
            },
          },
        },
      },
      {
        name: 'list_secrets',
        description: 'List secrets in AWS Secrets Manager',
        inputSchema: {
          type: 'object',
          properties: {
            prefix: {
              type: 'string',
              description: 'Optional: filter by prefix (e.g., trulyimagined/)',
            },
          },
        },
      },
      {
        name: 'get_secret_value',
        description: 'Retrieve a specific secret value',
        inputSchema: {
          type: 'object',
          properties: {
            secretId: {
              type: 'string',
              description: 'Secret ID or ARN',
            },
          },
          required: ['secretId'],
        },
      },
      {
        name: 'search_cloudwatch_logs',
        description: 'Search CloudWatch logs for Lambda functions',
        inputSchema: {
          type: 'object',
          properties: {
            logGroupName: {
              type: 'string',
              description: 'Log group name (e.g., /aws/lambda/identity-service)',
            },
            filterPattern: {
              type: 'string',
              description: 'Search pattern (e.g., ERROR, Exception)',
            },
            hours: {
              type: 'number',
              description: 'Hours to look back (default: 1)',
              default: 1,
            },
          },
          required: ['logGroupName'],
        },
      },
      {
        name: 'get_aws_costs',
        description: 'Get AWS cost and usage data',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Number of days to retrieve (default: 30)',
              default: 30,
            },
            granularity: {
              type: 'string',
              enum: ['DAILY', 'MONTHLY'],
              description: 'Cost granularity',
              default: 'DAILY',
            },
          },
        },
      },
    ],
  };
});

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'describe_rds_instances': {
        const command = new DescribeDBInstancesCommand({
          DBInstanceIdentifier: args.instanceId,
        });
        const response = await rdsClient.send(command);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.DBInstances, null, 2),
            },
          ],
        };
      }

      case 'list_lambda_functions': {
        if (args.functionName) {
          const command = new GetFunctionCommand({
            FunctionName: args.functionName,
          });
          const response = await lambdaClient.send(command);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        } else {
          const command = new ListFunctionsCommand({});
          const response = await lambdaClient.send(command);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.Functions, null, 2),
              },
            ],
          };
        }
      }

      case 'list_s3_buckets': {
        if (args.bucketName) {
          const command = new ListObjectsV2Command({
            Bucket: args.bucketName,
            Prefix: args.prefix,
          });
          const response = await s3Client.send(command);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.Contents, null, 2),
              },
            ],
          };
        } else {
          const command = new ListBucketsCommand({});
          const response = await s3Client.send(command);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.Buckets, null, 2),
              },
            ],
          };
        }
      }

      case 'list_secrets': {
        const command = new ListSecretsCommand({
          Filters: args.prefix
            ? [
                {
                  Key: 'name',
                  Values: [args.prefix],
                },
              ]
            : undefined,
        });
        const response = await secretsClient.send(command);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.SecretList, null, 2),
            },
          ],
        };
      }

      case 'get_secret_value': {
        const command = new GetSecretValueCommand({
          SecretId: args.secretId,
        });
        const response = await secretsClient.send(command);
        return {
          content: [
            {
              type: 'text',
              text: response.SecretString || 'Binary secret (not displayed)',
            },
          ],
        };
      }

      case 'search_cloudwatch_logs': {
        const hours = args.hours || 1;
        const startTime = Date.now() - hours * 60 * 60 * 1000;
        const command = new FilterLogEventsCommand({
          logGroupName: args.logGroupName,
          filterPattern: args.filterPattern,
          startTime,
          endTime: Date.now(),
        });
        const response = await logsClient.send(command);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.events, null, 2),
            },
          ],
        };
      }

      case 'get_aws_costs': {
        const days = args.days || 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const command = new GetCostAndUsageCommand({
          TimePeriod: {
            Start: startDate.toISOString().split('T')[0],
            End: endDate.toISOString().split('T')[0],
          },
          Granularity: args.granularity || 'DAILY',
          Metrics: ['UnblendedCost'],
          GroupBy: [
            {
              Type: 'DIMENSION',
              Key: 'SERVICE',
            },
          ],
        });
        const response = await costClient.send(command);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.ResultsByTime, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AWS MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
