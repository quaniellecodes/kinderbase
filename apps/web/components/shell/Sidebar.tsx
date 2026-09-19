import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  FileCheck,
  Calendar,
  Clock,
  ClipboardList,
  BarChart3,
  Settings,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getOrgIconPublicUrl } from '@/lib/storage/org-icons';
import { RoleSwitcher } from './RoleSwitcher';
import { NavLink } from './NavLink';
import { LogoutButton } from './LogoutButton';
import type { CenterRole } from '@kinderbase/types';

type Membership = {
  centerId: string;
  centerName: string;
  role: CenterRole;
};

async function getMemberships(): Promise<Membership[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('center_memberships')
    .select('center_id, role, centers(id, name)')
    .eq('user_id', user.id)
    .is('left_at', null);

  if (!data) return [];

  return data.map((row) => {
    const center = Array.isArray(row.centers) ? row.centers[0] : row.centers;
    return {
      centerId: center?.id ?? '',
      centerName: center?.name ?? '',
      role: row.role as CenterRole,
    };
  });
}

const adminNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/staff', label: 'Staff', icon: Users },
  { href: '/classrooms', label: 'Classrooms', icon: DoorOpen },
  { href: '/requests', label: 'Requests', icon: ClipboardList },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const teacherNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/credentials', label: 'Credentials', icon: FileCheck },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/time', label: 'Time', icon: Clock },
  { href: '/requests', label: 'Requests', icon: ClipboardList },
];

async function getOrgBranding(centerId: string): Promise<{ iconUrl: string | null }> {
  const service = createServiceClient();
  const { data } = await service
    .from('centers')
    .select('organizations(icon_path)')
    .eq('id', centerId)
    .single();
  const org = data?.organizations ? (Array.isArray(data.organizations) ? data.organizations[0] : data.organizations) : null;
  const iconUrl = org?.icon_path ? getOrgIconPublicUrl(org.icon_path) : null;
  return { iconUrl };
}

export async function Sidebar() {
  const memberships = await getMemberships();
  const active = getActiveContextFromCookies();

  if (!active && memberships.length > 0) {
    const first = memberships[0]!;
    return null; // RoleSwitcher gate in layout will handle this
  }

  if (!active) redirect('/login');

  const nav = isAdmin(active.role) ? adminNav : teacherNav;
  const { iconUrl } = await getOrgBranding(active.centerId);

  return (
    <aside className="flex flex-col w-full h-full">
      {/* Center branding */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-start gap-2">
          {iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} alt="" className="w-6 h-6 rounded-md object-contain flex-shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-snug">{active.centerName}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">powered by KinderBase</p>
          </div>
        </div>
      </div>

      {/* Role switcher */}
      <div className="px-3 py-3 border-b border-gray-100">
        <RoleSwitcher variant="dropdown" memberships={memberships} active={active} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => (
          <NavLink key={href} href={href} label={label} icon={<Icon size={16} />} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100 space-y-3">
        <LogoutButton />
        <p className="text-[10px] text-gray-400 text-center">Powered by KinderBase</p>
      </div>
    </aside>
  );
}
