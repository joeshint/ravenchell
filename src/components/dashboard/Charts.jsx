import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/format';
import { Card, CardBody, CardHeader } from '@/components/common/Card';
import { INK, SERIES } from '@/lib/chartTheme';

/*
 * Chart kit following the dataviz method:
 *  - categorical slots 1–3 of the validated reference palette, assigned by
 *    ENTITY (lost/found/returned always keep their color), never by rank;
 *    validated against this app's white surface (all checks pass; slot 3 has a
 *    contrast WARN, so every chart ships a legend AND a table view as relief);
 *  - 2px lines, ≥8px hover markers with a surface ring, 4px rounded bar ends,
 *    2px surface gap between bars, hairline grid, recessive axes;
 *  - text always in ink tokens, never the series color.
 */
const AXIS_TICK = { fill: INK.muted, fontSize: 12 };

function Legend({ keys }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
      {keys.map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className="size-2.5 rounded-sm" style={{ background: SERIES[k].color }} aria-hidden="true" />
          {SERIES[k].label}
        </li>
      ))}
    </ul>
  );
}

function TooltipBox({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium text-slate-900">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-6 text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
            {SERIES[p.dataKey]?.label ?? p.name}
          </span>
          <span className="font-medium text-slate-900 tabular-nums">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Card with legend + Chart/Table toggle (the table is the accessible view). */
export function ChartCard({ title, description, seriesKeys, table, children, className }) {
  const [view, setView] = useState('chart');
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        description={description}
        action={
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label={`${title} view`}>
            {[
              { v: 'chart', icon: BarChart3, label: 'Chart' },
              { v: 'table', icon: Table2, label: 'Table' },
            ].map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                  view === v ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        }
      />
      <CardBody>
        {view === 'chart' ? (
          <div className="space-y-3">
            {seriesKeys?.length > 1 && <Legend keys={seriesKeys} />}
            {children}
          </div>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs text-slate-500">
                <tr>
                  {table.columns.map((c) => (
                    <th key={c.key} scope="col" className={cn('border-b border-slate-200 py-2 pr-4 font-medium', c.numeric && 'text-right')}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {table.columns.map((c) => (
                      <td key={c.key} className={cn('py-2 pr-4 text-slate-700', c.numeric && 'text-right tabular-nums')}>
                        {c.numeric ? formatNumber(r[c.key]) : r[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

const monthLabel = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'short' });
};
const monthLong = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

/** Change over time: lost / found / returned per month. */
export function TrendChart({ data, keys = ['lost', 'found', 'returned'], height = 260 }) {
  return (
    <div style={{ height }} role="img" aria-label={`Monthly ${keys.join(', ')} counts`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={INK.grid} strokeWidth={1} vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: INK.axis }} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            content={<TooltipBox labelFormatter={monthLong} />}
            cursor={{ stroke: INK.axis, strokeWidth: 1 }}
          />
          {keys.map((k) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={SERIES[k].color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: INK.surface }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Magnitude by category/campus: horizontal grouped bars, one row per entity. */
export function GroupedBars({ data, keys = ['lost', 'found'], labelKey = 'name', labelWidth = 150 }) {
  const height = Math.max(160, data.length * (keys.length * 12 + 18) + 40);
  return (
    <div style={{ height }} role="img" aria-label={`${keys.join(' and ')} by ${labelKey}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barGap={2} barCategoryGap={8}>
          <CartesianGrid stroke={INK.grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: INK.axis }} />
          <YAxis
            type="category"
            dataKey={labelKey}
            width={labelWidth}
            tick={{ fill: INK.secondary, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
          {keys.map((k) => (
            <Bar key={k} dataKey={k} fill={SERIES[k].color} radius={[0, 4, 4, 0]} maxBarSize={12} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
