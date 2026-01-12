import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ZodError } from 'zod';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error(err);

  // Zod Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 'fail',
      message: 'Validation Error',
      errors: (err as any).errors,
    });
  }


  // Cast Error (Mongoose) - e.g. Invalid ID
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    return res.status(400).json({ status: 'fail', message });
  }

  // Duplicate Key Error
  if (err.code === 11000) {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return res.status(400).json({ status: 'fail', message });
  }

  // Custom App Handling
  if (err instanceof AppError) {
      return res.status(err.statusCode).json({
          status: err.status,
          message: err.message
      });
  }

  // Generic 500
  res.status(500).json({
    status: 'error',
    message: 'Something went very wrong!',
  });
};

export default errorHandler;
