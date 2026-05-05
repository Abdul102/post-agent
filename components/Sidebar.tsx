'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Sparkles,
  CalendarDays,
  History,
  FileText,
  Search,
  Settings,
  Share2,
  Target,
  LogOut,
} from 'lucide-react';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/create-post', label: 'Create Post', icon: Sparkles },
  { href: '/today', label: "Today's Post", icon: CalendarDays },
  { href: '/posts', label: 'Post History', icon: History },
  { href: '/blogs', label: 'Blog Generator', icon: FileText },
  { href: '/seo', label: 'SEO Suggestions', icon: Search },
  { href: '/social-accounts', label: 'Social Accounts', icon: Share2 },
  { href: '/targets', label: 'Syndication Targets', icon: Target },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white p-4 flex flex-col">
      <div className="mb-6 px-2">
        <div className="text-xl font-semibold text-gray-900">Post Agent</div>
        <div className="text-xs text-gray-500">AI growth assistant</div>
      </div>
      <nav className="flex-1 space-y-1">
        {links.map((l) => {
          const active = pathname?.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ' +
                (active ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50')
              }
            >
              <Icon size={16} />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-gray-100 pt-4 text-sm">
        <div className="px-2 text-gray-700 truncate">{session?.user?.email ?? '—'}</div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-gray-600 hover:bg-gray-50"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  );
}
