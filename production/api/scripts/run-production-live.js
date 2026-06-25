process.env.TEST_BASE_URL = process.env.TEST_BASE_URL || 'https://city-cafe-rewards.onrender.com';
await import('./test-production.js');
