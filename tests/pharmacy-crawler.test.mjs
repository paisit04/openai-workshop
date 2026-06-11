import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { parseSystemOverviewMetrics } from '../src/pharmacy-crawler.mjs';

const metricEnvNames = [
  'PHARMACY_LABEL_DISPENSED',
  'PHARMACY_LABEL_LOW_STOCK',
  'PHARMACY_LABEL_PENDING',
  'PHARMACY_LABEL_EXPIRING',
];

afterEach(() => {
  for (const envName of metricEnvNames) {
    delete process.env[envName];
  }
});

describe('parseSystemOverviewMetrics', () => {
  it('reads system overview metrics from default labels', () => {
    const text = `
      System Overview
      Dispensed (30 Days)
      1,234 prescriptions
      Low Stock Alerts
      5 active alerts
      Pending Requests
      17 waiting
      Expiring < 90 Days
      8 items
    `;

    assert.deepEqual(parseSystemOverviewMetrics(text), {
      dispensed30Days: 1234,
      lowStockAlerts: 5,
      pendingRequests: 17,
      expiringUnder90Days: 8,
    });
  });

  it('uses label overrides from the environment', () => {
    process.env.PHARMACY_LABEL_DISPENSED = 'Issued Recently';
    process.env.PHARMACY_LABEL_LOW_STOCK = 'Stock Warnings';
    process.env.PHARMACY_LABEL_PENDING = 'Open Requisitions';
    process.env.PHARMACY_LABEL_EXPIRING = 'Soon To Expire';

    const text = `
      Issued Recently: 20
      Stock Warnings: 3
      Open Requisitions: 14
      Soon To Expire: 9
    `;

    assert.deepEqual(parseSystemOverviewMetrics(text), {
      dispensed30Days: 20,
      lowStockAlerts: 3,
      pendingRequests: 14,
      expiringUnder90Days: 9,
    });
  });

  it('throws when an expected metric label is missing', () => {
    assert.throws(
      () => parseSystemOverviewMetrics('System Overview Pending Requests 2'),
      /Could not find metric value for label: Dispensed \(30 Days\)/,
    );
  });
});
