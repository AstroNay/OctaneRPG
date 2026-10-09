import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import remarkWikiLinks from './src/plugins/remark-wiki-links.mjs';

export default defineConfig({
  site: 'https://wiki.octanerpg.com',
  markdown: { remarkPlugins: [remarkWikiLinks] },
  integrations: [
    starlight({
      title: 'OctaneRPG Wiki',
      description: 'The player wiki for OctaneRPG, a retro racing RPG set in Aurora Hills.',
      customCss: ['./src/styles/theme.css'],
      social: [
        { icon: 'discord', label: 'Discord', href: 'https://discord.octanerpg.com/' },
        { icon: 'external', label: 'octanerpg.com', href: 'https://octanerpg.com/' },
      ],
      components: { SiteTitle: './src/components/SiteTitle.astro' },
      favicon: '/favicon.png',
      sidebar: [
        { label: 'Home', slug: 'index' },
        {
          label: 'Getting started',
          items: [
            'getting-started/what-is-octanerpg',
            'getting-started/first-day',
            'getting-started/controls',
            'getting-started/phone',
            'getting-started/accounts-and-founders',
          ],
        },
        {
          label: 'Gameplay',
          items: [
            'gameplay/garage-and-upgrades',
            'gameplay/performance-and-classes',
            'gameplay/racing',
            'gameplay/jobs',
            'gameplay/crime-and-heat',
            'gameplay/junkyard-and-scrapyard',
            'gameplay/inventory',
            'gameplay/gear',
            'gameplay/lottery',
            'gameplay/crews',
            'gameplay/challenges-and-achievements',
          ],
        },
        {
          label: 'World',
          items: ['world/aurora-hills', 'world/districts', 'world/the-docks'],
        },
        {
          label: 'Characters',
          items: [
            'characters',
            'characters/pops',
            'characters/ms-ishida',
            'characters/jun-park',
            'characters/old-mag',
            'characters/sweets',
            'characters/panda',
            'characters/flauntive',
          ],
        },
        {
          label: 'Factions',
          items: ['factions/the-elite-few', 'factions/own-the-pavement', 'factions/tef-vs-otp'],
        },
        {
          label: 'Reference',
          items: [
            'reference/currencies',
            'reference/level-gates',
            'reference/parts',
            'reference/glossary',
            'reference/faq',
            'reference/discord-bot',
          ],
        },
      ],
    }),
  ],
});
