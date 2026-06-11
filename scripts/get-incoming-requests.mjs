import { getIncomingRequests } from '../src/pharmacy-crawler.mjs';

const result = await getIncomingRequests();
console.log(JSON.stringify(result, null, 2));
