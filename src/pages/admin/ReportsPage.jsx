import { useState } from 'react';
import { Check, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAnalytics } from '@/hooks/useAdmin';
import { exportRows } from '@/services/admin.service';
import { CLAIM_STATUS } from '@/lib/constants';
import { downloadCsv, toCsv } from '@/utils/csv';
import { formatDate, formatNumber, manilaToday } from '@/utils/format';
import { getErrorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/common/Card';
import { Input } from '@/components/common/FormControls';
import { Button } from '@/components/common/Button';
import { ErrorState, Skeleton } from '@/components/common/Feedback';
import { ChartCard, GroupedBars, TrendChart } from '@/components/dashboard/Charts';

function shiftDays(iso, days) {
  // Pure calendar arithmetic in UTC, so the local time zone can't shift the day.
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function presets() {
  const today = manilaToday();
  return [
    { id: '30d', label: 'Last 30 days', from: shiftDays(today, -29), to: today },
    { id: '90d', label: 'Last 90 days', from: shiftDays(today, -89), to: today },
    { id: 'year', label: 'This year', from: `${today.slice(0, 4)}-01-01`, to: today },
    { id: 'all', label: 'All time', from: '', to: '' },
  ];
}

const EXPORTS = {
  lost: {
    label: 'Lost reports',
    columns: [
      { header: 'Reference no.', value: (r) => r.reference_no },
      { header: 'Item', value: (r) => r.item_name },
      { header: 'Category', value: (r) => r.category?.name },
      { header: 'Campus', value: (r) => r.campus?.name },
      { header: 'Status', value: (r) => r.status },
      { header: 'Date lost', value: (r) => r.date_lost },
      { header: 'Reported at', value: (r) => r.created_at },
      { header: 'Reporter', value: (r) => r.reporter?.full_name },
      { header: 'Reporter email', value: (r) => r.reporter?.institutional_email },
    ],
  },
  found: {
    label: 'Found reports',
    columns: [
      { header: 'Reference no.', value: (r) => r.reference_no },
      { header: 'Item', value: (r) => r.item_name },
      { header: 'Category', value: (r) => r.category?.name },
      { header: 'Campus', value: (r) => r.campus?.name },
      { header: 'Status', value: (r) => r.status },
      { header: 'Date found', value: (r) => r.date_found },
      { header: 'Reported at', value: (r) => r.created_at },
      { header: 'Released at', value: (r) => r.released_at },
      { header: 'Finder', value: (r) => r.reporter?.full_name },
      { header: 'Finder email', value: (r) => r.reporter?.institutional_email },
    ],
  },
  claims: {
    label: 'Claims',
    columns: [
      { header: 'Reference no.', value: (r) => r.reference_no },
      { header: 'Item', value: (r) => r.found_item?.item_name },
      { header: 'Item reference', value: (r) => r.found_item?.reference_no },
      { header: 'Status', value: (r) => r.status },
      { header: 'Claimant', value: (r) => r.claimant?.full_name },
      { header: 'Claimant email', value: (r) => r.claimant?.institutional_email },
      { header: 'Submitted at', value: (r) => r.created_at },
      { header: 'Reviewed at', value: (r) => r.reviewed_at },
      { header: 'Released at', value: (r) => r.released_at },
      { header: 'Released to', value: (r) => r.released_to_name },
    ],
  },
};

function KPI({ label, value, suffix, loading }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">
        {loading ? <Skeleton className="h-7 w-16" /> : value === null || value === undefined ? '—' : `${formatNumber(value)}${suffix ?? ''}`}
      </p>
    </div>
  );
}

export default function ReportsPage() {
  const options = presets();
  const [preset, setPreset] = useState('year');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const range = preset === 'custom' ? custom : options.find((p) => p.id === preset);
  const analytics = useAnalytics(range.from || null, range.to || null);
  const [exporting, setExporting] = useState(null);
  const a = analytics.data;
  const t = a?.totals;

  const rangeLabel = range.from || range.to ? `${range.from ? formatDate(range.from) : 'the beginning'} – ${range.to ? formatDate(range.to) : 'today'}` : 'all time';

  const onExport = async (type) => {
    setExporting(type);
    try {
      const rows = await exportRows(type, range);
      const csv = toCsv(rows, EXPORTS[type].columns);
      downloadCsv(`cvsu-lost-and-found-${type}-${range.from || 'start'}-to-${range.to || manilaToday()}.csv`, csv);
      toast.success(`Exported ${rows.length} ${EXPORTS[type].label.toLowerCase()}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports and analytics" description={`Statistics for ${rangeLabel}, based on when reports were submitted.`} />

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range">
            {[...options, { id: 'custom', label: 'Custom range' }].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                aria-pressed={preset === p.id}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium',
                  preset === p.id ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                )}
              >
                {preset === p.id && <Check className="size-4" strokeWidth={3} />}
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-500">
                From
                <Input type="date" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="mt-1 w-44" />
              </label>
              <label className="text-xs text-slate-500">
                To
                <Input type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="mt-1 w-44" />
              </label>
            </div>
          )}
        </CardBody>
      </Card>

      {analytics.isError ? (
        <ErrorState error={analytics.error} onRetry={analytics.refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KPI label="Lost reports" value={t?.lost_total} loading={analytics.isPending} />
            <KPI label="Found reports" value={t?.found_total} loading={analytics.isPending} />
            <KPI label="Items returned" value={t?.returned} loading={analytics.isPending} />
            <KPI label="Return rate" value={a?.return_rate_pct} suffix="%" loading={analytics.isPending} />
            <KPI label="Avg. days to return" value={a?.avg_days_to_return} loading={analytics.isPending} />
            <KPI label="Claims submitted" value={t?.claims_total} loading={analytics.isPending} />
          </div>

          {a && (
            <>
              <ChartCard
                title="Reports per month"
                description="Lost and found reports submitted, and items returned, per month in the selected range."
                seriesKeys={['lost', 'found', 'returned']}
                table={{
                  columns: [
                    { key: 'month', header: 'Month' },
                    { key: 'lost', header: 'Lost', numeric: true },
                    { key: 'found', header: 'Found', numeric: true },
                    { key: 'returned', header: 'Returned', numeric: true },
                  ],
                  rows: a.monthly,
                }}
              >
                <TrendChart data={a.monthly} height={300} />
              </ChartCard>

              <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard
                  title="By category"
                  seriesKeys={['lost', 'found']}
                  table={{
                    columns: [
                      { key: 'name', header: 'Category' },
                      { key: 'lost', header: 'Lost', numeric: true },
                      { key: 'found', header: 'Found', numeric: true },
                    ],
                    rows: a.by_category,
                  }}
                >
                  <GroupedBars data={a.by_category} labelWidth={150} />
                </ChartCard>
                <ChartCard
                  title="By campus"
                  seriesKeys={['lost', 'found', 'returned']}
                  table={{
                    columns: [
                      { key: 'name', header: 'Campus' },
                      { key: 'lost', header: 'Lost', numeric: true },
                      { key: 'found', header: 'Found', numeric: true },
                      { key: 'returned', header: 'Returned', numeric: true },
                    ],
                    rows: a.by_campus,
                  }}
                >
                  <GroupedBars data={a.by_campus} keys={['lost', 'found', 'returned']} labelKey="code" labelWidth={80} />
                </ChartCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Claim outcomes" description="Claims submitted in the selected range, by current status." />
                  <CardBody>
                    <dl className="divide-y divide-slate-100">
                      {Object.entries(CLAIM_STATUS).map(([status, meta]) => (
                        <div key={status} className="flex items-center justify-between py-2 text-sm">
                          <dt className="text-slate-600">{meta.label}</dt>
                          <dd className="font-medium text-slate-900 tabular-nums">{formatNumber(a.claim_outcomes?.[status] ?? 0)}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Top locations" description="Where items are most often lost or found." />
                  <CardBody>
                    {a.top_locations.length === 0 ? (
                      <p className="text-sm text-slate-500">No reports with a location in this range.</p>
                    ) : (
                      <ol className="divide-y divide-slate-100">
                        {a.top_locations.map((l, i) => (
                          <li key={`${l.campus_code}-${l.name}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <span className="text-slate-700">
                              <span className="mr-2 text-slate-400 tabular-nums">{i + 1}.</span>
                              {l.name} <span className="text-xs text-slate-400">· {l.campus_code}</span>
                            </span>
                            <span className="font-medium text-slate-900 tabular-nums">{formatNumber(l.total)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </CardBody>
                </Card>
              </div>
            </>
          )}
        </>
      )}

      <Card>
        <CardHeader title="Export data" description={`Download records submitted in ${rangeLabel} as CSV (opens in Excel or Google Sheets).`} />
        <CardBody className="flex flex-wrap gap-2">
          {Object.entries(EXPORTS).map(([type, { label }]) => (
            <Button key={type} variant="outline" icon={Download} loading={exporting === type} disabled={Boolean(exporting)} onClick={() => onExport(type)}>
              {label}
            </Button>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
