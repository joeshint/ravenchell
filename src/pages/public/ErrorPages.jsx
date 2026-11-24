import { useRouteError } from 'react-router';
import { Compass, Lock, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/common/Button';

function ErrorLayout({ icon: Icon, code, title, text, children }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-brand-50">
        <Icon className="size-7 text-brand-600" aria-hidden="true" />
      </div>
      {code && <p className="text-sm font-semibold text-brand-700">{code}</p>}
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">{text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <ErrorLayout icon={Compass} code="404" title="Page not found" text="The page you're looking for doesn't exist or has been moved.">
      <Button to="/">Go home</Button>
      <Button to="/found" variant="outline">
        Browse found items
      </Button>
    </ErrorLayout>
  );
}

export function ForbiddenPage() {
  return (
    <ErrorLayout icon={Lock} code="403" title="Access restricted" text="You don't have permission to view this page.">
      <Button to="/dashboard">Go to dashboard</Button>
    </ErrorLayout>
  );
}

/** Router errorElement: unexpected render errors. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <ErrorLayout
      icon={TriangleAlert}
      title="Something went wrong"
      text="An unexpected error occurred while showing this page. Please reload and try again."
    >
      <Button onClick={() => window.location.reload()}>Reload page</Button>
      <Button href="/" variant="outline">
        Go home
      </Button>
    </ErrorLayout>
  );
}
