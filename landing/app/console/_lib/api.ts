import type { ApiError, ApiState, HealthResponse, SimulationRequest, SimulationResponse } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_SETPOINT_API ?? "http://localhost:8081";

const REQUEST_TIMEOUT_MS = 5_000;

const withTimeout = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const parseError = async (res: Response): Promise<string> => {
  try {
    const data = (await res.json()) as Partial<ApiError>;
    if (data && typeof data.error === "string") return data.error;
    if (data && typeof data.detail === "string") return data.detail;
  } catch {
    // ignore
  }
  return res.statusText || `Request failed with status ${res.status}`;
};

export interface FetchResult<T> {
  data: T | null;
  state: ApiState;
  error: string | null;
}

const isHealthResponse = (raw: unknown): raw is HealthResponse => {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return (
    r.status === "ok" &&
    r.service === "setpoint-api" &&
    typeof r.version === "string" &&
    typeof r.timestamp === "string" &&
    typeof r.kubeClientLoaded === "boolean" &&
    (r.mode === "demo-ready" || r.mode === "demo-fallback")
  );
};

export const fetchHealth = async (): Promise<FetchResult<HealthResponse>> => {
  try {
    const res = await withTimeout(`${API_BASE}/api/health`);
    if (!res.ok) {
      return { data: null, state: "error", error: await parseError(res) };
    }
    const raw = (await res.json()) as unknown;
    if (!isHealthResponse(raw)) {
      return { data: null, state: "error", error: "Malformed /api/health payload" };
    }
    return { data: raw, state: "live", error: null };
  } catch (err) {
    return { data: null, state: "demo", error: null };
  }
};

export const fetchPlcs = async (): Promise<FetchResult<unknown[]>> => {
  try {
    const res = await withTimeout(`${API_BASE}/api/plcs`);
    if (!res.ok) {
      return { data: null, state: "error", error: await parseError(res) };
    }
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) {
      return { data: null, state: "error", error: "Malformed /api/plcs payload" };
    }
    if (raw.length === 0) {
      return { data: [], state: "empty", error: null };
    }
    return { data: raw, state: "live", error: null };
  } catch (err) {
    return { data: null, state: "demo", error: null };
  }
};

export const triggerSync = async (
  namespace: string,
  name: string,
): Promise<FetchResult<{ status: string; message: string }>> => {
  try {
    const res = await withTimeout(
      `${API_BASE}/api/plcs/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/sync`,
      { method: "POST" },
    );
    if (!res.ok) {
      return { data: null, state: "error", error: await parseError(res) };
    }
    const raw = (await res.json()) as { status?: string; message?: string };
    return {
      data: { status: raw.status ?? "success", message: raw.message ?? "Sync requested" },
      state: "live",
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      state: "error",
      error: err instanceof Error ? err.message : "Sync request failed",
    };
  }
};

export const postSimulation = async (
  body: SimulationRequest,
): Promise<FetchResult<SimulationResponse>> => {
  try {
    const res = await withTimeout(`${API_BASE}/api/simulate-policy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { data: null, state: "error", error: await parseError(res) };
    }
    const raw = (await res.json()) as Partial<SimulationResponse>;
    if (!raw || typeof raw.verdict !== "string") {
      return { data: null, state: "error", error: "Malformed /api/simulate-policy payload" };
    }
    return {
      data: {
        verdict: raw.verdict,
        action: raw.action ?? "",
        reason: raw.reason ?? "",
        risk: raw.risk ?? "Low",
      },
      state: "live",
      error: null,
    };
  } catch (err) {
    return { data: null, state: "demo", error: null };
  }
};
