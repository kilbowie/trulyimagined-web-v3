#!/usr/bin/env node

/**
 * Vercel MCP Server Script
 *
 * This script initializes the Vercel MCP server for Claude Desktop integration.
 * It provides deployment automation and monitoring capabilities.
 *
 * Usage:
 *   node vercel-mcp-server.js
 *
 * Environment Variables Required:
 *   - VERCEL_TOKEN: Vercel API token (scoped to project)
 *   - VERCEL_PROJECT_ID: Project ID (optional, for default project)
 *   - VERCEL_TEAM_ID: Team ID (optional, for team projects)
 *
 * @see vercel-mcp-config.json for server configuration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN!;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_API_BASE = 'https://api.vercel.com';

// Helper function to make Vercel API requests
async function vercelRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = new URL(endpoint, VERCEL_API_BASE);
  if (VERCEL_TEAM_ID) {
    url.searchParams.set('teamId', VERCEL_TEAM_ID);
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vercel API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Create MCP server
const server = new Server(
  {
    name: 'trulyimagined-vercel-mcp',
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
        name: 'list_deployments',
        description: 'List deployments for a project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID (uses default if not specified)',
            },
            limit: {
              type: 'number',
              description: 'Number of deployments to return (default: 20)',
              default: 20,
            },
            state: {
              type: 'string',
              enum: ['BUILDING', 'ERROR', 'INITIALIZING', 'QUEUED', 'READY', 'CANCELED'],
              description: 'Filter by deployment state',
            },
          },
        },
      },
      {
        name: 'get_deployment',
        description: 'Get details of a specific deployment',
        inputSchema: {
          type: 'object',
          properties: {
            deploymentId: {
              type: 'string',
              description: 'Deployment ID or URL',
            },
          },
          required: ['deploymentId'],
        },
      },
      {
        name: 'create_deployment',
        description: 'Create a new deployment',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID (uses default if not specified)',
            },
            gitSource: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['github', 'gitlab', 'bitbucket'],
                  default: 'github',
                },
                ref: {
                  type: 'string',
                  description: 'Git branch or commit SHA',
                },
              },
            },
            target: {
              type: 'string',
              enum: ['production', 'preview'],
              description: 'Deployment target environment',
              default: 'preview',
            },
          },
        },
      },
      {
        name: 'cancel_deployment',
        description: 'Cancel a deployment in progress',
        inputSchema: {
          type: 'object',
          properties: {
            deploymentId: {
              type: 'string',
              description: 'Deployment ID to cancel',
            },
          },
          required: ['deploymentId'],
        },
      },
      {
        name: 'list_env_vars',
        description: 'List environment variables for a project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID (uses default if not specified)',
            },
          },
        },
      },
      {
        name: 'create_env_var',
        description: 'Create or update an environment variable',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID (uses default if not specified)',
            },
            key: {
              type: 'string',
              description: 'Variable name',
            },
            value: {
              type: 'string',
              description: 'Variable value',
            },
            target: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['production', 'preview', 'development'],
              },
              description: 'Target environments',
            },
          },
          required: ['key', 'value', 'target'],
        },
      },
      {
        name: 'get_project_domains',
        description: 'List domains configured for a project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID (uses default if not specified)',
            },
          },
        },
      },
      {
        name: 'get_web_vitals',
        description: 'Get Web Vitals metrics for a project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID (uses default if not specified)',
            },
            period: {
              type: 'string',
              enum: ['1h', '24h', '7d', '30d'],
              description: 'Time period for metrics',
              default: '24h',
            },
          },
        },
      },
      {
        name: 'get_deployment_logs',
        description: 'Get build or runtime logs for a deployment',
        inputSchema: {
          type: 'object',
          properties: {
            deploymentId: {
              type: 'string',
              description: 'Deployment ID',
            },
            type: {
              type: 'string',
              enum: ['build', 'runtime'],
              description: 'Log type',
              default: 'build',
            },
          },
          required: ['deploymentId'],
        },
      },
    ],
  };
});

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const projectId = args.projectId || VERCEL_PROJECT_ID;

  try {
    switch (name) {
      case 'list_deployments': {
        const params = new URLSearchParams({
          limit: String(args.limit || 20),
          ...(args.state && { state: args.state }),
        });
        const data = await vercelRequest(`/v6/deployments?${params}&projectId=${projectId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data.deployments, null, 2),
            },
          ],
        };
      }

      case 'get_deployment': {
        const data = await vercelRequest(`/v13/deployments/${args.deploymentId}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'create_deployment': {
        const body: any = {
          name: projectId,
          target: args.target || 'preview',
        };

        if (args.gitSource) {
          body.gitSource = {
            type: args.gitSource.type || 'github',
            ref: args.gitSource.ref,
          };
        }

        const data = await vercelRequest(`/v13/deployments`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'cancel_deployment': {
        const data = await vercelRequest(`/v12/deployments/${args.deploymentId}/cancel`, {
          method: 'PATCH',
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'list_env_vars': {
        const data = await vercelRequest(`/v9/projects/${projectId}/env`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data.envs, null, 2),
            },
          ],
        };
      }

      case 'create_env_var': {
        const body = {
          key: args.key,
          value: args.value,
          target: args.target,
          type: 'encrypted',
        };
        const data = await vercelRequest(`/v10/projects/${projectId}/env`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'get_project_domains': {
        const data = await vercelRequest(`/v9/projects/${projectId}/domains`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data.domains, null, 2),
            },
          ],
        };
      }

      case 'get_web_vitals': {
        const data = await vercelRequest(
          `/v1/analytics/web-vitals?projectId=${projectId}&period=${args.period || '24h'}`
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'get_deployment_logs': {
        const logType = args.type || 'build';
        const data = await vercelRequest(
          `/v2/deployments/${args.deploymentId}/events?${logType}=1`
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
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
  console.error('Vercel MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
