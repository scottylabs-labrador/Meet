import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/user/SignInButton";
import { useSession } from "@/lib/authClient";
import {
  deleteEvent,
  formatMinutes,
  getEvent,
  minuteRange,
  renameEvent,
  slotKey,
  upsertAvailability,
  withdrawAvailability,
  type EventView,
} from "@/lib/eventApi";

export const Route = createFileRoute("/events/$eventId")({
  component: EventPage,
});

function EventPage() {
  const { eventId } = Route.useParams();
  const { data: auth, isPending } = useSession();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [painted, setPainted] = useState<Set<string>>(new Set());
  const [paintMode, setPaintMode] = useState<boolean | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!auth?.user) {
      return;
    }
    void getEvent(eventId)
      .then((loaded) => {
        setEvent(loaded);
        setNameDraft(loaded.name);
        const mine = loaded.respondents.find((respondent) => respondent.userId === auth.user.id);
        setPainted(new Set(mine?.slots ?? []));
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Could not load Event");
      });
  }, [auth?.user, eventId]);

  const minutes = useMemo(
    () => (event ? minuteRange(event.dailyStartMinutes, event.dailyEndMinutes) : []),
    [event],
  );
  const heatmap = useMemo(
    () => new Map(event?.heatmap.map((entry) => [entry.slot, entry.count])),
    [event],
  );
  const maxCount = Math.max(1, ...(event?.heatmap.map((entry) => entry.count) ?? [0]));

  if (isPending) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!auth?.user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-muted-foreground">Sign in to view this Event</p>
        <SignInButton />
      </div>
    );
  }

  if (loadError) {
    return <p className="p-6 text-sm text-destructive">{loadError}</p>;
  }

  if (!event) {
    return <p className="p-6 text-sm text-muted-foreground">Loading Event…</p>;
  }

  const isOrganizer = event.organizerId === auth.user.id;
  const isRespondent = event.respondents.some((respondent) => respondent.userId === auth.user.id);

  function toggleSlot(slot: string, next?: boolean) {
    setPainted((current) => {
      const copy = new Set(current);
      const shouldPaint = next ?? !copy.has(slot);
      if (shouldPaint) {
        copy.add(slot);
      } else {
        copy.delete(slot);
      }
      return copy;
    });
  }

  async function saveAvailability() {
    setBusy(true);
    try {
      const next = await upsertAvailability(eventId, [...painted]);
      setEvent(next);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    try {
      const next = await withdrawAvailability(eventId);
      setEvent(next);
      setPainted(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    setBusy(true);
    try {
      const next = await renameEvent(eventId, nameDraft);
      setEvent(next);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteEvent(eventId);
      await navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-6 p-6"
      onMouseUp={() => setPaintMode(null)}
      onMouseLeave={() => setPaintMode(null)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-sm text-muted-foreground">Times are America/New_York (Eastern).</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(window.location.href);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy Event URL"}
        </Button>
      </div>

      {isOrganizer ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Rename
            <input
              value={nameDraft}
              onChange={(change) => setNameDraft(change.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void saveName()}>
            Save name
          </Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>
            Delete Event
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background px-2 py-1 text-left">Eastern</th>
              {event.dates.map((date) => (
                <th key={date} className="px-2 py-1 font-medium">
                  {date}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {minutes.map((minute) => (
              <tr key={minute}>
                <td className="sticky left-0 bg-background px-2 py-0.5 font-mono text-muted-foreground">
                  {formatMinutes(minute)}
                </td>
                {event.dates.map((date) => {
                  const slot = slotKey(date, minute);
                  const count = heatmap.get(slot) ?? 0;
                  const mine = painted.has(slot);
                  const intensity = count / maxCount;
                  return (
                    <td key={slot} className="p-0">
                      <button
                        type="button"
                        aria-label={`${date} ${formatMinutes(minute)}`}
                        className="h-5 w-16 border border-border"
                        style={{
                          backgroundColor: mine
                            ? "color-mix(in oklch, var(--primary) 70%, white)"
                            : `color-mix(in oklch, var(--chart-2) ${Math.round(intensity * 80)}%, white)`,
                        }}
                        onMouseDown={() => {
                          const next = !mine;
                          setPaintMode(next);
                          toggleSlot(slot, next);
                        }}
                        onMouseEnter={() => {
                          if (paintMode !== null) {
                            toggleSlot(slot, paintMode);
                          }
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void saveAvailability()}>
          Save Availability
        </Button>
        {isRespondent ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void withdraw()}>
            Withdraw
          </Button>
        ) : null}
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">Respondents</h2>
        {event.respondents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Respondents yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {event.respondents.map((respondent) => (
              <li key={respondent.userId}>
                {respondent.name} ({respondent.userId})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
