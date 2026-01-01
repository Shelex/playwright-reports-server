import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Navbar } from './layout/navbar';

interface LayoutProps {
  children?: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="flex min-h-screen flex-col">
        <Navbar />

        <main className={cn('flex-1', 'container', 'py-6 md:py-8')}>{children || <Outlet />}</main>

        <footer className="border-t border-border/40 py-4">
          <div className="container flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Powered by</span>
            <a
              href="https://www.cyborgtest.com/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              CyborgTests
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
