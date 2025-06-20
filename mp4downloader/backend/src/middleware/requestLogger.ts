import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Skip logging for health checks
  if (req.path === '/health') {
    return next();
  }

  const start = Date.now();
  const { method, originalUrl, ip, body } = req;
  
  // Log request start
  logger.debug(`[${method}] ${originalUrl} - Request started`, {
    ip,
    headers: req.headers,
    query: req.query,
    ...(process.env.LOG_HTTP_BODY === 'true' && { body })
  });

  // Capture response finish event
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    logger.debug(`[${method}] ${originalUrl} - ${statusCode} (${duration}ms)`, {
      statusCode,
      duration: `${duration}ms`,
      ...(res.getHeaders()['content-length'] && { 
        contentLength: res.getHeaders()['content-length'] 
      })
    });
  });

  next();
};
