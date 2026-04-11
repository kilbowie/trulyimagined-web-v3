type HdicrDomain =
  | 'consent'
  | 'licensing'
  | 'identity'
  | 'credentials'
  | 'representation'
  | 'usage'
  | 'billing'
  | 'payments';
type AdapterMode = 'local' | 'remote';

const warnedDomains = new Set<string>();

function normalizeMode(value: string | undefined): AdapterMode | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'local' || normalized === 'remote') {
    return normalized;
  }

  return null;
}

function warnOnce(key: string, message: string) {
  if (warnedDomains.has(key)) {
    return;
  }

  warnedDomains.add(key);
  console.warn(message);
}

export function getHdicrAdapterMode(domain: HdicrDomain): AdapterMode {
  const domainKey = `HDICR_${domain.toUpperCase()}_ADAPTER_MODE`;
  const domainModeRaw = process.env[domainKey];
  const globalModeRaw = process.env.HDICR_ADAPTER_MODE;
  const domainMode = normalizeMode(domainModeRaw);
  const globalMode = normalizeMode(globalModeRaw);
  const isProduction = process.env.NODE_ENV === 'production';

  if (domainModeRaw && !domainMode) {
    const message =
      `[HDICR] ${domainKey} has invalid value "${domainModeRaw}". ` +
      'Expected "local" or "remote".';
    if (isProduction) {
      throw new Error(message);
    }
    warnOnce(`${domain}:invalid-domain`, `${message} Defaulting to local in non-production.`);
  }

  if (globalModeRaw && !globalMode) {
    const message =
      `[HDICR] HDICR_ADAPTER_MODE has invalid value "${globalModeRaw}". ` +
      'Expected "local" or "remote".';
    if (isProduction) {
      throw new Error(message);
    }
    warnOnce(`${domain}:invalid-global`, `${message} Defaulting to local in non-production.`);
  }

  if (domainMode) {
    if (isProduction && domainMode !== 'remote') {
      throw new Error(`[HDICR] ${domainKey}=local is not allowed in production. Set to "remote".`);
    }
    return domainMode;
  }

  if (globalMode) {
    if (isProduction && globalMode !== 'remote') {
      throw new Error(
        '[HDICR] HDICR_ADAPTER_MODE=local is not allowed in production. Set to "remote".'
      );
    }
    return globalMode;
  }

  const missingModeMessage =
    `[HDICR] ${domainKey} and HDICR_ADAPTER_MODE are not set. ` +
    `Set HDICR_ADAPTER_MODE=remote for production.`;

  if (isProduction) {
    throw new Error(missingModeMessage);
  }

  warnOnce(
    `${domain}:missing-mode`,
    `${missingModeMessage} Defaulting to local mode in non-production.`
  );

  return 'local';
}

export function getHdicrRemoteBaseUrl(): string | null {
  const baseUrl = process.env.HDICR_API_URL?.trim() || process.env.HDICR_REMOTE_BASE_URL?.trim();
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
      `[HDICR] ${domain} adapter is set to remote mode without HDICR_API_URL (or legacy HDICR_REMOTE_BASE_URL). Remote operations should fail closed.`
    );
    return;
  }

  console.warn(`[HDICR] ${domain} adapter is configured for remote mode (${baseUrl}).`);
}
