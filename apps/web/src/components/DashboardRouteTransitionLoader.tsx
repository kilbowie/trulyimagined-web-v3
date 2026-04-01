'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

const DASHBOARD_TRANSITION_EVENT = 'dashboard:transition-start';
const MIN_LOADER_MS = 1500;

export function DashboardRouteTransitionLoader() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const onTransitionStart = () => {
      startTimeRef.current = Date.now();
      setIsVisible(true);
    };

    window.addEventListener(DASHBOARD_TRANSITION_EVENT, onTransitionStart);
    return () => window.removeEventListener(DASHBOARD_TRANSITION_EVENT, onTransitionStart);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_LOADER_MS - elapsed);
    const timeout = window.setTimeout(() => {
      setIsVisible(false);
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [pathname, isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-3xl dark:bg-amber-300/15" />
        <Image
          src="/logo.svg"
          alt="Truly Imagined"
          width={360}
          height={112}
          priority
          className="relative h-auto w-56 sm:w-72 md:w-80 animate-pulse brightness-90 dark:brightness-110"
        />
      </div>
    </div>
  );
}
