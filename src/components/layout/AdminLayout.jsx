import {
  Activity,
  BarChart3,
  ClipboardCheck,
  FileSearch,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  Settings,
  Tags,
  Users,
  ArrowLeft,
} from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { AppShell } from './AppShell';

const NAV = [
  {
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Moderation',
    items: [
      { to: '/admin/lost-items', label: 'Lost Items', icon: FileSearch },
      { to: '/admin/found-items', label: 'Found Items', icon: PackageCheck },
      { to: '/admin/claims', label: 'Claim Requests', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/categories', label: 'Categories', icon: Tags },
      { to: '/admin/locations', label: 'Campus Locations', icon: MapPin },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
      { to: '/admin/activity-logs', label: 'Activity Logs', icon: Activity },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function AdminLayout() {
  return (
    <AppShell
      navGroups={NAV}
      sidebarBadge={<Badge tone="gold">Admin</Badge>}
      sidebarFooter={
        <Button to="/dashboard" variant="ghost" className="w-full justify-start" icon={ArrowLeft}>
          Back to user area
        </Button>
      }
    />
  );
}
