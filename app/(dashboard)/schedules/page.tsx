'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, Bot } from 'lucide-react';
import { ConnectionStatus } from '@/components/ConnectionStatus';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COMMON_TZ = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
];

export default function SchedulesPage() {
  const [schedule, setSchedule] = useState<any>({
    enabled: false,
    startTime: '09:00',
    endTime: '18:00',
    postsPerDay: 1,
    timezone: 'UTC',
    daysOfWeek: [],
    autoPublishAll: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/posting-schedule')
      .then((r) => r.json())
      .then((j) => {
        if (j.schedule) setSchedule(j.schedule);
        // Try to default-detect timezone
        else
          setSchedule((s: any) => ({
            ...s,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          }));
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleDay(d: number) {
    setSchedule((s: any) => ({
      ...s,
      daysOfWeek: s.daysOfWeek.includes(d)
        ? s.daysOfWeek.filter((x: number) => x !== d)
        : [...s.daysOfWeek, d].sort(),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch('/api/posting-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: schedule.enabled,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          postsPerDay: Number(schedule.postsPerDay),
          timezone: schedule.timezone,
          daysOfWeek: schedule.daysOfWeek,
          autoPublishAll: schedule.autoPublishAll,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Save failed');
      setSchedule(j.schedule);
      toast.success('Schedule saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Auto-Post Scheduler</h1>
        <p className="text-sm text-gray-500">
          Pick a time range and Post Agent will generate &amp; publish posts automatically — like an
          AI agent that runs your social on autopilot.
        </p>
      </div>

      <ConnectionStatus />

      <div className="card space-y-4">
        <label className="inline-flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
          />
          <Bot size={16} /> Enable auto-posting
        </label>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Start time</label>
            <input
              type="time"
              className="input"
              value={schedule.startTime}
              onChange={(e) => setSchedule({ ...schedule, startTime: e.target.value })}
            />
          </div>
          <div>
            <label className="label">End time</label>
            <input
              type="time"
              className="input"
              value={schedule.endTime}
              onChange={(e) => setSchedule({ ...schedule, endTime: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Posts per day (1-5)</label>
            <input
              type="number"
              min={1}
              max={5}
              className="input"
              value={schedule.postsPerDay}
              onChange={(e) =>
                setSchedule({ ...schedule, postsPerDay: Math.min(5, Math.max(1, +e.target.value || 1)) })
              }
            />
          </div>
          <div>
            <label className="label">Timezone</label>
            <select
              className="input"
              value={schedule.timezone}
              onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })}
            >
              {COMMON_TZ.map((t) => (
                <option key={t}>{t}</option>
              ))}
              {/* Allow current detected tz if not in list */}
              {!COMMON_TZ.includes(schedule.timezone) && (
                <option value={schedule.timezone}>{schedule.timezone}</option>
              )}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Days of week (leave empty for every day)</label>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((d, i) => {
              const active = schedule.daysOfWeek.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={
                    'rounded-lg border px-3 py-1 text-sm ' +
                    (active
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={schedule.autoPublishAll}
            onChange={(e) => setSchedule({ ...schedule, autoPublishAll: e.target.checked })}
          />
          Auto-publish to ALL connected accounts (otherwise saves as Awaiting Approval)
        </label>

        <button onClick={save} disabled={saving} className="btn-primary">
          <Save size={16} /> {saving ? 'Saving…' : 'Save schedule'}
        </button>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          <strong>How it works:</strong> An external cron service (e.g. cron-job.org or Upstash) hits{' '}
          <code>/api/cron/run-schedules</code> every 10 minutes with{' '}
          <code>Authorization: Bearer $CRON_SECRET</code>. When the current time falls in any of your
          configured slots, a fresh post is generated &amp; published — no manual step.
        </div>
      </div>
    </div>
  );
}
