import winston, { format, createLogger } from "winston";
import "winston-daily-rotate-file";
import path from "path";

export type LogLevel =
  | "error"
  | "warn"
  | "info"
  | "http"
  | "verbose"
  | "debug"
  | "silly";

export interface LogContext {
  [key: string]: unknown;
}

const logsDir = path.join(process.cwd(), "logs");

const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, "application-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
  zippedArchive: true,
});

const errorFileRotateTransport = new winston.transports.DailyRotateFile({
  level: "error",
  filename: path.join(logsDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
  zippedArchive: true,
});

const winstonLogger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: "dev-connect" },
  transports: [
    // Console transport with colorized output
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf((info) => {
          const context = info.context
            ? `\n${JSON.stringify(info.context, null, 2)}`
            : "";
          return `${info.timestamp} ${info.level}: ${info.message}${context}`;
        })
      ),
    }),
    // Only add file transports if enabled in environment
    ...(process.env.LOG_TO_FILE === "true"
      ? [fileRotateTransport, errorFileRotateTransport]
      : []),
  ],
});

const logger = {
  error: (message: string, context?: LogContext): void => {
    winstonLogger.error(message, { context });
  },
  warn: (message: string, context?: LogContext): void => {
    winstonLogger.warn(message, { context });
  },
  info: (message: string, context?: LogContext): void => {
    winstonLogger.info(message, { context });
  },
  http: (message: string, context?: LogContext): void => {
    winstonLogger.http(message, { context });
  },
  verbose: (message: string, context?: LogContext): void => {
    winstonLogger.verbose(message, { context });
  },
  debug: (message: string, context?: LogContext): void => {
    winstonLogger.debug(message, { context });
  },
  silly: (message: string, context?: LogContext): void => {
    winstonLogger.silly(message, { context });
  },
};

export default logger;
