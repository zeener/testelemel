import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiRouter } from './routes/api';
import { logger, stream } from './utils/logger';

// Load environment variables from .env file
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Request logging
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
});

// Apply rate limiting to all API routes
app.use('/api', limiter);

// API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optionally exit with a non-zero code
  // process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Optionally exit with a non-zero code
  // process.exit(1);
});

// Handle process termination
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    }
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force close the server after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server
console.log('Starting server...');
console.log('Process ID:', process.pid);

// Create a simple HTTP server
const server = app.listen(Number(PORT), '0.0.0.0', () => {
  const address = server.address();
  const actualPort = typeof address === 'string' ? PORT : address?.port;
  console.log(`Server is running on http://localhost:${actualPort}`);
  console.log('Server started successfully at', new Date().toISOString());
  
  // Log all active handles to debug
  console.log('Server started at', new Date().toISOString());
});

// Keep the process alive
const keepAlive = setInterval(() => {
  console.log('Keep-alive ping at', new Date().toISOString());
}, 1000 * 30); // Log every 30 seconds to keep the process alive

// Clean up on server close
server.on('close', () => {
  console.log('Server is closing at', new Date().toISOString());
  clearInterval(keepAlive);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error event at', new Date().toISOString(), ':', error);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error event:', error);
});

// Handle uncaught exceptions (only one handler)
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit immediately, allow the server to handle existing connections
  // process.exit(1);
});

// Handle unhandled promise rejections (only one handler)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately, allow the server to handle existing connections
  // process.exit(1);
});

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Keep the process alive by keeping stdin open
if (process.platform === 'win32') {
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.on('SIGINT', function() {
    process.emit('SIGINT');
  });
}

export default app;
