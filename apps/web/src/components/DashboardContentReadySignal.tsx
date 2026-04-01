'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const DASHBOARD_CONTENT_READY_EVENT = 'dashboard:content-ready';

export function DashboardContentReadySignal({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_CONTENT_READY_EVENT, {
        detail: { pathname },
      })
    );
  }, [pathname]);

  return <>{children}</>;
}
