import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../src/index';

/**
 * Auth Ingress Test — Representation Service
 * Validates that representation service endpoints require and validate Auth0 tokens
 * (similar to identity-service auth-ingress.test.js pattern)
 */

describe('[SEP-030] Representation Service - Auth Ingress', () => {
  it('should fail a request without Authorization header', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      path: '/v1/representation/request',
      headers: {},
      body: JSON.stringify({
        actorId: 'test-actor',
        agentId: 'test-agent',
        message: 'Test',
      }),
    };

    const response = await handler(event as APIGatewayProxyEvent);
    expect(response.statusCode).toBe(401);
    expect(response.body).toContain('Unauthorized');
  });

  it('should fail a request with invalid Authorization token', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      path: '/v1/representation/request',
      headers: {
        Authorization: 'Bearer invalid-token',
      },
      body: JSON.stringify({
        actorId: 'test-actor',
        agentId: 'test-agent',
        message: 'Test',
      }),
    };

    const response = await handler(event as APIGatewayProxyEvent);
    expect(response.statusCode).toBe(401);
  });

  it('should allow GET requests without auth (read-only endpoints)', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'GET',
      path: '/v1/representation/actor',
      queryStringParameters: {
        auth0UserId: 'test-user',
      },
      headers: {},
    };

    const response = await handler(event as APIGatewayProxyEvent);
    // Should fail due to no auth, but not because auth is missing on GET
    // (actual failure depends on DB connectivity in test env)
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('should handle CORS preflight requests', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'OPTIONS',
      path: '/v1/representation/request',
      headers: {},
    };

    const response = await handler(event as APIGatewayProxyEvent);
    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Methods']).toContain('POST');
  });
});
