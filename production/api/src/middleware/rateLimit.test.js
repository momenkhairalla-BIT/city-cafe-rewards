import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit, resetRateLimitBuckets } from './rateLimit.js';

function mockReq() {
  return { ip: '203.0.113.10', socket: { remoteAddress: '203.0.113.10' } };
}

describe('rateLimit middleware', () => {
  beforeEach(() => resetRateLimitBuckets());

  it('allows under max then returns 429', () => {
    const mw = rateLimit({ scope: 'unit-test', windowMs: 60_000, max: 3, code: 'RATE_LIMITED' });
    let lastStatus = 200;
    for (let i = 0; i < 4; i += 1) {
      const res = {
        statusCode: 200,
        setHeader() {},
        status(code) { this.statusCode = code; lastStatus = code; return this; },
        json() { return this; },
      };
      mw(mockReq(), res, () => {});
    }
    assert.equal(lastStatus, 429);
  });
});
