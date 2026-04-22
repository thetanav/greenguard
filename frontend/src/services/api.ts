const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface User {
  user_id: number;
  email: string;
  name: string;
}

interface PredictionDetail {
  label: string;
  score: number;
}

interface PredictionResult {
  label: string;
  confidence: number;
  details: PredictionDetail[];
  recommendations: string[];
  model_ready: boolean;
}

interface HistoryItem {
  id: number;
  label: string;
  confidence: number;
  details: PredictionDetail[];
  recommendations: string[];
  image_name: string;
  created_at: string;
}

let authToken: string | null = localStorage.getItem("gg_token");
let currentUser: User | null = JSON.parse(localStorage.getItem("gg_user") || "null");

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

export async function register(email: string, password: string, name: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Registration failed");
  }

  const data = await res.json();
  setAuth(data.token, { user_id: data.user_id, email: data.email, name: data.name });
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed");
  }

  const data = await res.json();
  setAuth(data.token, { user_id: data.user_id, email: data.email, name: data.name });
}

export function logout(): void {
  setAuth(null, null);
}

export async function predict(files: File[], token: string | null = getToken()): Promise<PredictionResult[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Prediction failed");
  }

  const results = await res.json();
  return Array.isArray(results) ? results : [results];
}

export async function getHistory(token: string | null = getToken()): Promise<HistoryItem[]> {
  const res = await fetch(`${API_URL}/api/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch history");
  }

  return res.json();
}

export async function deleteHistoryItem(predId: number, token: string | null = getToken()): Promise<void> {
  const res = await fetch(`${API_URL}/api/history/${predId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Failed to delete");
  }
}

export async function getHealthStatus(): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error("Backend unavailable");
  return res.json();
}