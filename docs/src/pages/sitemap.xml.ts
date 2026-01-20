const pages = ['/', '/spec', '/examples', '/roadmap', '/try-it', '/editors/vscode'];

export const prerender = true;

const formatUrl = (base: string, path: string) => {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return path === '/' ? normalizedBase : `${normalizedBase}${path}`;
};

const buildSitemap = (base: string) => {
  const lastmod = new Date().toISOString();
  const urlset = pages
    .map((path) => {
      const loc = formatUrl(base, path);
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urlset}\n` +
    `</urlset>\n`;
};

export async function GET({ site }) {
  const base = site?.toString() ?? 'https://example.com';
  return new Response(buildSitemap(base), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
}
