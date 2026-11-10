import { useEffect, useState } from 'react';

// The app has two screens (project list and project detail), so a tiny router on top of
// the History API is enough and avoids a routing dependency.

const NAVIGATE_EVENT = 'app:navigate';

export function navigate(path: string): void {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener(NAVIGATE_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAVIGATE_EVENT, update);
    };
  }, []);
  return pathname;
}

export type Route = { name: 'projects' } | { name: 'project'; id: number } | { name: 'notFound' };

export function matchRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'projects' };
  const match = /^\/projects\/(\d+)\/?$/.exec(pathname);
  if (match?.[1]) return { name: 'project', id: Number(match[1]) };
  return { name: 'notFound' };
}
