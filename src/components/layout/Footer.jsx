import { Link } from 'react-router';
import { Logo } from '@/components/common/Logo';
import { usePublicSettings } from '@/hooks/useLookups';

export function Footer() {
  const { data: settings } = usePublicSettings();
  const office = settings?.claim_office || 'Office of Student Affairs and Services (OSAS)';
  const supportEmail = settings?.support_email;

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-2">
          <Logo />
          <p className="max-w-sm text-sm text-slate-500">
            The official lost and found platform for Cavite State University students, faculty and personnel.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Browse</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link className="hover:text-brand-700" to="/lost">Lost items</Link></li>
            <li><Link className="hover:text-brand-700" to="/found">Found items</Link></li>
            <li><Link className="hover:text-brand-700" to="/about">How it works</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Claiming office</h2>
          <p className="mt-3 text-sm text-slate-600">{office}</p>
          {supportEmail && (
            <a className="mt-1 block text-sm text-brand-700 hover:underline" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          )}
        </div>
      </div>
      <div className="border-t border-slate-200">
        <p className="container-page py-4 text-xs text-slate-500">
          © {new Date().getFullYear()} Cavite State University · Lost and Found System
        </p>
      </div>
    </footer>
  );
}
