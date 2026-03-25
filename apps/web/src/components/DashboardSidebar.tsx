'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Shield,
  UserCircle,
  Settings,
  ScrollText,
  History,
  ShieldCheck,
  FileText,
  Home,
  Users,
  Building,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  userName?: string;
  roles?: string[];
}

export function DashboardSidebar({ userName, roles = [] }: SidebarProps) {
  const pathname = usePathname();
  
  const hasActorRole = roles.includes('Actor');
  const hasAgentRole = roles.includes('Agent');
  const hasAdminRole = roles.includes('Admin');
  const hasEnterpriseRole = roles.includes('Enterprise');

  const navigationItems = [
    {
      title: 'Home',
      href: '/dashboard',
      icon: Home,
      show: true,
    },
    {
      title: 'Profile',
      href: '/dashboard/profile',
      icon: UserCircle,
      show: hasActorRole,
    },
    {
      title: 'Verifiable Credentials',
      href: '/dashboard/verifiable-credentials',
      icon: FileText,
      show: hasActorRole,
    },
    {
      title: 'Register Identity',
      href: '/register-actor',
      icon: ShieldCheck,
      show: hasActorRole,
    },
    {
      title: 'Consent Preferences',
      href: '/dashboard/consent-preferences',
      icon: Settings,
      show: hasActorRole,
    },
    {
      title: 'License Tracker',
      href: '/dashboard/licenses',
      icon: ScrollText,
      show: hasActorRole,
    },
    {
      title: 'Consent History',
      href: '/dashboard/consent-history',
      icon: History,
      show: hasActorRole,
    },
    {
      title: 'Verify Identity',
      href: '/dashboard/verify-identity',
      icon: ShieldCheck,
      show: hasActorRole,
    },
  ];

  const documentItems = [
    {
      title: 'Agent Dashboard',
      href: '/dashboard/agent',
      icon: Users,
      show: hasAgentRole,
      comingSoon: true,
    },
    {
      title: 'Enterprise Portal',
      href: '/dashboard/enterprise',
      icon: Building,
      show: hasEnterpriseRole,
      comingSoon: true,
    },
    {
      title: 'Admin Panel',
      href: '/dashboard/admin',
      icon: Wrench,
      show: hasAdminRole,
      comingSoon: true,
    },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-slate-950 text-white">
      {/* Logo/Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-6">
        <Shield className="h-6 w-6 text-blue-400" />
        <span className="text-lg font-semibold">TrulyImagined</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {/* Main Navigation */}
        <div className="space-y-1">
          {navigationItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
        </div>

        {/* Documents Section */}
        {documentItems.some((item) => item.show) && (
          <>
            <div className="pt-6 pb-2">
              <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Additional
              </h3>
            </div>
            <div className="space-y-1">
              {documentItems
                .filter((item) => item.show)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  
                  return (
                    <div key={item.href} className="relative">
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          item.comingSoon && 'opacity-50 cursor-not-allowed',
                          isActive
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                        )}
                        {...(item.comingSoon && { onClick: (e) => e.preventDefault() })}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {item.comingSoon && (
                          <Badge variant="outline" className="text-xs border-slate-700">
                            Soon
                          </Badge>
                        )}
                      </Link>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </nav>

      {/* User Info at Bottom */}
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800">
            <UserCircle className="h-5 w-5 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName || 'User'}</p>
            <p className="text-xs text-slate-500">
              {roles.length > 0 ? roles.join(', ') : 'No roles'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
