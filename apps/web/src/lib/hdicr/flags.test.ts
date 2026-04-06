import { describe, expect, it } from 'vitest';
import { getHdicrAdapterMode, getHdicrRemoteBaseUrl } from './flags';

describe('hdicr flags', () => {
  it('uses global mode when no domain override is set', () => {
    process.env.HDICR_ADAPTER_MODE = 'remote';
    delete process.env.HDICR_CREDENTIALS_ADAPTER_MODE;

    expect(getHdicrAdapterMode('credentials')).toBe('remote');
  });

  it('uses domain override when set to remote', () => {
    process.env.HDICR_ADAPTER_MODE = 'local';
    process.env.HDICR_CREDENTIALS_ADAPTER_MODE = 'remote';

    expect(getHdicrAdapterMode('credentials')).toBe('remote');
  });

  it('defaults to local for unknown values', () => {
    process.env.HDICR_ADAPTER_MODE = 'invalid';
    delete process.env.HDICR_IDENTITY_ADAPTER_MODE;

    expect(getHdicrAdapterMode('identity')).toBe('local');
  });

  it('returns trimmed remote base url without trailing slash', () => {
    process.env.HDICR_REMOTE_BASE_URL = 'https://hdicr.example.com///';

    expect(getHdicrRemoteBaseUrl()).toBe('https://hdicr.example.com');
  });

  it('returns null when remote base url is not set', () => {
    delete process.env.HDICR_REMOTE_BASE_URL;

    expect(getHdicrRemoteBaseUrl()).toBeNull();
  });
});
