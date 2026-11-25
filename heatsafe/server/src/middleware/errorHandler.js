export function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  const payload = {
    success: false,
    message: err.message || 'Internal server error',
  };
  if (err.errors) payload.errors = err.errors;
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }
  res.status(status).json(payload);
}

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
