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
      sidebar: [
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
        { label: 'Gameplay', items: [{ autogenerate: { directory: 'gameplay' } }] },
        { label: 'World', items: [{ autogenerate: { directory: 'world' } }] },
        { label: 'Characters', items: [{ autogenerate: { directory: 'characters' } }] },
        { label: 'Factions', items: [{ autogenerate: { directory: 'factions' } }] },
        { label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
      ],
    }),
  ],
});
