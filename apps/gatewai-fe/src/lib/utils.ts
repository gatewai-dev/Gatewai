import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function debounce<T extends (...args: unknown[]) => unknown>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;

  const invokeFunc = (): ReturnType<T> | undefined => {
    if (lastArgs !== null && lastThis !== null) {
      const result = func.apply(lastThis, lastArgs);
      lastArgs = null;
      lastThis = null;
      return result;
    }
    return undefined;
  };

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args;
    lastThis = this;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      timeout = null;
      invokeFunc();
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = null;
    lastArgs = null;
    lastThis = null;
  };

  debounced.flush = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
      return invokeFunc();
    }
    return undefined;
  };

  return debounced;
}