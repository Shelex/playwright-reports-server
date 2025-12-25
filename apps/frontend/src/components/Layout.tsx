import type { ReactNode } from 'react';
import { Aside } from './aside';
import { Navbar } from './navbar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <div className="relative flex flex-col h-screen">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Aside />
          <main className="flex-1 md:ml-0 ml-0 px-6 py-12 overflow-auto">{children}</main>
        </div>
        <footer className="w-full flex items-center justify-center py-4 bg-[#F9FAFB] dark:bg-background border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          <a
            className="flex items-center gap-1 text-current"
            href="https://github.com/Shelex/playwright-reports-server"
            target="_blank"
            rel="noreferrer"
            title="Source code link"
          >
            <span className="text-default-600">Powered by</span>
            <p className="text-primary">CyborgTests</p>
          </a>
        </footer>
      </div>
    </div>
  );
}
