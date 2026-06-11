import { getSystemOverviewMetrics } from '../src/pharmacy-crawler.mjs';

const result = await getSystemOverviewMetrics();
console.log(JSON.stringify(result, null, 2));
