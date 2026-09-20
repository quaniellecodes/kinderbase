'use client';

import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { Card, Button } from '@/components/ui';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

function monthStartStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export function ReportsClient() {
  const [from, setFrom] = useState(weekAgoStr());
  const [to, setTo] = useState(todayStr());
  const [loading, setLoading] = useState<string | null>(null);

  async function download(url: string, key: string) {
    setLoading(key);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? 'report.pdf';
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Attendance Report */}
      <Card>
        <div className="flex items-start gap-3 mb-4">
          <FileText className="w-5 h-5 text-brand mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">Staff Attendance Report</p>
            <p className="text-xs text-gray-400 mt-0.5">Clock-in / clock-out records with total hours per staff member</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={e => setFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To</label>
            <input
              type="date"
              value={to}
              min={from}
              max={todayStr()}
              onChange={e => setTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setFrom(weekAgoStr()); setTo(todayStr()); }}
              className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-300 transition-colors"
            >
              This week
            </button>
            <button
              onClick={() => { setFrom(monthStartStr()); setTo(todayStr()); }}
              className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-300 transition-colors"
            >
              This month
            </button>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={() => download(`/api/reports/attendance?from=${from}&to=${to}`, 'attendance')}
          disabled={loading === 'attendance'}
          className="mt-4 gap-2"
        >
          <Download className="w-4 h-4" />
          {loading === 'attendance' ? 'Generating…' : 'Download PDF'}
        </Button>
      </Card>

      {/* Credentials Report */}
      <Card>
        <div className="flex items-start gap-3 mb-4">
          <FileText className="w-5 h-5 text-brand mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">Staff Credentials Report</p>
            <p className="text-xs text-gray-400 mt-0.5">All staff certifications and training records with expiry status</p>
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={() => download('/api/reports/credentials', 'credentials')}
          disabled={loading === 'credentials'}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          {loading === 'credentials' ? 'Generating…' : 'Download PDF'}
        </Button>
      </Card>
    </div>
  );
}
