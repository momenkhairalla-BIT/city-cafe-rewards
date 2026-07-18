import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toSen, fromSen, mulQtySen, percentOfSen, formatSen, subSen, minSen,
} from './money.js';

describe('money utility (integer sen)', () => {
  it('RM12.90 × 3 is exact', () => {
    const unit = toSen('12.90');
    assert.equal(unit, 1290);
    const line = mulQtySen(unit, 3);
    assert.equal(line, 3870);
    assert.equal(formatSen(line), '38.70');
    assert.equal(fromSen(line), 38.7);
  });

  it('percentage discount rounding boundaries (half-up)', () => {
    // 10% of 38.70 = 3.87
    assert.equal(percentOfSen(3870, 10), 387);
    // 10% of 0.05 = 0.005 → 0.01 half-up
    assert.equal(percentOfSen(5, 10), 1);
    // 10% of 0.04 = 0.004 → 0.00
    assert.equal(percentOfSen(4, 10), 0);
  });

  it('discount never exceeds subtotal', () => {
    const sub = toSen(10);
    const disc = minSen(toSen(15), sub);
    assert.equal(disc, 1000);
    assert.equal(subSen(sub, disc), 0);
  });

  it('rejects unsafe float path for known trap (still stable via toSen)', () => {
    // 0.1 + 0.2 classic — we bind via fixed strings
    assert.equal(toSen((0.1 + 0.2).toFixed(2)), 30);
  });
});
