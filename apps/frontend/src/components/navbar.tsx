'use client';
import {
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuToggle,
  Navbar as NextUINavbar,
} from '@heroui/navbar';
import { Skeleton } from '@heroui/skeleton';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { siteConfig as defaultConfig } from '../config/site';
import useQuery from '../hooks/useQuery';
import { withBase } from '../lib/url';
import type { SiteWhiteLabelConfig } from '@playwright-reports/shared';
import { HeaderLinks } from './header-links';
import { subtitle } from './primitives';
import { ThemeSwitch } from './theme-switch';

export const Navbar: React.FC = () => {
  const { data: config, error, isLoading } = useQuery<SiteWhiteLabelConfig>('/api/config');

  const isCustomLogo = config?.logoPath !== defaultConfig.logoPath;
  const isCustomTitle = config?.title !== defaultConfig.title;

  if (error) {
    toast.error(error.message);
  }

  return (
    <NextUINavbar
      classNames={{
        wrapper:
          'flex flex-row flex-wrap bg-[#F9FAFB] dark:bg-background border-b border-gray-200 dark:border-gray-800 max-w-full',
      }}
      height="3.75rem"
      maxWidth="xl"
      position="sticky"
    >
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <Link className="flex justify-start items-center gap-1" to="/">
            <Skeleton className="rounded-lg" isLoaded={!isLoading && !!config}>
              {config && (
                <img
                  alt="Logo"
                  className={`min-w-10 dark:invert ${isCustomLogo ? 'max-w-10' : ''}`}
                  style={{ height: '31px', width: '174px' }}
                  src={withBase(`/api/static${config?.logoPath}`)}
                />
              )}
            </Skeleton>
          </Link>

          {isCustomTitle && <h1 className={subtitle()}>{config?.title}</h1>}
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex basis-1/5 sm:basis-full" justify="end">
        <NavbarItem className="hidden sm:flex gap-4">
          {config && !isLoading ? (
            <HeaderLinks config={config} />
          ) : (
            <Skeleton className="sm:flex basis-1/5 sm:basis-full" />
          )}
          <ThemeSwitch />
        </NavbarItem>
      </NavbarContent>

      {/* mobile view fallback */}
      <NavbarContent className="sm:hidden basis-1 !justify-end">
        <ThemeSwitch />
        {!!config && <NavbarMenuToggle />}
      </NavbarContent>

      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {config && !isLoading ? (
            <HeaderLinks withTitle config={config} />
          ) : (
            <Skeleton className="w-20" />
          )}
        </div>
      </NavbarMenu>
    </NextUINavbar>
  );
};
