import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`) as any;
  error.status = 404;
  
  logger.warn(`[${req.method}] ${req.originalUrl} - Route not found`);
  
  next(error);
};
