import { runTests } from './src/test/test.js';

// Mock localStorage for Node.js
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, value) { this.store[key] = value.toString(); },
  removeItem(key) { delete this.store[key]; }
};

runTests();
