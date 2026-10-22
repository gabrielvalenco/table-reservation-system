import type {
  AvailabilityResponse,
  ConfigResponse,
  CreateReservationBody,
  CreateTableBody,
  LoginBody,
  ManagedReservation,
  ReservationResponse,
  StaffCreateReservationBody,
  StaffReservation,
  StaffTable,
  StaffUser,
  StatsResponse,
  UpdateReservationBody,
  UpdateTableBody,
} from "@reservas/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = (data as { error?: string }).error ?? "unknown";
    throw new ApiError(response.status, code);
  }
  return data as T;
}

// --- Cliente ---

export const getConfig = () => request<ConfigResponse>("/api/config");

export function getAvailability(date: string, partySize: number) {
  const params = new URLSearchParams({ date, partySize: String(partySize) });
  return request<AvailabilityResponse>(`/api/availability?${params}`);
}

export const createReservation = (body: CreateReservationBody) =>
  request<ReservationResponse>("/api/reservations", { method: "POST", body });

export const getManaged = (token: string) => request<ManagedReservation>(`/api/reservations/manage/${token}`);

export const cancelManaged = (token: string) =>
  request<{ status: "cancelled" }>(`/api/reservations/manage/${token}/cancel`, { method: "POST" });

// --- Equipe ---

export const login = (body: LoginBody) => request<StaffUser>("/api/auth/login", { method: "POST", body });
export const logout = () => request<void>("/api/auth/logout", { method: "POST" });
export const getMe = () => request<StaffUser>("/api/auth/me");

export function listReservations(filter: { date?: string; status?: string; q?: string }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) if (value) params.set(key, value);
  return request<StaffReservation[]>(`/api/staff/reservations?${params}`);
}

export const createStaffReservation = (body: StaffCreateReservationBody) =>
  request<StaffReservation>("/api/staff/reservations", { method: "POST", body });

export const updateReservation = (id: string, body: UpdateReservationBody) =>
  request<StaffReservation>(`/api/staff/reservations/${id}`, { method: "PATCH", body });

export const listTables = () => request<StaffTable[]>("/api/staff/tables");

export const createTable = (body: CreateTableBody) =>
  request<StaffTable>("/api/staff/tables", { method: "POST", body });

export const updateTable = (id: number, body: UpdateTableBody) =>
  request<{ table: StaffTable; affectedReservations: StaffReservation[] }>(`/api/staff/tables/${id}`, {
    method: "PATCH",
    body,
  });

export const getStats = (days: number) => request<StatsResponse>(`/api/staff/stats?days=${days}`);
