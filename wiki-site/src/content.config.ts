import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// The markdown source of truth lives in ../docs/wiki so GitHub readers and the site share one copy.
export const collections = {
  docs: defineCollection({
    loader: glob({ pattern: '**/*.md', base: '../docs/wiki' }),
    schema: docsSchema(),
  }),
};
