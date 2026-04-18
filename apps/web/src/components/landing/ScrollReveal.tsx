'use client';

import { useEffect, useRef, ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  animation?: 'up' | 'left' | 'right' | 'fade';
  delay?: 1 | 2 | 3 | 4;
}

export default function ScrollReveal({
  children,
  className = '',
  animation = 'up',
  delay,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          observer.unobserve(el);
        }
      },
      { rootMargin: '-60px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const delayClass = delay ? ` reveal-delay-${delay}` : '';

  return (
    <div ref={ref} className={`reveal-${animation}${delayClass} ${className}`}>
      {children}
    </div>
  );
}
