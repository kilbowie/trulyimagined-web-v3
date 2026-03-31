'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import {
  Shield,
  UserCircle,
  CreditCard,
  Settings,
  ScrollText,
  History,
  ShieldCheck,
  FileText,
  Home,
  Users,
  Building,
  Upload,
  Headphones,
  LogOut,
  MessageCircle,
  Sun,
  Moon,
  Monitor,
  ExternalLink,
  Smile,
  Frown,
  Meh,
  Heart,
  MoreVertical,
  Angry,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SidebarProps {
  userName?: string;
  roles?: string[];
}

interface NavigationItem {
  title: string;
  href: string;
  icon: typeof Shield;
  show: boolean;
  badge?: number;
  comingSoon?: boolean;
}

interface NavigationGroup {
  groupTitle: string;
  show: boolean;
  items: NavigationItem[];
}

export function DashboardSidebar({ userName, roles = [] }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackTopic, setFeedbackTopic] = useState('General');
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [notificationCounts, setNotificationCounts] = useState({
    unreadFeedback: 0,
    unreadSupport: 0,
  });

  const hasActorRole = roles.includes('Actor');
  const hasAgentRole = roles.includes('Agent');
  const hasAdminRole = roles.includes('Admin');
  const hasEnterpriseRole = roles.includes('Enterprise');

  // Fetch notification counts
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications/counts');
        const data = await response.json();
        if (data.success) {
          setNotificationCounts(data.counts);
        }
      } catch (error) {
        console.error('[FETCH_NOTIFICATIONS_ERROR]', error);
      }
    };

    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const feedbackTopics = [
    'General',
    'Profile',
    'Consent Preferences',
    'Consent History',
    'Register Identity',
    'Verify Identity',
    'Verifiable Credentials',
    'License Tracker',
  ];

  const handleSubmitFeedback = async () => {
    // Reset states
    setFeedbackError(null);
    setFeedbackSuccess(false);

    // Validation
    if (!feedbackText.trim()) {
      setFeedbackError('Please enter your feedback');
      return;
    }

    if (feedbackText.trim().length < 10) {
      setFeedbackError('Feedback must be at least 10 characters');
      return;
    }

    if (feedbackText.length > 5000) {
      setFeedbackError('Feedback must be less than 5000 characters');
      return;
    }

    try {
      setFeedbackSubmitting(true);
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: feedbackTopic,
          text: feedbackText.trim(),
          emoji: selectedEmoji,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      // Show success message
      setFeedbackSuccess(true);

      // Reset form after a delay
      setTimeout(() => {
        setFeedbackText('');
        setSelectedEmoji(null);
        setFeedbackTopic('General');
        setFeedbackSuccess(false);
        setFeedbackSubmitting(false);
        setFeedbackDialogOpen(false);
      }, 2000);
    } catch (error) {
      console.error('[FEEDBACK_SUBMIT_ERROR]', error);
      setFeedbackError(
        error instanceof Error ? error.message : 'Failed to submit feedback. Please try again.'
      );
      setFeedbackSubmitting(false);
    }
  };

  // Standalone navigation items
  const standaloneItems: NavigationItem[] = [
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
      title: 'Upload Media',
      href: '/dashboard/upload-media',
      icon: Upload,
      show: hasActorRole,
    },
  ];

  // Grouped navigation items
  const groupedNavigationItems: NavigationGroup[] = [
    {
      groupTitle: 'Consent',
      show: hasActorRole,
      items: [
        {
          title: 'Consent Preferences',
          href: '/dashboard/consent-preferences',
          icon: Settings,
          show: hasActorRole,
        },
        {
          title: 'Consent History',
          href: '/dashboard/consent-history',
          icon: History,
          show: hasActorRole,
        },
      ],
    },
    {
      groupTitle: 'Identity',
      show: hasActorRole,
      items: [
        {
          title: 'Register Identity',
          href: '/dashboard/register-identity',
          icon: ShieldCheck,
          show: hasActorRole,
        },
        {
          title: 'Verify Identity',
          href: '/dashboard/verify-identity',
          icon: ShieldCheck,
          show: hasActorRole,
        },
        {
          title: 'Verifiable Credentials',
          href: '/dashboard/verifiable-credentials',
          icon: FileText,
          show: hasActorRole,
        },
      ],
    },
    {
      groupTitle: 'Licensing',
      show: hasActorRole,
      items: [
        {
          title: 'License Tracker',
          href: '/dashboard/licenses',
          icon: ScrollText,
          show: hasActorRole,
        },
      ],
    },
    {
      groupTitle: 'Admin',
      show: hasAdminRole,
      items: [
        {
          title: 'User Feedback',
          href: '/dashboard/admin/feedback',
          icon: MessageCircle,
          show: hasAdminRole,
          badge: notificationCounts.unreadFeedback,
        },
      ],
    },
    {
      groupTitle: 'IAM',
      show: hasAdminRole,
      items: [
        {
          title: 'Users',
          href: '/dashboard/iam/users',
          icon: Shield,
          show: hasAdminRole,
        },
      ],
    },
  ];

  const documentItems: NavigationItem[] = [
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
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-slate-950 text-white">
      {/* Logo/Brand */}
      <Link
        href="/"
        className="flex h-16 items-center justify-center border-b border-slate-800 px-6"
      >
        <img
          src="/logo.svg"
          alt="Truly Imagined Logo"
          className="h-8 w-auto transition-transform duration-200 hover:scale-[1.2] cursor-pointer"
        />
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {/* Standalone Navigation Items */}
        <div className="space-y-1">
          {standaloneItems
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

        {/* Grouped Navigation Items */}
        <div className="pt-4">
          <Accordion type="multiple" className="space-y-1">
            {groupedNavigationItems
              .filter((group) => group.show)
              .map((group) => {
                const visibleItems = group.items.filter((item) => item.show);
                if (visibleItems.length === 0) return null;

                return (
                  <AccordionItem
                    key={group.groupTitle}
                    value={group.groupTitle}
                    className="border-b-0"
                  >
                    <AccordionTrigger className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:no-underline hover:text-slate-400">
                      {group.groupTitle}
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <div className="space-y-1">
                        {visibleItems.map((item) => {
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
                              <span className="flex-1">{item.title}</span>
                              {(item.badge ?? 0) > 0 && (
                                <Badge
                                  variant="destructive"
                                  className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs font-medium"
                                >
                                  {(item.badge ?? 0) > 99 ? '99+' : item.badge}
                                </Badge>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
          </Accordion>
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

      {/* Support Link - Always visible at bottom */}
      <div className="border-t border-slate-800 p-4">
        <Link
          href="/dashboard/support"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors relative',
            pathname?.startsWith('/dashboard/support')
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:bg-slate-900 hover:text-white'
          )}
        >
          <Headphones className="h-4 w-4" />
          <span className="flex-1">Support</span>
          {notificationCounts.unreadSupport > 0 && (
            <div className="absolute top-1/2 -translate-y-1/2 right-2 h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          )}
        </Link>
      </div>

      {/* User Info at Bottom */}
      <div className="border-t border-slate-800 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="group flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800">
                <UserCircle className="h-5 w-5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate text-white">{userName || 'User'}</p>
                <p className="text-xs text-slate-500">
                  {roles.length > 0 ? roles.join(', ') : 'No roles'}
                </p>
              </div>
              <MoreVertical className="h-4 w-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 bg-slate-900 border-slate-800"
            align="end"
            side="top"
            sideOffset={8}
          >
            <DropdownMenuItem asChild>
              <Link
                href="/dashboard/account/settings"
                className="flex items-center gap-2 cursor-pointer text-white hover:bg-slate-800"
              >
                <Settings className="h-4 w-4" />
                <span>Account</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/dashboard/account/billing"
                className="flex items-center gap-2 cursor-pointer text-white hover:bg-slate-800"
              >
                <CreditCard className="h-4 w-4" />
                <span>Billing</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setFeedbackDialogOpen(true)}
              className="flex items-center gap-2 cursor-pointer text-white hover:bg-slate-800"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Feedback</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setThemeDialogOpen(true)}
              className="flex items-center gap-2 cursor-pointer text-white hover:bg-slate-800"
            >
              <Monitor className="h-4 w-4" />
              <span>Theme</span>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/"
                className="flex items-center gap-2 cursor-pointer text-white hover:bg-slate-800"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Home Page</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-slate-800" />

            <DropdownMenuItem asChild>
              <a
                href="/auth/logout"
                className="flex items-center gap-2 cursor-pointer text-red-400 hover:bg-slate-800 hover:text-red-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription className="text-slate-400">
              Help us improve your experience. Select a topic and share your thoughts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Topic Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Topic</label>
              <Select value={feedbackTopic} onValueChange={setFeedbackTopic}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {feedbackTopics.map((topic) => (
                    <SelectItem
                      key={topic}
                      value={topic}
                      className="hover:bg-slate-700 focus:bg-slate-700"
                    >
                      {topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Feedback Text */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Your Feedback</label>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Tell us what you think..."
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[100px]"
              />
            </div>

            {/* Emoji Reactions */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">How do you feel?</label>
              <div className="flex gap-2">
                {[
                  { icon: Angry, value: 'angry', color: 'text-red-600', label: 'Angry' },
                  { icon: Frown, value: 'sad', color: 'text-orange-400', label: 'Sad' },
                  { icon: Meh, value: 'neutral', color: 'text-yellow-400', label: 'Neutral' },
                  { icon: Smile, value: 'happy', color: 'text-green-400', label: 'Happy' },
                  { icon: Heart, value: 'love', color: 'text-pink-400', label: 'Love' },
                ].map(({ icon: Icon, value, color, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedEmoji(value)}
                    aria-label={label}
                    title={label}
                    className={cn(
                      'p-2 rounded-lg border transition-all',
                      selectedEmoji === value
                        ? 'bg-slate-700 border-slate-600 scale-110'
                        : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', color)} />
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {feedbackError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-sm text-red-400">{feedbackError}</p>
              </div>
            )}

            {/* Success Message */}
            {feedbackSuccess && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                <p className="text-sm text-green-400">
                  ✓ Feedback submitted successfully! Thank you.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFeedbackDialogOpen(false);
                setFeedbackError(null);
                setFeedbackSuccess(false);
              }}
              disabled={feedbackSubmitting}
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={feedbackSuccess || feedbackSubmitting || !feedbackText.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {feedbackSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {feedbackSuccess
                ? 'Submitted!'
                : feedbackSubmitting
                  ? 'Submitting...'
                  : 'Submit Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Theme Dialog */}
      <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose Theme</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select your preferred theme for the application.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <button
              onClick={() => {
                setTheme('light');
                setThemeDialogOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-lg border transition-all',
                theme === 'light'
                  ? 'bg-slate-800 border-blue-500 ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              )}
            >
              <Sun className="h-5 w-5 text-yellow-400" />
              <div className="flex-1 text-left">
                <p className="font-medium">Light</p>
                <p className="text-xs text-slate-400">Bright and clear interface</p>
              </div>
              {theme === 'light' && <div className="h-2 w-2 rounded-full bg-blue-500" />}
            </button>

            <button
              onClick={() => {
                setTheme('dark');
                setThemeDialogOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-lg border transition-all',
                theme === 'dark'
                  ? 'bg-slate-800 border-blue-500 ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              )}
            >
              <Moon className="h-5 w-5 text-blue-400" />
              <div className="flex-1 text-left">
                <p className="font-medium">Dark</p>
                <p className="text-xs text-slate-400">Easy on the eyes</p>
              </div>
              {theme === 'dark' && <div className="h-2 w-2 rounded-full bg-blue-500" />}
            </button>

            <button
              onClick={() => {
                setTheme('system');
                setThemeDialogOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-lg border transition-all',
                theme === 'system'
                  ? 'bg-slate-800 border-blue-500 ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              )}
            >
              <Monitor className="h-5 w-5 text-slate-400" />
              <div className="flex-1 text-left">
                <p className="font-medium">System</p>
                <p className="text-xs text-slate-400">Match your device settings</p>
              </div>
              {theme === 'system' && <div className="h-2 w-2 rounded-full bg-blue-500" />}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
