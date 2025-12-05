'use client';

import { Badge, Card, CardBody, Link } from '@heroui/react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { siteConfig } from '../config/site';
import { useAuth } from '../hooks/useAuth';
import { useAuthConfig } from '../hooks/useAuthConfig';
import useQuery from '../hooks/useQuery';
import { ReportIcon, ResultIcon, SettingsIcon, TrendIcon } from './icons';

interface ServerInfo {
  numOfReports: number;
  numOfResults: number;
}

const iconst = [
  { href: '/reports', icon: ReportIcon },
  { href: '/results', icon: ResultIcon },
  { href: '/trends', icon: TrendIcon },
  { href: '/settings', icon: SettingsIcon },
];

export const Aside: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const session = useAuth();
  const { authRequired } = useAuthConfig();
  const isAuthenticated = authRequired === false || session.status === 'authenticated';

  const { data: serverInfo } = useQuery<ServerInfo>('/api/info', {
    enabled: isAuthenticated,
  });

  return (
    <Card className="w-16 h-full rounded-none border-r border-gray-200 dark:border-gray-800 dark:bg-black shadow-none flex-shrink-0">
      <CardBody className="px-2 py-4">
        <div className="space-y-2">
          {siteConfig.navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = iconst.find((icon) => icon.href === item.href)?.icon;
            const count =
              item.href === '/reports'
                ? serverInfo?.numOfReports
                : item.href === '/results'
                  ? serverInfo?.numOfResults
                  : 0;

            return (
              <Link
                key={item.href}
                as={RouterLink}
                className={`relative flex items-center justify-center p-2 my-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[#D4E8F5] dark:bg-black text-primary dark:text-primary'
                    : 'hover:bg-[#EEF7FC] dark:hover:bg-black'
                }`}
                to={item.href}
                isDisabled={!isAuthenticated}
                title={item.label}
              >
                {count !== undefined && count > 0 ? (
                  <Badge
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] font-medium flex items-center justify-center"
                    color="primary"
                    content={count}
                    size="sm"
                  >
                    {Icon && <Icon size={24} />}
                  </Badge>
                ) : (
                  Icon && <Icon size={24} />
                )}
              </Link>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
};
