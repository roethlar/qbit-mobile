// Properly typed error types for the application

export interface ApiError {
  response?: {
    status: number;
    data?: {
      error?: string;
      message?: string;
    };
  };
  message: string;
  code?: string;
}

export interface TorrentError extends Error {
  hash?: string;
  action?: 'pause' | 'resume' | 'delete' | 'add';
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.response?.data?.error ||
           error.response?.data?.message ||
           error.message ||
           'An unknown error occurred';
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown error occurred';
}