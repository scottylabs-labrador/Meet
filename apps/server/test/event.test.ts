import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../src/app.ts";
import { alice, aliceAuth, bob, bobAuth, seedAlice, seedBob } from "./fixtures.ts";

const validEvent = {
  name: "Weekend hike",
  dates: ["2026-09-12", "2026-09-13"],
  dailyStartMinutes: 9 * 60,
  dailyEndMinutes: 17 * 60,
};

describe("POST /events", () => {
  it("returns 401 when a Guest creates an Event", async () => {
    const res = await request(app).post("/events").send(validEvent);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ name: "Unauthenticated" });
  });

  it("creates an Event for a signed-in User with an unguessable id", async () => {
    await seedAlice();

    const res = await request(app).post("/events").set(aliceAuth()).send(validEvent);

    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.id.length).toBeGreaterThan(1);
    expect(res.body.id).not.toBe("1");
    expect(res.body).toMatchObject({
      name: validEvent.name,
      dates: validEvent.dates,
      dailyStartMinutes: validEvent.dailyStartMinutes,
      dailyEndMinutes: validEvent.dailyEndMinutes,
    });
  });

  it("rejects an Event with no dates", async () => {
    await seedAlice();

    const res = await request(app)
      .post("/events")
      .set(aliceAuth())
      .send({ ...validEvent, dates: [] });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("rejects an Event whose daily end is not after start", async () => {
    await seedAlice();

    const res = await request(app)
      .post("/events")
      .set(aliceAuth())
      .send({ ...validEvent, dailyStartMinutes: 600, dailyEndMinutes: 600 });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("allows two Events to share a name with different ids", async () => {
    await seedAlice();

    const first = await request(app).post("/events").set(aliceAuth()).send(validEvent);
    const second = await request(app).post("/events").set(aliceAuth()).send(validEvent);

    expect([200, 201]).toContain(first.status);
    expect([200, 201]).toContain(second.status);
    expect(first.body.id).not.toBe(second.body.id);
    expect(first.body.name).toBe(validEvent.name);
    expect(second.body.name).toBe(validEvent.name);
  });
});

describe("GET /events/:eventId", () => {
  it("returns 401 when a Guest views an Event", async () => {
    const res = await request(app).get("/events/any-event-id");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ name: "Unauthenticated" });
    expect(res.body).not.toHaveProperty("dates");
    expect(res.body).not.toHaveProperty("respondents");
  });

  it("returns 404 when a signed-in User views a missing Event", async () => {
    await seedAlice();

    const res = await request(app)
      .get("/events/00000000-0000-4000-8000-000000000000")
      .set(aliceAuth());

    expect(res.status).toBe(404);
  });

  it("lets a second User read an Event by id with an empty Respondent list", async () => {
    await seedAlice();
    await seedBob();

    const created = await request(app).post("/events").set(aliceAuth()).send(validEvent);

    const res = await request(app).get(`/events/${created.body.id}`).set(bobAuth());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      name: validEvent.name,
      respondents: [],
      heatmap: [],
    });
  });

  it("shows the Organizer on the Event without creating a Respondent", async () => {
    await seedAlice();

    const created = await request(app).post("/events").set(aliceAuth()).send(validEvent);

    const res = await request(app).get(`/events/${created.body.id}`).set(aliceAuth());

    expect(res.status).toBe(200);
    expect(res.body.organizerId).toBe(alice.id);
    expect(res.body.respondents).toEqual([]);
    expect(res.body.heatmap).toEqual([]);
  });
});

describe("PUT /events/:eventId/availability", () => {
  it("upserts Availability and shows the Respondent by name and Andrew ID", async () => {
    await seedAlice();
    const created = await request(app).post("/events").set(aliceAuth()).send(validEvent);
    const slots = ["2026-09-12T09:00", "2026-09-12T09:15"];

    const res = await request(app)
      .put(`/events/${created.body.id}/availability`)
      .set(aliceAuth())
      .send({ slots });

    expect(res.status).toBe(200);
    expect(res.body.respondents).toEqual([{ userId: alice.id, name: alice.name, slots }]);
    expect(res.body.heatmap).toEqual(
      expect.arrayContaining([
        { slot: "2026-09-12T09:00", count: 1 },
        { slot: "2026-09-12T09:15", count: 1 },
      ]),
    );
  });

  it("overwrites a later save and keeps an all-unavailable Respondent", async () => {
    await seedAlice();
    const created = await request(app).post("/events").set(aliceAuth()).send(validEvent);

    await request(app)
      .put(`/events/${created.body.id}/availability`)
      .set(aliceAuth())
      .send({ slots: ["2026-09-12T09:00"] });

    const empty = await request(app)
      .put(`/events/${created.body.id}/availability`)
      .set(aliceAuth())
      .send({ slots: [] });

    expect(empty.status).toBe(200);
    expect(empty.body.respondents).toEqual([{ userId: alice.id, name: alice.name, slots: [] }]);
    expect(empty.body.heatmap).toEqual([]);
  });

  it("does not create a Respondent when a User only views", async () => {
    await seedAlice();
    await seedBob();
    const created = await request(app).post("/events").set(aliceAuth()).send(validEvent);

    await request(app)
      .put(`/events/${created.body.id}/availability`)
      .set(aliceAuth())
      .send({ slots: ["2026-09-12T09:00"] });

    const viewed = await request(app).get(`/events/${created.body.id}`).set(bobAuth());

    expect(viewed.body.respondents).toHaveLength(1);
    expect(viewed.body.respondents[0].userId).toBe(alice.id);
  });

  it("keeps two Users with the same display name on separate Availability", async () => {
    await seedAlice();
    await seedBob();
    const created = await request(app).post("/events").set(aliceAuth()).send(validEvent);

    await request(app)
      .put(`/events/${created.body.id}/availability`)
      .set(aliceAuth())
      .send({ slots: ["2026-09-12T09:00"] });
    const res = await request(app)
      .put(`/events/${created.body.id}/availability`)
      .set(bobAuth())
      .send({ slots: ["2026-09-12T09:00", "2026-09-12T09:15"] });

    expect(res.body.respondents).toHaveLength(2);
    expect(res.body.heatmap).toEqual(
      expect.arrayContaining([
        { slot: "2026-09-12T09:00", count: 2 },
        { slot: "2026-09-12T09:15", count: 1 },
      ]),
    );
  });
});

describe("PATCH /events/:eventId and DELETE /events/:eventId", () => {
  it("lets the Organizer rename and forbids a frozen window change", async () => {
    await seedAlice();
    const created = await request(app).post("/events").set(aliceAuth()).send(validEvent);

    const renamed = await request(app)
      .patch(`/events/${created.body.id}`)
      .set(aliceAuth())
      .send({ name: "Sunday hike" });

    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("Sunday hike");

    const frozen = await request(app)
      .patch(`/events/${created.body.id}`)
      .set(aliceAuth())
      .send({ name: "Sunday hike", dates: ["2026-09-20"] });

    expect(frozen.status).toBeGreaterThanOrEqual(400);
    expect(frozen.status).toBeLessThan(500);
  });

  it("forbids a non-organizer from renaming or deleting", async () => {
    await seedAlice();
    await seedBob();
    const created = await request(app).post("/events").set(aliceAuth()).send(validEvent);

    const renamed = await request(app)
      .patch(`/events/${created.body.id}`)
      .set(bobAuth())
      .send({ name: "Hijacked" });
    const deleted = await request(app).delete(`/events/${created.body.id}`).set(bobAuth());

    expect(renamed.status).toBe(403);
    expect(deleted.status).toBe(403);
  });

  it("lets the Organizer delete the Event and its Availability", async () => {
    await seedAlice();
    const created = await request(app).post("/events").set(aliceAuth()).send(validEvent);
    await request(app)
      .put(`/events/${created.body.id}/availability`)
      .set(aliceAuth())
      .send({ slots: ["2026-09-12T09:00"] });

    const deleted = await request(app).delete(`/events/${created.body.id}`).set(aliceAuth());
    const missing = await request(app).get(`/events/${created.body.id}`).set(aliceAuth());

    expect(deleted.status).toBe(204);
    expect(missing.status).toBe(404);
  });
});

describe("DELETE /events/:eventId/availability", () => {
  it("withdraws the Respondent and drops them from the heatmap", async () => {
    await seedAlice();
    await seedBob();
    const created = await request(app).post("/events").set(aliceAuth()).send(validEvent);

    await request(app)
      .put(`/events/${created.body.id}/availability`)
      .set(aliceAuth())
      .send({ slots: ["2026-09-12T09:00"] });
    await request(app)
      .put(`/events/${created.body.id}/availability`)
      .set(bobAuth())
      .send({ slots: ["2026-09-12T09:00"] });

    const withdrawn = await request(app)
      .delete(`/events/${created.body.id}/availability`)
      .set(aliceAuth());

    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.respondents).toEqual([
      { userId: bob.id, name: bob.name, slots: ["2026-09-12T09:00"] },
    ]);
    expect(withdrawn.body.heatmap).toEqual([{ slot: "2026-09-12T09:00", count: 1 }]);
  });

  it("does not let the Organizer kick another Respondent", async () => {
    await seedAlice();
    await seedBob();
    const created = await request(app).post("/events").set(aliceAuth()).send(validEvent);
    await request(app)
      .put(`/events/${created.body.id}/availability`)
      .set(bobAuth())
      .send({ slots: ["2026-09-12T09:00"] });

    const organizerWithdraw = await request(app)
      .delete(`/events/${created.body.id}/availability`)
      .set(aliceAuth());

    expect(organizerWithdraw.body.respondents).toEqual([
      { userId: bob.id, name: bob.name, slots: ["2026-09-12T09:00"] },
    ]);
  });
});
