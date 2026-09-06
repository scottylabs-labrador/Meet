import { env } from "@/env.ts";

export interface EventRespondent {
  userId: string;
  name: string;
  slots: string[];
}

export interface EventHeatmapEntry {
  slot: string;
  count: number;
}

export interface EventView {
  id: string;
  name: string;
  organizerId: string;
  dates: string[];
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  respondents: EventRespondent[];
  heatmap: EventHeatmapEntry[];
}

export interface CreateEventInput {
  name: string;
  dates: string[];
  dailyStartMinutes: number;
  dailyEndMinutes: number;
}

async function requestEvent<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${env.VITE_SERVER_URL}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: string }).message)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export function createEvent(input: CreateEventInput) {
  return requestEvent<EventView>("/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getEvent(eventId: string) {
  return requestEvent<EventView>(`/events/${eventId}`);
}

export function renameEvent(eventId: string, name: string) {
  return requestEvent<EventView>(`/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteEvent(eventId: string) {
  return requestEvent<void>(`/events/${eventId}`, { method: "DELETE" });
}

export function upsertAvailability(eventId: string, slots: string[]) {
  return requestEvent<EventView>(`/events/${eventId}/availability`, {
    method: "PUT",
    body: JSON.stringify({ slots }),
  });
}

export function withdrawAvailability(eventId: string) {
  return requestEvent<EventView>(`/events/${eventId}/availability`, { method: "DELETE" });
}

export function slotKey(date: string, minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");
  return `${date}T${hours}:${mins}`;
}

export function formatMinutes(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

export function minuteRange(start: number, end: number): number[] {
  const minutes: number[] = [];
  for (let value = start; value < end; value += 15) {
    minutes.push(value);
  }
  return minutes;
}
