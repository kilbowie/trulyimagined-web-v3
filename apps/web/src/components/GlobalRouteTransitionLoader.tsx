'use client';

import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

const APP_TRANSITION_START_EVENT = 'app:transition-start';
const DASHBOARD_TRANSITION_START_EVENT = 'dashboard:transition-start';
const MIN_LOADER_MS = 1500;

export function GlobalRouteTransitionLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const [isVisible, setIsVisible] = useState(false);
  const [routeReady, setRouteReady] = useState(false);
  const [inFlightApiRequests, setInFlightApiRequests] = useState(0);
  const startTimeRef = useRef(0);

  const startTransition = () => {
    startTimeRef.current = Date.now();
    setRouteReady(false);
    setIsVisible(true);
  };

  useEffect(() => {
    const handleTransitionEvent = () => {
      startTransition();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) {
        return;
      }

      const nextKey = `${nextUrl.pathname}${nextUrl.search}`;
      const currentKey = `${window.location.pathname}${window.location.search}`;
      if (nextKey === currentKey) {
        return;
      }

      startTransition();
    };

    const handlePopState = () => {
      startTransition();
    };

    window.addEventListener(APP_TRANSITION_START_EVENT, handleTransitionEvent);
    window.addEventListener(DASHBOARD_TRANSITION_START_EVENT, handleTransitionEvent);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener(APP_TRANSITION_START_EVENT, handleTransitionEvent);
      window.removeEventListener(DASHBOARD_TRANSITION_START_EVENT, handleTransitionEvent);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch;

    const wrappedFetch: typeof window.fetch = async (...args) => {
      const [input] = args;
      let requestUrl = '';

      if (typeof input === 'string') {
        requestUrl = input;
      } else if (input instanceof URL) {
        requestUrl = input.toString();
      } else {
        requestUrl = input.url;
      }

      const normalizedUrl = new URL(requestUrl, window.location.origin);
      const isApiRequest =
        normalizedUrl.origin === window.location.origin &&
        normalizedUrl.pathname.startsWith('/api/');

      if (isApiRequest) {
        setInFlightApiRequests((count) => count + 1);
      }

      try {
        return await originalFetch(...args);
      } finally {
        if (isApiRequest) {
          setInFlightApiRequests((count) => Math.max(0, count - 1));
        }
      }
    };

    window.fetch = wrappedFetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    setRouteReady(true);
  }, [routeKey, isVisible]);

  useEffect(() => {
    if (!isVisible || !routeReady || inFlightApiRequests > 0) {
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_LOADER_MS - elapsed);

    const timeout = window.setTimeout(() => {
      setIsVisible(false);
      setRouteReady(false);
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [isVisible, routeReady, inFlightApiRequests]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-sm">
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
