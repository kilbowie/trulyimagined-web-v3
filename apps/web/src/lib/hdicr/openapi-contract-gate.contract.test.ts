import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type ServiceKey = 'identity' | 'consent' | 'licensing';

const SPEC_PATHS: Record<ServiceKey, string> = {
  identity: path.resolve(process.cwd(), '..', '..', 'services', 'identity-service', 'openapi.yaml'),
  consent: path.resolve(process.cwd(), '..', '..', 'services', 'consent-service', 'openapi.yaml'),
  licensing: path.resolve(
    process.cwd(),
    '..',
    '..',
    'services',
    'licensing-service',
    'openapi.yaml'
  ),
};

const CLIENT_FILES: Record<ServiceKey, string> = {
  identity: path.resolve(process.cwd(), 'src', 'lib', 'hdicr', 'identity-client.ts'),
  consent: path.resolve(process.cwd(), 'src', 'lib', 'hdicr', 'consent-client.ts'),
  licensing: path.resolve(process.cwd(), 'src', 'lib', 'hdicr', 'licensing-client.ts'),
};

const REQUIRED_SCHEMA_KEYS: Array<{ service: ServiceKey; schemaName: string; keys: string[] }> = [
  { service: 'identity', schemaName: 'ActorExistsResponse', keys: ['exists'] },
  { service: 'identity', schemaName: 'AdminUsersResponse', keys: ['users', 'total'] },
  { service: 'consent', schemaName: 'ActorContextResponse', keys: ['context'] },
  { service: 'consent', schemaName: 'ConsentCheckResponse', keys: ['isGranted', 'consent'] },
  { service: 'licensing', schemaName: 'ActorIdResponse', keys: ['actorId'] },
  {
    service: 'licensing',
    schemaName: 'ActorRequestsSummaryResponse',
    keys: ['requests', 'pendingCount'],
  },
  { service: 'licensing', schemaName: 'RequestByIdResponse', keys: ['request'] },
  { service: 'licensing', schemaName: 'ApplyDecisionResponse', keys: ['decision'] },
  {
    service: 'licensing',
    schemaName: 'ActorLicensesAndStatsResponse',
    keys: ['licenses', 'stats'],
  },
  { service: 'licensing', schemaName: 'ActiveRepresentationResponse', keys: ['active'] },
  {
    service: 'licensing',
    schemaName: 'AgentActorDataResponse',
    keys: ['licensingRequests', 'licenses'],
  },
];

function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function extractOpenApiPaths(specText: string): string[] {
  const paths: string[] = [];
  const pathRegex = /^\s{2}(\/v1\/[^\s:]+):\s*$/gm;
  let match: RegExpExecArray | null;

  while ((match = pathRegex.exec(specText)) !== null) {
    paths.push(match[1]);
  }

  return paths;
}

function extractClientPaths(clientText: string): string[] {
  const paths: string[] = [];
  const pathRegex = /path:\s*(?:`([^`]+)`|'([^']+)')/g;
  let match: RegExpExecArray | null;

  while ((match = pathRegex.exec(clientText)) !== null) {
    const raw = (match[1] || match[2] || '').trim();
    if (!raw.startsWith('/v1/')) {
      continue;
    }

    // Keep this gate scoped to SEP-020/021/022 domains.
    if (raw.startsWith('/v1/consent-ledger/')) {
      continue;
    }

    const normalized = raw
      .replace(/\$\{[^}]+\}/g, 'param')
      .split('?')[0]
      .trim();

    paths.push(normalized);
  }

  return Array.from(new Set(paths));
}

function toPathRegex(openApiPath: string): RegExp {
  const escaped = openApiPath
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function findSchemaBlock(specText: string, schemaName: string): string {
  const lines = specText.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line === `    ${schemaName}:`);
  if (startIndex < 0) {
    return '';
  }

  const block: string[] = [];
  block.push(lines[startIndex]);

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^    [A-Za-z0-9_]+:\s*$/.test(line)) {
      break;
    }
    block.push(line);
  }

  return block.join('\n');
}

describe('HDICR OpenAPI contract gate', () => {
  it('ensures all HDICR client endpoints are documented in OpenAPI specs', () => {
    const documentedByService: Record<ServiceKey, RegExp[]> = {
      identity: extractOpenApiPaths(readText(SPEC_PATHS.identity)).map(toPathRegex),
      consent: extractOpenApiPaths(readText(SPEC_PATHS.consent)).map(toPathRegex),
      licensing: extractOpenApiPaths(readText(SPEC_PATHS.licensing)).map(toPathRegex),
    };

    const missing: string[] = [];

    for (const service of Object.keys(CLIENT_FILES) as ServiceKey[]) {
      const clientPaths = extractClientPaths(readText(CLIENT_FILES[service]));
      for (const clientPath of clientPaths) {
        const matchesSpec = documentedByService[service].some((pattern) =>
          pattern.test(clientPath)
        );
        if (!matchesSpec) {
          missing.push(`${service}:${clientPath}`);
        }
      }
    }

    expect(missing, `Undocumented HDICR client endpoints: ${missing.join(', ')}`).toEqual([]);
  });

  it('ensures OpenAPI response schemas keep required fields consumed by HDICR clients', () => {
    const specByService: Record<ServiceKey, string> = {
      identity: readText(SPEC_PATHS.identity),
      consent: readText(SPEC_PATHS.consent),
      licensing: readText(SPEC_PATHS.licensing),
    };

    const missing: string[] = [];

    for (const schemaCheck of REQUIRED_SCHEMA_KEYS) {
      const specText = specByService[schemaCheck.service];
      const block = findSchemaBlock(specText, schemaCheck.schemaName);
      if (!block) {
        missing.push(`${schemaCheck.service}:${schemaCheck.schemaName} (schema missing)`);
        continue;
      }

      for (const key of schemaCheck.keys) {
        if (!block.includes(`        ${key}:`)) {
          missing.push(`${schemaCheck.service}:${schemaCheck.schemaName}.${key}`);
        }
      }
    }

    expect(missing, `Missing schema fields used by HDICR clients: ${missing.join(', ')}`).toEqual(
      []
    );
  });
});
