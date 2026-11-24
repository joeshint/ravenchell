import {
  Bell,
  ClipboardList,
  FileSearch,
  FileText,
  LayoutDashboard,
  PackageCheck,
  PackageSearch,
  SearchCheck,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { AppShell } from './AppShell';

const NAV = [
  {
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Report',
    items: [
      { to: '/report/lost', label: 'Report Lost Item', icon: FileSearch },
      { to: '/report/found', label: 'Report Found Item', icon: PackageCheck },
    ],
  },
  {
    label: 'My activity',
    items: [
      { to: '/my-reports', label: 'My Reports', icon: FileText },
      { to: '/my-claims', label: 'My Claims', icon: ClipboardList },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/profile', label: 'Profile Settings', icon: UserRound },
    ],
  },
  {
    label: 'Browse',
    items: [
      { to: '/lost', label: 'Lost Items', icon: PackageSearch },
      { to: '/found', label: 'Found Items', icon: SearchCheck },
    ],
  },
];

export function UserLayout() {
  const { isAdmin } = useAuth();
  return (
    <AppShell
      navGroups={NAV}
      sidebarFooter={
        isAdmin && (
          <Button to="/admin" variant="secondary" className="w-full" icon={ShieldCheck}>
            Open admin panel
          </Button>
        )
      }
    />
  );
}
