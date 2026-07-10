import { describe, it, expect } from 'vitest';
import { ApiError, isComputing, isDisabled } from './apiClient';
import { computingMessage, retryAfterLabel, retryAfterSeconds } from './apiStates';

//Error→state classification for the build-ahead surfaces (deep-audit B3): a 202
//"computing" gate is a HEALTHY state and must never be classified — or worded —
//as an outage. These pin the classification predicates and the copy builders the
//tables branch on (Patches / Items / Heroes / Leaderboard).

const err202 = (body?: string) =>
  new ApiError(202, 'https://api.test/patches/x', '202 Accepted for /patches/x', body);

describe('error→state classification (isComputing / isDisabled)', () => {
  it('classifies 202 as computing', () => {
    expect(isComputing(err202())).toBe(true);
  });
  it('classifies 501 as disabled, not computing', () => {
    const err = new ApiError(501, 'https://api.test/x', '501');
    expect(isDisabled(err)).toBe(true);
    expect(isComputing(err)).toBe(false);
  });
  it('does NOT classify real failures as computing — 5xx and network(0) stay "offline"', () => {
    expect(isComputing(new ApiError(500, 'https://api.test/x', '500'))).toBe(false);
    expect(isComputing(new ApiError(0, 'https://api.test/x', 'Network request failed'))).toBe(false);
  });
  it('rejects non-ApiError values (plain errors, null, undefined)', () => {
    expect(isComputing(new Error('boom'))).toBe(false);
    expect(isComputing(null)).toBe(false);
    expect(isComputing(undefined)).toBe(false);
  });
});

describe('retryAfterSeconds', () => {
  it('parses retry_after out of the 202 body', () => {
    expect(retryAfterSeconds(err202('{"status":"computing","retry_after":7200}'))).toBe(7200);
  });
  it('returns null for a missing / empty / malformed body', () => {
    expect(retryAfterSeconds(err202())).toBeNull();
    expect(retryAfterSeconds(err202(''))).toBeNull();
    expect(retryAfterSeconds(err202('<html>not json</html>'))).toBeNull();
  });
  it('returns null for a non-numeric or non-positive retry_after', () => {
    expect(retryAfterSeconds(err202('{"retry_after":"soon"}'))).toBeNull();
    expect(retryAfterSeconds(err202('{"retry_after":0}'))).toBeNull();
    expect(retryAfterSeconds(err202('{"retry_after":-5}'))).toBeNull();
  });
  it('returns null for non-ApiError inputs', () => {
    expect(retryAfterSeconds(new Error('boom'))).toBeNull();
    expect(retryAfterSeconds(undefined)).toBeNull();
  });
});

describe('retryAfterLabel', () => {
  it('labels seconds / minutes / hours coarsely', () => {
    expect(retryAfterLabel(45)).toBe('~45 sec');
    expect(retryAfterLabel(1800)).toBe('~30 min');
    expect(retryAfterLabel(7200)).toBe('~2 h');
    expect(retryAfterLabel(86400)).toBe('~24 h');
  });
  it('returns null for null / non-positive input', () => {
    expect(retryAfterLabel(null)).toBeNull();
    expect(retryAfterLabel(0)).toBeNull();
    expect(retryAfterLabel(-10)).toBeNull();
  });
});

describe('computingMessage', () => {
  it('surfaces retry_after when the 202 body carries one', () => {
    expect(computingMessage('patch hero stats are being generated', err202('{"status":"computing","retry_after":7200}'))).toBe(
      'Computing now — patch hero stats are being generated. Check back in ~2 h.',
    );
  });
  it('falls back to "shortly" when there is no retry hint', () => {
    expect(computingMessage('patch hero stats are being generated', err202())).toBe(
      'Computing now — patch hero stats are being generated. Check back shortly.',
    );
    expect(computingMessage('item win-rates are being generated')).toBe(
      'Computing now — item win-rates are being generated. Check back shortly.',
    );
  });
});
