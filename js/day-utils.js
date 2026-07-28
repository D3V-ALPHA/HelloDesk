// Shared day-boundary / formatting helpers used by team-view.js and
// history.js (SRS.md §1.3, §3.1 FR-5). Day boundary is evaluated in the
// viewing browser's local time — per-user stored timezones aren't part of
// the data model, so this is an approximation of "per-user local time",
// not a literal one (known limitation, not fixed here).

const DAY_BOUNDARY_HOUR = 6;
const MS_PER_HOUR = 3600 * 1000;

export function dayBucketKey(timestamp, boundaryHour = DAY_BOUNDARY_HOUR) {
  const shifted = new Date(timestamp - boundaryHour * MS_PER_HOUR);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDayLabel(bucketKey) {
  const [y, m, d] = bucketKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatClock(timestamp) {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Turns a chronological list of status_change / working_on_update log
// entries into per-day totals + expandable available-intervals (FR-5.3).
// An interval spanning midnight is bucketed entirely under its start
// timestamp's day, matching the SRS §5.5 History example.
export function buildHistory(logEntries, { now = Date.now(), boundaryHour = DAY_BOUNDARY_HOUR } = {}) {
  const sorted = [...logEntries].sort((a, b) => a.timestamp - b.timestamp);
  const days = new Map();
  let openInterval = null;

  function ensureDay(key) {
    if (!days.has(key)) days.set(key, { totalMs: 0, intervals: [] });
    return days.get(key);
  }

  function closeInterval(end) {
    if (!openInterval) return;
    const key = dayBucketKey(openInterval.start, boundaryHour);
    const day = ensureDay(key);
    day.intervals.push({ start: openInterval.start, end, workingOnUpdates: openInterval.workingOnUpdates });
    day.totalMs += end - openInterval.start;
    openInterval = null;
  }

  for (const entry of sorted) {
    if (entry.type === "status_change") {
      if (entry.status === "available") {
        closeInterval(entry.timestamp);
        openInterval = { start: entry.timestamp, workingOnUpdates: [{ time: entry.timestamp, workingOn: entry.workingOn || "" }] };
      } else {
        closeInterval(entry.timestamp);
      }
    } else if (entry.type === "working_on_update" && openInterval) {
      openInterval.workingOnUpdates.push({ time: entry.timestamp, workingOn: entry.workingOn || "" });
    }
  }

  if (openInterval) closeInterval(now);

  return days;
}
