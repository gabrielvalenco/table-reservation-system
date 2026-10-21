import type {
  AvailabilityResponse,
  CreateReservationBody,
  ReservationResponse,
} from "@reservas/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = (data as { error?: string }).error ?? "unknown";
    throw new ApiError(response.status, code);
  }
  return data as T;
}

export function getAvailability(date: string, partySize: number) {
  const params = new URLSearchParams({ date, partySize: String(partySize) });
  return request<AvailabilityResponse>(`/api/availability?${params}`);
}

export function createReservation(body: CreateReservationBody) {
  return request<ReservationResponse>("/api/reservations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
