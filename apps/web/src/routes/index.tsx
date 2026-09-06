import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/authClient";
import { createEvent } from "@/lib/eventApi";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

const HOURS = Array.from({ length: 25 }, (_, hour) => hour);

function IndexComponent() {
  const { data: auth, isPending } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [dates, setDates] = useState<string[]>([""]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (isPending) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!auth?.user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
        <p className="text-sm text-muted-foreground">Sign in to create an Event</p>
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await createEvent({
        name,
        dates: dates.filter((date) => date !== ""),
        dailyStartMinutes: startHour * 60,
        dailyEndMinutes: endHour * 60,
      });
      await navigate({ to: "/events/$eventId", params: { eventId: created.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create Event");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-lg flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Create Event</h1>
      <p className="text-sm text-muted-foreground">All times are America/New_York (Eastern).</p>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          required
          value={name}
          onChange={(change) => setName(change.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm">Dates</span>
        {dates.map((date, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="date"
              required
              value={date}
              onChange={(change) => {
                const next = [...dates];
                next[index] = change.target.value;
                setDates(next);
              }}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2"
            />
            {dates.length > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setDates(dates.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setDates([...dates, ""])}>
          Add date
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Daily start (Eastern)
          <select
            value={startHour}
            onChange={(change) => setStartHour(Number(change.target.value))}
            className="rounded-md border border-input bg-background px-3 py-2"
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Daily end (Eastern)
          <select
            value={endHour}
            onChange={(change) => setEndHour(Number(change.target.value))}
            className="rounded-md border border-input bg-background px-3 py-2"
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={saving}>
        {saving ? "Creating…" : "Create Event"}
      </Button>
    </form>
  );
}
