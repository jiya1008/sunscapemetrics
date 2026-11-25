import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';
import { connectDB } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

describe('API integration (requires MongoDB)', { skip: !process.env.MONGODB_URI }, () => {
  before(async () => {
    await connectDB(process.env.MONGODB_URI);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  it('GET /api/health returns connected database', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.database, 'connected');
  });

  it('GET /api/dashboard/summary returns counts after seed', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.totalSites >= 1);
    assert.ok(res.body.data.totalAssessments >= 1);
  });

  it('GET /api/assessments returns scored records sorted by risk', async () => {
    const res = await request(app).get('/api/assessments?limit=5');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    if (res.body.data.length >= 2) {
      assert.ok(res.body.data[0].riskScore >= res.body.data[1].riskScore);
    }
  });

  it('GET /api/weather/current without key responds gracefully', async () => {
    const prev = process.env.OPENWEATHER_API_KEY;
    delete process.env.OPENWEATHER_API_KEY;
    const res = await request(app).get('/api/weather/current?lat=18.52&lon=73.85');
    process.env.OPENWEATHER_API_KEY = prev;
    assert.equal(res.status, 200);
    assert.equal(res.body.data.configured, false);
  });
});
