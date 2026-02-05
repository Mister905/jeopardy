import { supabase } from '../auth/supabase';

const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const API_URL = `${baseUrl}/api`;

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public error: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiError;
    const contentType = response.headers.get('content-type');
    
    // Check if response is JSON
    if (contentType && contentType.includes('application/json')) {
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          statusCode: response.status,
          message: response.statusText,
          error: 'Unknown Error',
        };
      }
    } else {
      // Response is not JSON (likely HTML error page)
      const text = await response.text();
      let message = response.statusText;
      
      // Provide helpful messages for common status codes
      if (response.status === 404) {
        message = `API endpoint not found. The backend may not be running or the endpoint doesn't exist.`;
      } else if (response.status === 500) {
        message = 'Internal server error. Please check the backend logs.';
      } else if (response.status === 503) {
        message = 'Service unavailable. The backend may not be running.';
      } else if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        message = `Backend returned HTML instead of JSON (status ${response.status}). The API endpoint may not exist or the server is returning an error page.`;
      }
      
      errorData = {
        statusCode: response.status,
        message,
        error: 'Invalid Response',
      };
    }

    throw new ApiClientError(
      errorData.statusCode,
      Array.isArray(errorData.message)
        ? errorData.message.join(', ')
        : errorData.message,
      errorData.error,
    );
  }

  // Check if successful response is JSON
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (err) {
      throw new ApiClientError(
        500,
        'Invalid JSON response from server',
        'Parse Error',
      );
    }
  } else {
    // Response is not JSON - this shouldn't happen for API calls
    const text = await response.text();
    throw new ApiClientError(
      500,
      `Server returned non-JSON response (${contentType || 'unknown type'}). Expected JSON.`,
      'Invalid Response',
    );
  }
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  try {
    const headers = await getAuthHeaders();
    const fullUrl = `${API_URL}${endpoint}`;
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
    });

    return handleResponse<T>(response);
  } catch (err) {
    // If it's already an ApiClientError from handleResponse, re-throw it
    if (err instanceof ApiClientError) {
      throw err;
    }

    // Handle network errors (backend not running, CORS, etc.)
    if (err instanceof TypeError) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      
      // TypeError with "Failed to fetch" usually means:
      // 1. Backend not running (connection refused)
      // 2. CORS blocking the request
      // 3. Network issue
      // We can't distinguish between these easily, so provide a comprehensive message
      const errorMessage = err.message || '';
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        throw new ApiClientError(
          503,
          `Cannot connect to backend API at ${apiUrl}. Possible causes: 1) Backend server is not running, 2) CORS is not enabled on the backend, 3) Network connectivity issue. Check the browser console for more details.`,
          'Service Unavailable',
        );
      }
      
      // Generic network error
      throw new ApiClientError(
        503,
        `Network error connecting to backend API at ${apiUrl}. Error: ${errorMessage}`,
        'Service Unavailable',
      );
    }
    
    // Re-throw any other errors
    throw err;
  }
}

export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
): Promise<T> {
  try {
    const headers = await getAuthHeaders();
    const fullUrl = `${API_URL}${endpoint}`;
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return handleResponse<T>(response);
  } catch (err) {
    // If it's already an ApiClientError from handleResponse, re-throw it
    if (err instanceof ApiClientError) {
      throw err;
    }

    // Handle network errors (backend not running, CORS, etc.)
    if (err instanceof TypeError) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      
      // TypeError with "Failed to fetch" usually means:
      // 1. Backend not running (connection refused)
      // 2. CORS blocking the request
      // 3. Network issue
      // We can't distinguish between these easily, so provide a comprehensive message
      const errorMessage = err.message || '';
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        throw new ApiClientError(
          503,
          `Cannot connect to backend API at ${apiUrl}. Possible causes: 1) Backend server is not running, 2) CORS is not enabled on the backend, 3) Network connectivity issue. Check the browser console for more details.`,
          'Service Unavailable',
        );
      }
      
      // Generic network error
      throw new ApiClientError(
        503,
        `Network error connecting to backend API at ${apiUrl}. Error: ${errorMessage}`,
        'Service Unavailable',
      );
    }
    
    // Re-throw any other errors
    throw err;
  }
}
