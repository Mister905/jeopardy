import { supabase } from '../auth/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        statusCode: response.status,
        message: response.statusText,
        error: 'Unknown Error',
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

  return response.json();
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers,
  });

  return handleResponse<T>(response);
}

export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return handleResponse<T>(response);
}
