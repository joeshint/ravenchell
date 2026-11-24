import { CheckCircle2, EyeOff, FileSearch, PackageCheck, ShieldCheck, Undo2 } from 'lucide-react';
import { usePublicSettings } from '@/hooks/useLookups';
import { Button } from '@/components/common/Button';
import { Card, CardBody } from '@/components/common/Card';

const FAQ = [
  {
    q: 'Who can use the system?',
    a: 'Any CvSU student, faculty member or university employee with an institutional email address. Anyone can browse verified listings without an account.',
  },
  {
    q: 'Why is my report not visible yet?',
    a: 'Every report is reviewed by an administrator before it is listed publicly. You will receive a notification when it is approved.',
  },
  {
    q: 'Why are some details of found items hidden?',
    a: 'Serial numbers, contents and distinctive marks are kept private. Only the real owner should know them, which is how administrators verify claims.',
  },
  {
    q: 'What should I do with an item I found?',
    a: 'Report it here, then turn it in to the security office or the Office of Student Affairs on your campus. Select that office as the custody location in your report.',
  },
  {
    q: 'What do I bring when claiming?',
    a: 'A valid CvSU ID and any proof of ownership you have (receipts, photos, or details only the owner would know).',
  },
];

export default function AboutPage() {
  const { data: settings } = usePublicSettings();
  const office = settings?.claim_office || 'Office of Student Affairs and Services (OSAS)';

  return (
    <div className="container-page py-12 lg:py-16">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-brand-700">About the system</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          A safer, faster way to return lost belongings at CvSU
        </h1>
        <p className="mt-4 text-base text-slate-600">
          The CvSU Lost and Found System replaces scattered social media posts and paper logbooks with one verified,
          searchable list for all campuses. Reports are reviewed by administrators, and ownership is verified privately
          before any item is released.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {[
          { icon: FileSearch, title: 'For owners', text: 'Report what you lost, browse found items and claim yours with private verification.' },
          { icon: PackageCheck, title: 'For finders', text: 'Report what you found and where you turned it in. You will be notified when it is returned.' },
          { icon: ShieldCheck, title: 'For administrators', text: 'Review reports, verify claims, record releases and track everything in an audit log.' },
        ].map(({ icon: Icon, title, text }) => (
          <Card key={title}>
            <CardBody>
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{text}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-16 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-xl font-semibold text-slate-900">How claiming works</h2>
          <ol className="mt-5 space-y-4">
            {[
              'Find your item in the Found Items list and open its details.',
              'Click “Claim this item”, describe your ownership and answer the verification questions.',
              'An administrator compares your answers with the private details recorded by the finder.',
              `If approved, bring a valid CvSU ID to the ${office} to receive your item.`,
            ].map((step, i) => (
              <li key={step} className="flex gap-3 text-sm text-slate-600">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="mt-8 space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-5">
            <p className="flex items-center gap-2 font-medium text-brand-900">
              <EyeOff className="size-4" /> Your privacy
            </p>
            {[
              'Your contact details are visible only to administrators.',
              'Claims and verification answers are never shown publicly or to the finder.',
              'Claim evidence is stored privately and viewed only by administrators.',
            ].map((t) => (
              <p key={t} className="flex gap-2 text-sm text-brand-900/80">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" /> {t}
              </p>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">Frequently asked questions</h2>
          <div className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-slate-900">
                  {q}
                  <span className="text-slate-400 transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-16 flex flex-col items-center justify-between gap-4 rounded-2xl bg-brand-800 px-6 py-8 text-center sm:flex-row sm:text-left">
        <div>
          <h2 className="text-lg font-semibold text-white">Ready to get started?</h2>
          <p className="text-sm text-brand-100">Browse listings now, or create an account to file a report.</p>
        </div>
        <div className="flex gap-2">
          <Button to="/found" variant="secondary" icon={Undo2}>
            Browse found items
          </Button>
        </div>
      </div>
    </div>
  );
}
