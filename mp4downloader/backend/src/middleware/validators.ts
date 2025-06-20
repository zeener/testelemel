import { body, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const validateStartDownload = [
  body('urls')
    .isArray({ min: 1 })
    .withMessage('At least one URL is required')
    .custom((urls: string[]) => {
      const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?$/;
      return urls.every(url => urlPattern.test(url));
    })
    .withMessage('One or more URLs are invalid'),
  body('quality')
    .isNumeric()
    .withMessage('Quality must be a number')
    .custom((value) => {
      const numericValue = Number(value);
      return numericValue === 0 || (numericValue >= 96 && numericValue <= 320);
    })
    .withMessage('Quality must be 0 (best) or between 96 and 320 kbps'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed', { errors: errors.array() });
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }
    next();
  }
];
