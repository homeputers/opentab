import { defineConfig } from 'astro/config';

const site = process.env.SITE ?? 'https://example.com';
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site,
  base,
  output: 'static'
});
