import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '../../lib/queryClient';

//Wraps a top-level React island so its descendants can use TanStack Query. Each
//Astro island is its own hydration root, so the top-level island on each page
//wraps itself in this provider; they all share the singleton QueryClient from
//getQueryClient(), so cache is shared across islands within a page.
export default function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
