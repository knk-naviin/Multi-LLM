export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`/api/proxy${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network failure";
    throw new ApiError(`Failed to fetch backend (${reason})`, 0);
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false) {
    const msg = payload?.error || payload?.detail || `Request failed with status ${response.status}`;
    throw new ApiError(msg, response.status);
  }

  return payload as T;
}
