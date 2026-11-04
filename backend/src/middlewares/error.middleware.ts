import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Safe server-side error logging
  const safeMessage = err?.message || 'Unknown error occurred';
  console.error('[API Error]:', safeMessage);

  const statusCode =
    typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode <= 599
      ? err.statusCode
      : 500;

  // Return safe, consistent error messages without exposing internals or stack traces
  const clientMessage =
    statusCode >= 500 ? 'Internal Enterprise Server Error' : safeMessage;

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
  });
};
