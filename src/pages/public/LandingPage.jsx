import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ClipboardCheck,
  FileSearch,
  PackageCheck,
  PackageSearch,
  Search,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import { queryKeys } from '@/lib/queryClient';
import { getPublicStats } from '@/services/stats.service';
import { getRecentFoundItems, getRecentLostItems } from '@/services/items.service';
import { formatNumber } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/common/Feedback';
import { ItemCard, ItemCardSkeleton } from '@/components/items/ItemCard';

function HeroSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('found');
  const submit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    navigate(`/${type}${params.size ? `?${params}` : ''}`);
  };
  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-2 rounded-xl bg-white p-2 shadow-pop sm:flex-row" role="search">
      <label htmlFor="hero-type" className="sr-only">
        Search in
      </label>
      <select
        id="hero-type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="h-11 rounded-lg border-0 bg-slate-100 px-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-brand-600/30 sm:w-40"
      >
        <option value="found">Found items</option>
        <option value="lost">Lost items</option>
      </select>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <label htmlFor="hero-q" className="sr-only">
          Item name
        </label>
        <input
          id="hero-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. wallet, ID, umbrella, calculator"
          className="h-11 w-full rounded-lg border-0 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-600/30"
        />
      </div>
      <Button type="submit" size="lg" className="h-11">
        Search
      </Button>
    </form>
  );
}

function Stats() {
  const { data, isPending, isError } = useQuery({ queryKey: queryKeys.publicStats, queryFn: getPublicStats });
  const cards = [
    { label: 'Items still missing', value: data?.lost_open, icon: PackageSearch },
    { label: 'Found items available', value: data?.found_available, icon: PackageCheck },
    { label: 'Items returned', value: data?.returned, icon: Undo2 },
    { label: 'Total reports listed', value: (data?.total_lost ?? 0) + (data?.total_found ?? 0), icon: ClipboardCheck },
  ];
  if (isError) return null;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
          <Icon className="size-5 text-accent-300" aria-hidden="true" />
          <dd className="mt-3 text-2xl font-semibold text-white">
            {isPending ? <Skeleton className="h-7 w-12 bg-white/20" /> : formatNumber(value)}
          </dd>
          <dt className="text-xs text-brand-100">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

function RecentItems({ type }) {
  const query = useQuery({
    queryKey: queryKeys.recentItems(type),
    queryFn: () => (type === 'found' ? getRecentFoundItems(4) : getRecentLostItems(4)),
  });

  return (
    <section className="container-page py-12" aria-labelledby={`recent-${type}`}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`recent-${type}`} className="text-xl font-semibold text-slate-900">
            {type === 'found' ? 'Recently found' : 'Recently reported lost'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {type === 'found'
              ? 'Verified items waiting for their owners. Is one of them yours?'
              : 'Help your fellow Caviteños — have you seen any of these?'}
          </p>
        </div>
        <Button to={`/${type}`} variant="outline" size="sm">
          View all <ArrowRight className="size-4" />
        </Button>
      </div>

      {query.isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={type === 'found' ? PackageCheck : PackageSearch}
          title={type === 'found' ? 'No found items listed yet' : 'No lost items listed yet'}
          description="Listings appear here once an administrator has reviewed them."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {query.data.map((item) => (
            <ItemCard key={item.id} item={item} type={type} />
          ))}
        </div>
      )}
    </section>
  );
}

const STEPS = [
  {
    icon: FileSearch,
    title: 'Report',
    text: 'Lost something? File a report. Found something? Turn it in and report it so the owner can find it.',
  },
  {
    icon: ShieldCheck,
    title: 'Verify',
    text: 'Administrators review every report. Identifying details stay private to stop false claims.',
  },
  {
    icon: ClipboardCheck,
    title: 'Claim',
    text: 'Owners submit a claim and answer private questions only the real owner would know.',
  },
  {
    icon: Undo2,
    title: 'Return',
    text: 'Once approved, pick up your item at the designated office with a valid CvSU ID.',
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  return (
    <>
      <section className="relative overflow-hidden bg-brand-800">
        <div className="pointer-events-none absolute -top-40 -right-32 size-[28rem] rounded-full bg-brand-700/50" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-48 -left-24 size-[26rem] rounded-full bg-brand-900/50" aria-hidden="true" />
        <div className="container-page relative grid gap-12 py-16 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100">
              <span className="size-1.5 rounded-full bg-accent-400" aria-hidden="true" />
              Cavite State University
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Lost something on campus? <span className="text-accent-300">Let's find it.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-brand-100 sm:text-lg">
              One place for CvSU students, faculty and personnel to report lost belongings, turn in found items and
              claim them back securely.
            </p>
            <HeroSearch />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button to={isAuthenticated ? '/report/lost' : '/register'} variant="secondary" icon={FileSearch}>
                I lost something
              </Button>
              <Button
                to={isAuthenticated ? '/report/found' : '/register'}
                variant="outline-light"
                icon={PackageCheck}
              >
                I found something
              </Button>
            </div>
          </div>
          <Stats />
        </div>
      </section>

      <RecentItems type="found" />
      <div className="bg-slate-50">
        <RecentItems type="lost" />
      </div>

      <section className="container-page py-16" aria-labelledby="how-it-works">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="how-it-works" className="text-2xl font-semibold text-slate-900">
            How it works
          </h2>
          <p className="mt-2 text-sm text-slate-500">A simple, verified process from report to return.</p>
        </div>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold text-slate-400">STEP {i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
