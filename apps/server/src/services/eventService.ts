import { availability, event, user } from "@meet/db/schema";
import { and, eq } from "drizzle-orm";

import { db } from "../lib/db.ts";
import { AuthorizationError, HttpError, NotFoundError } from "../middlewares/errorHandler.ts";

export interface CreateEventInput {
  name: string;
  dates: string[];
  dailyStartMinutes: number;
  dailyEndMinutes: number;
}

export interface RenameEventInput {
  name: string;
  dates?: string[];
  dailyStartMinutes?: number;
  dailyEndMinutes?: number;
}

export interface UpsertAvailabilityInput {
  slots: string[];
}

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

async function loadEventView(eventId: string): Promise<EventView> {
  const [found] = await db.select().from(event).where(eq(event.id, eventId));
  if (!found) {
    throw new NotFoundError("Event not found");
  }

  const rows = await db
    .select({
      userId: availability.userId,
      name: user.name,
      slots: availability.slots,
    })
    .from(availability)
    .innerJoin(user, eq(user.id, availability.userId))
    .where(eq(availability.eventId, eventId));

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const slot of row.slots) {
      counts.set(slot, (counts.get(slot) ?? 0) + 1);
    }
  }

  return {
    id: found.id,
    name: found.name,
    organizerId: found.organizerId,
    dates: found.dates,
    dailyStartMinutes: found.dailyStartMinutes,
    dailyEndMinutes: found.dailyEndMinutes,
    respondents: rows,
    heatmap: [...counts.entries()].map(([slot, count]) => ({ slot, count })),
  };
}

async function requireEvent(eventId: string) {
  const [found] = await db.select().from(event).where(eq(event.id, eventId));
  if (!found) {
    throw new NotFoundError("Event not found");
  }
  return found;
}

function assertCreatable(input: CreateEventInput) {
  if (input.name.trim() === "") {
    throw new HttpError(400, "name is required");
  }
  if (input.dates.length === 0) {
    throw new HttpError(400, "dates must not be empty");
  }
  if (input.dailyEndMinutes <= input.dailyStartMinutes) {
    throw new HttpError(400, "dailyEndMinutes must be after dailyStartMinutes");
  }
}

function assertRename(input: RenameEventInput) {
  if (
    input.dates !== undefined ||
    input.dailyStartMinutes !== undefined ||
    input.dailyEndMinutes !== undefined
  ) {
    throw new HttpError(400, "dates and daily hours cannot change after create");
  }
  if (input.name.trim() === "") {
    throw new HttpError(400, "name is required");
  }
}

function assertOrganizer(organizerId: string, userId: string) {
  if (organizerId !== userId) {
    throw new AuthorizationError("Only the Organizer can change this Event");
  }
}

export const eventService = {
  async create(organizerId: string, input: CreateEventInput): Promise<EventView> {
    assertCreatable(input);

    const now = new Date();
    const [created] = await db
      .insert(event)
      .values({
        id: crypto.randomUUID(),
        name: input.name.trim(),
        organizerId,
        dates: input.dates,
        dailyStartMinutes: input.dailyStartMinutes,
        dailyEndMinutes: input.dailyEndMinutes,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      throw new HttpError(500, "Failed to create Event");
    }

    return loadEventView(created.id);
  },

  async getById(eventId: string): Promise<EventView> {
    return loadEventView(eventId);
  },

  async rename(eventId: string, userId: string, input: RenameEventInput): Promise<EventView> {
    assertRename(input);
    const found = await requireEvent(eventId);
    assertOrganizer(found.organizerId, userId);

    await db
      .update(event)
      .set({ name: input.name.trim(), updatedAt: new Date() })
      .where(eq(event.id, eventId));

    return loadEventView(eventId);
  },

  async remove(eventId: string, userId: string): Promise<void> {
    const found = await requireEvent(eventId);
    assertOrganizer(found.organizerId, userId);
    await db.delete(event).where(eq(event.id, eventId));
  },

  async upsertAvailability(
    eventId: string,
    userId: string,
    input: UpsertAvailabilityInput,
  ): Promise<EventView> {
    await requireEvent(eventId);

    const now = new Date();
    await db
      .insert(availability)
      .values({
        id: crypto.randomUUID(),
        eventId,
        userId,
        slots: input.slots,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [availability.eventId, availability.userId],
        set: { slots: input.slots, updatedAt: now },
      });

    return loadEventView(eventId);
  },

  async withdrawAvailability(eventId: string, userId: string): Promise<EventView> {
    await requireEvent(eventId);

    await db
      .delete(availability)
      .where(and(eq(availability.eventId, eventId), eq(availability.userId, userId)));

    return loadEventView(eventId);
  },
};
