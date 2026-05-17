import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import type { Upload, UploadsResponse, User } from './types';
import { isoMonth } from './utils/date';
import { Login } from './components/Login';
import { Header } from './components/Header';
import { Calendar } from './components/Calendar';
import { UploadModal } from './components/UploadModal';
import { DayPopover } from './components/DayPopover';

function currentMonth(): string {
  return isoMonth(new Date());
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function readMonthFromHash(): string {
  const h = window.location.hash.replace(/^#/, '');
  return /^\d{4}-\d{2}$/.test(h) ? h : currentMonth();
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [uploads, setUploads] = useState<UploadsResponse>({ kia: [], mohamad: [] });
  const [month, setMonth] = useState<string>(readMonthFromHash());
  const [showModal, setShowModal] = useState(false);
  const [popover, setPopover] = useState<{ user: User; date: string; items: Upload[] } | null>(null);

  async function refresh() {
    try {
      const data = await api.list();
      setUploads(data);
      setAuthed(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthed(false);
      } else {
        console.error(err);
      }
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    window.location.hash = month;
  }, [month]);

  useEffect(() => {
    function onHash() { setMonth(readMonthFromHash()); }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (authed === null) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--color-muted)]">Loading…</div>;
  }

  if (!authed) {
    return <Login onSuccess={refresh} />;
  }

  return (
    <div className="min-h-screen">
      <Header
        uploads={uploads}
        month={month}
        onPrevMonth={() => setMonth(shiftMonth(month, -1))}
        onNextMonth={() => setMonth(shiftMonth(month, 1))}
        onAdd={() => setShowModal(true)}
      />
      <main className="max-w-6xl mx-auto p-4 grid gap-4 md:grid-cols-2">
        <Calendar
          user="kia"
          uploads={uploads.kia}
          month={month}
          onDayClick={(date, items) => setPopover({ user: 'kia', date, items })}
        />
        <Calendar
          user="mohamad"
          uploads={uploads.mohamad}
          month={month}
          onDayClick={(date, items) => setPopover({ user: 'mohamad', date, items })}
        />
      </main>

      {showModal && (
        <UploadModal
          onClose={() => setShowModal(false)}
          onCreated={refresh}
        />
      )}

      {popover && (
        <DayPopover
          date={popover.date}
          user={popover.user}
          items={popover.items}
          onClose={() => setPopover(null)}
          onChanged={() => {
            refresh();
            setPopover(null);
          }}
        />
      )}
    </div>
  );
}
