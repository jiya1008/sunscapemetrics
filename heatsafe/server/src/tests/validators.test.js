import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoord, parsePercent, isValidObjectId } from '../utils/validators.js';

describe('validators', () => {
  it('parseCoord accepts valid latitude', () => {
    const r = parseCoord(18.5, -90, 90, 'Latitude');
    assert.equal(r.ok, true);
    assert.equal(r.value, 18.5);
  });

  it('parseCoord rejects out of range', () => {
    const r = parseCoord(100, -90, 90, 'Latitude');
    assert.equal(r.ok, false);
  });

  it('parsePercent validates 0-100', () => {
    assert.equal(parsePercent(50, 'Shade').ok, true);
    assert.equal(parsePercent(101, 'Shade').ok, false);
  });

  it('isValidObjectId checks id format', () => {
    assert.equal(isValidObjectId('507f1f77bcf86cd799439011'), true);
    assert.equal(isValidObjectId('not-an-id'), false);
  });
});
