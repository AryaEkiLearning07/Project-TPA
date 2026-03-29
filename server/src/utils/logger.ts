/**
 * Simple logger utility for the server
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;

  constructor() {
    // Set log level based on NODE_ENV
    const nodeEnv = process.env.NODE_ENV || 'development';
    this.level = nodeEnv === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  }

  private log(level: LogLevel, tag: string, ...args: unknown[]): void {
    if (level < this.level) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelTag = this.getLevelTag(level);
    const message = args.map((arg) => {
      if (arg instanceof Error) {
        return arg.message;
      }
      return String(arg);
    }).join(' ');

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`[${timestamp}] [DEBUG] [${tag}]`, ...args);
        break;
      case LogLevel.INFO:
        console.log(`[${timestamp}] [INFO] [${tag}]`, message);
        break;
      case LogLevel.WARN:
        console.warn(`[${timestamp}] [WARN] [${tag}]`, message);
        break;
      case LogLevel.ERROR:
        console.error(`[${timestamp}] [ERROR] [${tag}]`, ...args);
        break;
    }
  }

  private getLevelTag(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG';
      case LogLevel.INFO:
        return 'INFO';
      case LogLevel.WARN:
        return 'WARN';
      case LogLevel.ERROR:
        return 'ERROR';
    }
  }

  debug(tag: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, tag, ...args);
  }

  info(tag: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, tag, ...args);
  }

  warn(tag: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, tag, ...args);
  }

  error(tag: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, tag, ...args);
  }
}

// Singleton instance
const logger = new Logger();

export default logger;
