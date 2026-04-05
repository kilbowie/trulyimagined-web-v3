type HdicrDomain = 'consent' | 'licensing' | 'identity' | 'credentials';
type AdapterMode = 'local' | 'remote';

const warnedDomains = new Set<string>();

function normalizeMode(value: string | undefined): AdapterMode {
  return value?.toLowerCase() === 'remote' ? 'remote' : 'local';
}

export function getHdicrAdapterMode(domain: HdicrDomain): AdapterMode {
  const domainKey = `HDICR_${domain.toUpperCase()}_ADAPTER_MODE`;
  const globalMode = normalizeMode(process.env.HDICR_ADAPTER_MODE);
  const domainMode = normalizeMode(process.env[domainKey]);

  return domainMode === 'remote' ? 'remote' : globalMode;
}

export function getHdicrRemoteBaseUrl(): string | null {
  const baseUrl = process.env.HDICR_REMOTE_BASE_URL?.trim();
  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/+$/, '');
}

export function warnIfRemoteModeEnabled(domain: HdicrDomain) {
  const mode = getHdicrAdapterMode(domain);
  if (mode !== 'remote') {
    return;
  }

  const warningKey = `${domain}:${mode}`;
  if (warnedDomains.has(warningKey)) {
    return;
  }

  warnedDomains.add(warningKey);

  const baseUrl = getHdicrRemoteBaseUrl();
  if (!baseUrl) {
    console.warn(
      `[HDICR] ${domain} adapter is set to remote mode without HDICR_REMOTE_BASE_URL. Falling back to local adapter implementation.`
    );
    return;
  }

  console.warn(
    `[HDICR] ${domain} adapter is configured for remote mode (${baseUrl}) but is currently using local fallback implementation.`
  );
}
