import type { Logger } from 'pino';

export * from './useDeployedSbtContext';

/**
 * 创建一个简单的日志工具，符合 Logger 接口
 */
export const useLogger = (prefix: string): Logger => {
  return {
    info: (message: string, ...args: any[]) => console.info(`[${prefix}] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[${prefix}] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[${prefix}] ${message}`, ...args),
    debug: (message: string, ...args: any[]) => console.debug(`[${prefix}] ${message}`, ...args),
    trace: (message: string | object, ...args: any[]) => console.trace(`[${prefix}]`, message, ...args),
    level: 'info',
    fatal: (message: string, ...args: any[]) => console.error(`[${prefix}] FATAL: ${message}`, ...args),
    silent: () => {},
    child: () => useLogger(`${prefix}:child`)
  } as unknown as Logger;
};
