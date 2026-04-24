const API_URL = import.meta.env.VITE_API_URL;
console.log("Using API URL:", API_URL);
function buildUrl(path: string): string {
  return `${API_URL}${path}`;
}

async function parseErrorMessage(
  res: Response,
  fallbackMessage: string,
): Promise<string> {
  const err = await res.json().catch(() => ({}));
  return err.detail || fallbackMessage;
}

function toNetworkError(err: unknown): Error {
  if (err instanceof TypeError) {
    return new Error(
      "Network/certificate error while contacting backend. Check your VITE_API_URL value and backend certificate.",
    );
  }
  return err instanceof Error ? err : new Error("Request failed");
}

export interface User {
  user_id: number;
  email: string;
  name: string;
}

export interface PredictionDetail {
  label: string;
  score: number;
}

export interface PredictionResult {
  label: string;
  confidence: number;
  details: PredictionDetail[];
  recommendations: string[];
  model_ready: boolean;
}

export interface HistoryItem {
  id: number;
  label: string;
  confidence: number;
  details: PredictionDetail[];
  recommendations: string[];
  image_name: string;
  created_at: string;
}

let authToken: string | null = localStorage.getItem("gg_token");
let currentUser: User | null = JSON.parse(
  localStorage.getItem("gg_user") || "null",
);

export function getToken(): string | null {
  return authToken;
}

export function getUser(): User | null {
  return currentUser;
}

function setAuth(token: string | null, user: User | null): void {
  authToken = token;
  currentUser = user;
  if (token) {
    localStorage.setItem("gg_token", token);
    localStorage.setItem("gg_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("gg_token");
    localStorage.removeItem("gg_user");
  }
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<void> {
  try {
    const res = await fetch(buildUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Registration failed"));
    }

    const data = await res.json();
    setAuth(data.token, {
      user_id: data.user_id,
      email: data.email,
      name: data.name,
    });
  } catch (err) {
    throw toNetworkError(err);
  }
}

export async function login(email: string, password: string): Promise<void> {
  try {
    const res = await fetch(buildUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Login failed"));
    }

    const data = await res.json();
    setAuth(data.token, {
      user_id: data.user_id,
      email: data.email,
      name: data.name,
    });
  } catch (err) {
    throw toNetworkError(err);
  }
}

export function logout(): void {
  setAuth(null, null);
}

export async function predict(
  files: File[],
  token: string | null = getToken(),
): Promise<PredictionResult[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(buildUrl("/predict"), {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Prediction failed"));
    }

    const results = await res.json();
    return Array.isArray(results) ? results : [results];
  } catch (err) {
    throw toNetworkError(err);
  }
}

export async function getHistory(
  token: string | null = getToken(),
): Promise<HistoryItem[]> {
  try {
    const res = await fetch(buildUrl("/api/history"), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error("Failed to fetch history");
    }

    return res.json();
  } catch (err) {
    throw toNetworkError(err);
  }
}

export async function deleteHistoryItem(
  predId: number,
  token: string | null = getToken(),
): Promise<void> {
  try {
    const res = await fetch(buildUrl(`/api/history/${predId}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error("Failed to delete");
    }
  } catch (err) {
    throw toNetworkError(err);
  }
}

export async function getHealthStatus(): Promise<{ status: string }> {
  try {
    const res = await fetch(buildUrl("/health"));
    if (!res.ok) throw new Error("Backend unavailable");
    return res.json();
  } catch (err) {
    throw toNetworkError(err);
  }
}
