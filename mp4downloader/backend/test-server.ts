#!/usr/bin/env -S node --no-warnings --loader ts-node/esm

import express from 'express';

console.log('Starting test server...');
const app = express();
const PORT = 3002; // Use a different port to avoid conflicts

app.get('/', (req, res) => {
  res.send('Test server is running!');
});

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server is running on http://localhost:${PORT}`);
  console.log('Test server started successfully at', new Date().toISOString());
});

// Keep the process alive
const keepAlive = setInterval(() => {
  console.log('Test server keep-alive at', new Date().toISOString());
}, 10000); // Log every 10 seconds

// Handle server errors
server.on('error', (error) => {
  console.error('Test server error:', error);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down test server...');
  clearInterval(keepAlive);
  server.close(() => {
    console.log('Test server closed');
    process.exit(0);
  });
});

console.log('Test server initialization complete');
