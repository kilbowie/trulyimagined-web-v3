'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
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
  ThumbsUp,
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

export function DashboardSidebar({ userName, roles = [] }: SidebarProps) {
  const pathname = usePathname();
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackTopic, setFeedbackTopic] = useState('General');
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);

  const hasActorRole = roles.includes('Actor');
  const hasAgentRole = roles.includes('Agent');
  const hasAdminRole = roles.includes('Admin');
  const hasEnterpriseRole = roles.includes('Enterprise');

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
    // TODO: Implement feedback submission
    console.log('Feedback submitted:', {
      topic: feedbackTopic,
      text: feedbackText,
      emoji: selectedEmoji,
    });
    // Reset and close
    setFeedbackText('');
    setSelectedEmoji(null);
    setFeedbackDialogOpen(false);
  };

  // Standalone navigation items
  const standaloneItems = [
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
  const groupedNavigationItems = [
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
                              <span>{item.title}</span>
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
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            pathname?.startsWith('/dashboard/support')
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:bg-slate-900 hover:text-white'
          )}
        >
          <Headphones className="h-4 w-4" />
          <span>Support</span>
        </Link>
      </div>

      {/* User Info at Bottom */}
      <div className="border-t border-slate-800 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-700">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800">
                <UserCircle className="h-5 w-5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate text-white">{userName || 'User'}</p>
                <p className="text-xs text-slate-500">
                  {roles.length > 0 ? roles.join(', ') : 'No roles'}
                </p>
              </div>
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
            
            <DropdownMenuItem
              onClick={() => setFeedbackDialogOpen(true)}
              className="flex items-center gap-2 cursor-pointer text-white hover:bg-slate-800"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Feedback</span>
            </DropdownMenuItem>

            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-white hover:bg-slate-800">
              <div className="flex items-center gap-2 flex-1">
                <Monitor className="h-4 w-4" />
                <span>Theme</span>
              </div>
              <div className="flex gap-1">
                <Sun className="h-3 w-3 text-slate-500" />
                <Moon className="h-3 w-3 text-slate-500" />
              </div>
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
                  { icon: Heart, value: 'love', color: 'text-red-400', label: 'Love it' },
                  { icon: Smile, value: 'happy', color: 'text-green-400', label: 'Happy' },
                  { icon: Meh, value: 'neutral', color: 'text-yellow-400', label: 'Neutral' },
                  { icon: Frown, value: 'sad', color: 'text-orange-400', label: 'Sad' },
                  { icon: ThumbsUp, value: 'thumbsup', color: 'text-blue-400', label: 'Thumbs up' },
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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFeedbackDialogOpen(false)}
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
