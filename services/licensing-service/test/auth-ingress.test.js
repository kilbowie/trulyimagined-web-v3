import { describe, expect, it, vi } from 'vitest';

vi.mock('@trulyimagined/middleware', () => ({
  validateAuth0Token: vi.fn(),
}));

vi.mock('@trulyimagined/database', () => ({
  DatabaseClient: {
    getInstance: () => ({
      query: vi.fn(),
    }),
  },
  queries: {
    licensing: {
      create: '',
      getByActor: '',
      approve: '',
      reject: '',
    },
  },
}));

import { validateAuth0Token } from '@trulyimagined/middleware';
import { handler } from '../src/handler';

function makeEvent(method, path) {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: method,
    isBase64Encoded: false,
    path,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: path,
    requestContext: {},
  };
}

describe('licensing-service auth ingress', () => {
  it('returns 401 for missing or invalid auth token', async () => {
    vi.mocked(validateAuth0Token).mockResolvedValueOnce(null);

    const response = await handler(makeEvent('POST', '/v1/license/request'), {}, () => {});

    expect(response?.statusCode).toBe(401);
    expect(response?.body).toContain('Unauthorized');
  });

  it('keeps CORS preflight unauthenticated', async () => {
    const response = await handler(makeEvent('OPTIONS', '/v1/license/request'), {}, () => {});

    expect(response?.statusCode).toBe(200);
  });
});
