import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHdicrAdapterMode, getHdicrRemoteBaseUrl } from './flags';

describe('hdicr flags', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

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

  it('defaults to local for unknown values in non-production with warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env = { ...process.env, NODE_ENV: 'development' };
    process.env.HDICR_ADAPTER_MODE = 'invalid';
    delete process.env.HDICR_IDENTITY_ADAPTER_MODE;

    expect(getHdicrAdapterMode('identity')).toBe('local');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('throws in production when mode is missing', () => {
    process.env = { ...process.env, NODE_ENV: 'production' };
    delete process.env.HDICR_ADAPTER_MODE;
    delete process.env.HDICR_IDENTITY_ADAPTER_MODE;

    expect(() => getHdicrAdapterMode('identity')).toThrow(/are not set/i);
  });

  it('throws in production when mode value is invalid', () => {
    process.env = { ...process.env, NODE_ENV: 'production' };
    process.env.HDICR_ADAPTER_MODE = 'remote';
    process.env.HDICR_IDENTITY_ADAPTER_MODE = 'sometimes';

    expect(() => getHdicrAdapterMode('identity')).toThrow(/invalid value/i);
  });

  it('throws in production when mode is local', () => {
    process.env = { ...process.env, NODE_ENV: 'production' };
    process.env.HDICR_ADAPTER_MODE = 'local';
    delete process.env.HDICR_IDENTITY_ADAPTER_MODE;

    expect(() => getHdicrAdapterMode('identity')).toThrow(/not allowed in production/i);
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
