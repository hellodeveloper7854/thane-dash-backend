const { sendErrorEmail } = require('./emailService');

/**
 * Global error handling middleware for Express
 * Catches all errors and sends email notifications
 */
function errorHandler(err, req, res, next) {
  // Don't send emails for 404s (handled separately)
  if (err.status === 404) {
    return res.status(404).json({
      error: err.message || 'Resource not found'
    });
  }

  // Determine status code
  const statusCode = err.status || err.statusCode || 500;

  // Prepare error details
  const errorDetails = {
    endpoint: req.originalUrl || req.path,
    method: req.method,
    error: err,
    requestBody: req.body && Object.keys(req.body).length > 0 ? req.body : null,
    requestParams: req.params && Object.keys(req.params).length > 0 ? req.params : null,
    query: req.query && Object.keys(req.query).length > 0 ? req.query : null,
    timestamp: new Date().toISOString()
  };

  // Log error to console
  console.error('Error occurred:', {
    timestamp: errorDetails.timestamp,
    method: errorDetails.method,
    endpoint: errorDetails.endpoint,
    error: err.message,
    stack: err.stack
  });

  // Only send email for 5xx errors (server errors), not 4xx (client errors)
  if (statusCode >= 500) {
    // Send email notification asynchronously (don't wait for it)
    sendErrorEmail(errorDetails).catch(emailErr => {
      console.error('Failed to send error email:', emailErr);
    });
  }

  // Send error response to client
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details || null
    })
  });
}

/**
 * Wrapper for async route handlers to catch errors automatically
 * @param {Function} fn - Async route handler function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError
};
