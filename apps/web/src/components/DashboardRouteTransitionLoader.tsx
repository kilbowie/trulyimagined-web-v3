'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

const DASHBOARD_TRANSITION_EVENT = 'dashboard:transition-start';
const DASHBOARD_CONTENT_READY_EVENT = 'dashboard:content-ready';
const MIN_LOADER_MS = 1500;

export function DashboardRouteTransitionLoader() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [readyPath, setReadyPath] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const onTransitionStart = (event: Event) => {
      const customEvent = event as CustomEvent<{ href?: string }>;
      startTimeRef.current = Date.now();
      setPendingPath(customEvent.detail?.href || null);
      setReadyPath(null);
      setIsVisible(true);
    };

    const onContentReady = (event: Event) => {
      const customEvent = event as CustomEvent<{ pathname?: string }>;
      if (customEvent.detail?.pathname) {
        setReadyPath(customEvent.detail.pathname);
      }
    };

    window.addEventListener(DASHBOARD_TRANSITION_EVENT, onTransitionStart);
    window.addEventListener(DASHBOARD_CONTENT_READY_EVENT, onContentReady);
    return () => {
      window.removeEventListener(DASHBOARD_TRANSITION_EVENT, onTransitionStart);
      window.removeEventListener(DASHBOARD_CONTENT_READY_EVENT, onContentReady);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const destinationReached = pendingPath ? pathname === pendingPath : true;
    const contentReadyForCurrentPath = readyPath === pathname;

    if (!destinationReached || !contentReadyForCurrentPath) {
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_LOADER_MS - elapsed);
    const timeout = window.setTimeout(() => {
      setIsVisible(false);
      setPendingPath(null);
      setReadyPath(null);
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [pathname, isVisible, pendingPath, readyPath]);

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
