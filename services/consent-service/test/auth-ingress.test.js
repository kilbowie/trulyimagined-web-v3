import { describe, expect, it, vi } from 'vitest';

vi.mock('@trulyimagined/middleware', () => ({
  validateAuth0Token: vi.fn(),
  hasScope: vi.fn().mockReturnValue(false),
}));

import { validateAuth0Token, hasScope } from '@trulyimagined/middleware';
import { handler } from '../src/index';

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

describe('consent-service auth ingress', () => {
  it('returns 401 for missing or invalid auth token', async () => {
    vi.mocked(validateAuth0Token).mockResolvedValueOnce(null);

    const response = await handler(makeEvent('GET', '/v1/consent/check'), {}, () => {});

    expect(response?.statusCode).toBe(401);
    expect(response?.body).toContain('Unauthorized');
  });

  it('returns 403 when authenticated but missing read scope', async () => {
    vi.mocked(validateAuth0Token).mockResolvedValueOnce({ sub: 'client@clients', scopes: [] });
    vi.mocked(hasScope).mockReturnValueOnce(false);

    const response = await handler(makeEvent('GET', '/v1/consent/check'), {}, () => {});

    expect(response?.statusCode).toBe(403);
    expect(response?.body).toContain('hdicr:consent:read');
  });

  it('returns 403 when authenticated but missing write scope', async () => {
    vi.mocked(validateAuth0Token).mockResolvedValueOnce({
      sub: 'client@clients',
      scopes: ['hdicr:consent:read'],
    });
    vi.mocked(hasScope).mockReturnValueOnce(false);

    const response = await handler(makeEvent('POST', '/v1/consent/grant'), {}, () => {});

    expect(response?.statusCode).toBe(403);
    expect(response?.body).toContain('hdicr:consent:write');
  });

  it('keeps CORS preflight unauthenticated', async () => {
    const response = await handler(makeEvent('OPTIONS', '/v1/consent/check'), {}, () => {});

    expect(response?.statusCode).toBe(200);
  });
});
