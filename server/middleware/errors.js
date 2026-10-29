// One error class + one error-handling middleware = consistent JSON errors everywhere.
export class AppError extends Error {
  constructor(status, message, code = "ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.originalUrl}` } });
}

// Express 5 forwards errors from async handlers automatically, so no try/catch wrapper is needed.
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let code = err.code || "SERVER_ERROR";
  let message = err.message || "Something went wrong";

  if (err.name === "MulterError") {
    status = 400;
    code = "UPLOAD_ERROR";
    message = err.code === "LIMIT_FILE_SIZE" ? "File is too large." : err.message;
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    code = "BAD_JSON";
    message = "Request body is not valid JSON.";
  } else if (err.name === "CastError") {
    status = 400;
    code = "BAD_ID";
    message = "Invalid id format.";
  } else if (err.name === "ValidationError") {
    status = 400;
    code = "VALIDATION";
  } else if (!err.status && (err.name?.startsWith("Mongo") || err.name?.startsWith("Mongoose"))) {
    code = "DATABASE_ERROR";
    message = `Database error: ${err.message}`;
  }
  if (status >= 500) console.error(`[${code}]`, err);
  res.status(status).json({ error: { code, message } });
}
