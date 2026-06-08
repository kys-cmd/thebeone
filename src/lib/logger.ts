import { toast } from 'sonner';

export interface ErrorLog {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  type: 'runtime' | 'promise' | 'manual';
  additionalInfo?: string;
}

const STORAGE_KEY = 'beone_cms_error_logs';
const MAX_LOGS = 100;

export const logger = {
  getLogs(): ErrorLog[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load error logs from localStorage:', e);
      return [];
    }
  },

  saveLogs(logs: ErrorLog[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
    } catch (e) {
      console.error('Failed to save error logs to localStorage:', e);
    }
  },

  log(message: string, error?: any, type: 'runtime' | 'promise' | 'manual' = 'manual', additionalInfo?: string) {
    // Gracefully ignore normal Supabase lifecycle refresh token messages
    const messageStr = String(message || '');
    const errorStr = error ? String(error.message || error) : '';
    const infoStr = String(additionalInfo || '');
    const isRefreshTokenError = 
      messageStr.includes('Refresh Token Not Found') || 
      messageStr.includes('Invalid Refresh Token') ||
      errorStr.includes('Refresh Token Not Found') ||
      errorStr.includes('Invalid Refresh Token') ||
      infoStr.includes('Refresh Token Not Found') ||
      infoStr.includes('Invalid Refresh Token');

    if (isRefreshTokenError) {
      return;
    }

    const logs = this.getLogs();
    
    // Extract message and stack trace safely
    let errMessage = message;
    let errStack = '';
    
    if (error) {
      if (error instanceof Error) {
        errMessage = error.message || message;
        errStack = error.stack || '';
      } else if (typeof error === 'object') {
        try {
          errMessage = error.message || JSON.stringify(error);
          errStack = error.stack || '';
        } catch {
          errMessage = String(error);
        }
      } else {
        errMessage = String(error);
      }
    }

    const newLog: ErrorLog = {
      id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      message: errMessage,
      stack: errStack || new Error().stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      type,
      additionalInfo
    };

    const updatedLogs = [newLog, ...logs].slice(0, MAX_LOGS);
    this.saveLogs(updatedLogs);
    
    // Trigger custom event so reactive UI can update in real-time if open
    window.dispatchEvent(new CustomEvent('beone-new-error-log', { detail: newLog }));
  },

  clearLogs() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('beone-new-error-log'));
    } catch (e) {
      console.error('Failed to clear error logs:', e);
    }
  },

  // Initialize listeners for unhandled errors
  init() {
    if (typeof window === 'undefined') return;

    // Prevent duplicate initializations
    if ((window as any).__BEONE_LOGGER_INITIALIZED__) return;
    (window as any).__BEONE_LOGGER_INITIALIZED__ = true;

    // 1. Unhandled JS Errors
    window.addEventListener('error', (event) => {
      // Ignore resource loading errors (images, stylesheets, scripts, sourcemaps) - target will be an HTMLElement/element
      if (event.target && event.target !== window) {
        return;
      }

      const msg = event.message || '';
      // Ignore normal react dev-server socket failure, token refreshes or normal iframe cross-origin warnings
      if (
        msg.includes('ResizeObserver') || 
        msg.toLowerCase().includes('websocket') || 
        msg.toLowerCase().includes('hmr') ||
        msg.includes('WebSocket closed without opened') ||
        msg.includes('Refresh Token Not Found') ||
        msg.includes('Invalid Refresh Token')
      ) {
        return;
      }
      this.log(msg || 'Unhandled runtime error', event.error, 'runtime');
    });

    // 2. Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      let msg = 'Unhandled Promise Rejection';
      if (reason && typeof reason === 'object') {
        msg = reason.message || JSON.stringify(reason);
      } else if (reason) {
        msg = String(reason);
      }
      
      // Filter out dynamic import failures and user auth expiration events
      if (
        msg.includes('Failed to fetch dynamically imported module') || 
        msg.toLowerCase().includes('websocket') ||
        msg.toLowerCase().includes('hmr') ||
        msg.includes('WebSocket closed without opened') ||
        msg.includes('Refresh Token Not Found') ||
        msg.includes('Invalid Refresh Token')
      ) {
        return;
      }

      this.log(msg, reason, 'promise');
    });

    console.log('[System Logger] Global exception tracking initialized successfully.');
  }
};
