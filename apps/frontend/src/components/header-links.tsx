import type { SiteWhiteLabelConfig } from '@playwright-reports/shared';
import { Link } from 'react-router-dom';
import {
  BitbucketIcon,
  CyborgTestIcon,
  DiscordIcon,
  GithubIcon,
  LinkIcon,
  SlackIcon,
  TelegramIcon,
} from './icons';

interface HeaderLinksProps {
  config: SiteWhiteLabelConfig;
  withTitle?: boolean;
}

export const HeaderLinks: React.FC<HeaderLinksProps> = ({ config, withTitle = false }) => {
  const links = config?.headerLinks;

  const availableSocialLinkIcons = [
    { name: 'telegram', Icon: TelegramIcon, title: 'Telegram' },
    { name: 'discord', Icon: DiscordIcon, title: 'Discord' },
    { name: 'github', Icon: GithubIcon, title: 'GitHub' },
    { name: 'cyborgTest', Icon: CyborgTestIcon, title: 'Cyborg Test' },
    { name: 'bitbucket', Icon: BitbucketIcon, title: 'Bitbucket' },
    { name: 'slack', Icon: SlackIcon, title: 'Slack' },
  ];

  const socialLinks = Object.entries(links).map(([name, href]) => {
    const availableLink = availableSocialLinkIcons.find((available) => available.name === name);

    const Icon = availableLink?.Icon ?? LinkIcon;
    const title = availableLink?.title ?? name;

    return href ? (
      <Link
        key={name}
        to={href}
        target="_blank"
        rel="noreferrer"
        aria-label={title}
        title={title}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <Icon size={40} />
        {withTitle && <p className="ml-2">{title}</p>}
      </Link>
    ) : null;
  });

  return socialLinks;
};
