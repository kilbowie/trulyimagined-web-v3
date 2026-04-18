'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { useMockAuth } from '@/components/MockAuthProvider';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  LayoutDashboard,
  LogOut,
  Loader2,
  ChevronDown,
  Sun,
  Moon,
  FileText,
} from 'lucide-react';

const IS_MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true';

/**
 * Navigation component — sits on the white header.
 * Dark text, blue primary action, gold secondary outline.
 */
export default function AuthNav() {
  const auth0 = useUser();
  const mockAuth = useMockAuth();

  const user = IS_MOCK_AUTH ? mockAuth.user : auth0.user;
  const isLoading = IS_MOCK_AUTH ? mockAuth.isLoading : auth0.isLoading;

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (isLoading) {
    return (
      <nav className="flex items-center gap-4">
        <Button variant="ghost" disabled>
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      </nav>
    );
  }

  if (!user) {
    return (
      <nav className="flex items-center gap-3">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="md:hidden text-slate-500 hover:text-slate-800 hover:bg-slate-100"
        >
          <Link href="/privacy-policy">
            <FileText className="h-5 w-5" />
            <span className="sr-only">Legal</span>
          </Link>
        </Button>
        <Button
          variant="ghost"
          asChild
          className="hidden md:flex text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-sm font-medium"
        >
          <Link href="/privacy-policy">Privacy</Link>
        </Button>
        <Button
          variant="ghost"
          asChild
          className="hidden sm:flex text-slate-600 hover:text-blue-700 hover:bg-blue-50 text-sm font-medium"
        >
          <Link href="/auth/login">Sign In</Link>
        </Button>
        {/* Gold-outlined secondary action */}
        <Button
          asChild
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-sm shadow-blue-500/20 text-sm"
        >
          <Link href="/auth/login">Get Started</Link>
        </Button>
      </nav>
    );
  }

  const roles = (user['https://trulyimagined.com/roles'] as string[]) || [];
  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <nav className="flex items-center gap-3">
      {mounted && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-slate-500 hover:text-slate-800 hover:bg-slate-100"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      )}

      <Button
        variant="ghost"
        asChild
        className="hidden md:flex text-slate-600 hover:text-blue-700 hover:bg-blue-50 text-sm font-medium"
      >
        <Link href="/dashboard">
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Dashboard
        </Link>
      </Button>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2 px-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
          >
            <Avatar className="h-8 w-8 ring-2 ring-blue-100">
              <AvatarImage src={user.picture || undefined} alt={user.name || 'User'} />
              <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:flex flex-col items-start">
              <span className="text-sm font-semibold leading-none text-slate-800">
                {user.name || user.email?.split('@')[0]}
              </span>
              {roles.length > 0 && (
                <span className="text-xs text-slate-400 font-normal mt-0.5">{roles[0]}</span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 shadow-xl shadow-blue-900/8 border-slate-200">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-0.5">
              <p className="text-sm font-semibold text-slate-800">{user.name || 'User'}</p>
              <p className="text-xs text-slate-400 font-normal">{user.email}</p>
            </div>
          </DropdownMenuLabel>

          {roles.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 flex flex-wrap gap-1">
                {roles.map((role) => (
                  <Badge
                    key={role}
                    variant="secondary"
                    className="text-xs bg-blue-50 text-blue-700 border-blue-100"
                  >
                    {role}
                  </Badge>
                ))}
              </div>
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile" className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/privacy-policy" className="cursor-pointer">
              <FileText className="mr-2 h-4 w-4" />
              Privacy Policy
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/terms-of-service" className="cursor-pointer">
              <FileText className="mr-2 h-4 w-4" />
              Terms of Service
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <a href="/auth/logout" className="cursor-pointer text-red-500 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
