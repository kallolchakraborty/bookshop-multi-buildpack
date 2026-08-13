const fs = require('fs');
const path = require('path');

const sourcesDir = path.join(__dirname, '..', 'sources');
const contentDir = path.join(__dirname, '..', 'content');
const jsDir = path.join(__dirname, '..', 'js');
const rootDir = path.join(__dirname, '..');

if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });

// Base URL for SEO & Sitemaps
const SITE_URL = 'https://kallolchakraborty.github.io/bookshop-multi-buildpack';

// Logical learning sequence for developers
const ORDERED_SLUGS = [
  'introduction',
  'architecture',
  'file-structure',
  'buildpacks',
  'server-js',
  'communication',
  'endpoints',
  'services',
  'destinations',
  'configuration',
  'deployment',
  'testing',
  'libraries',
  'support'
];

function scanDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const foundFiles = fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
  const ordered = ORDERED_SLUGS.filter(slug => foundFiles.includes(slug));
  const remaining = foundFiles.filter(slug => !ORDERED_SLUGS.includes(slug)).sort();
  return ordered.concat(remaining).map(slug => `${slug}.md`);
}

function formatTitle(slug) {
  const customTitles = {
    'introduction': '1. README & Overview',
    'architecture': '2. System Architecture',
    'file-structure': '3. File Structure',
    'buildpacks': '4. Multi-Buildpack Mechanism',
    'server-js': '5. Orchestrator (server.js)',
    'communication': '6. IPC & Communication',
    'endpoints': '7. Application Endpoints',
    'services': '8. SAP BTP Services',
    'destinations': '9. Destinations Setup',
    'configuration': '10. Configuration & Envs',
    'deployment': '11. Deployment Modes',
    'testing': '12. Testing Suite',
    'libraries': '13. Dependencies & Tech Stack',
    'support': '14. Enterprise Architecture & Support Guide',
    'developer-guide': 'Developer Guide'
  };
  return customTitles[slug] || slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const customDescriptions = {
  'introduction': 'Comprehensive overview and key features of the SAP BTP BookShop Multi-Buildpack CAP Node.js and Python application.',
  'architecture': 'In-depth architecture diagram, components, and data flow of the co-located CAP Node.js and Python LangGraph system on SAP BTP.',
  'file-structure': 'Complete directory layout and module organization for the Cloud Foundry multi-buildpack bookshop project.',
  'buildpacks': 'Explanation of Cloud Foundry multi-buildpack staging order, compile scripts, and Node.js plus Python droplet packaging.',
  'server-js': 'CAP custom server orchestrator implementation managing Python child processes, health checks, and IPC.',
  'communication': 'Zero-latency JSON-RPC over stdin/stdout IPC communication protocols between Node.js CAP and Python AI agent.',
  'endpoints': 'API reference and interactive guide for OData V4 catalog, orders, and AI chat endpoints.',
  'services': 'SAP BTP backing service configurations including SAP HANA Cloud, Destination Service, XSUAA, and Redis cache.',
  'destinations': 'Configuration and automatic discovery of SAP BTP HTTP and AI Core destinations with fallback cascading.',
  'configuration': 'Environment variables, .env setup, Cloud Foundry manifest properties, and local dev configuration.',
  'deployment': 'Step-by-step deployment guide for local development, hybrid mode with SAP HANA Cloud, and production Cloud Foundry.',
  'testing': 'Automated testing strategy with Jest, CDS test harness, AI mock servers, and HTTP integration requests.',
  'libraries': 'Complete breakdown of runtime dependencies, npm packages, and Python requirements used across the project.',
  'support': 'Enterprise developer and architecture manual with LangGraph, REAL_VECTOR RAG, Redis caching, and guardrail specifications.'
};

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseMarkdown(md) {
  let html = md;
  let codeBlocks = [];

  // Extract raw HTML blocks (e.g. <div class="...">...</div>) before any transforms
  let rawHtmlBlocks = [];
  html = html.replace(/(<div[\s\S]*?<\/div>)/g, function(match) {
    const placeholder = `\x00RAW_HTML_${rawHtmlBlocks.length}\x00`;
    rawHtmlBlocks.push(match);
    return placeholder;
  });

  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'plaintext';
    const placeholder = `\x00CODE_BLOCK_${codeBlocks.length}\x00`;
    codeBlocks.push(`<pre><code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`);
    return placeholder;
  });

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^#{1}\s+(.+)$/gm, '<h1 class="page-title-heading">$1</h1>');
  html = html.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>');

  html = html.replace(/^<h1 class="page-title-heading">.*?<\/h1>/i, '');
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(?:^<li>.*<\/li>$\n?)+/gm, (match) => `<ul>${match}</ul>`);

  var tableBlocks = [];
  html = html.replace(/^(\|.+)\n(\|[-:| ]+\|[-:| ]+\|)\n((?:\|.+\n?)+)/gm, function(match) {
    var placeholder = '\x00TABLE_' + tableBlocks.length + '\x00';
    tableBlocks.push(match);
    return placeholder;
  });

  function parseTableBlock(block) {
    var lines = block.trim().split('\n');
    var headerLine = lines[0];
    var bodyLines = lines.slice(2);
    var headers = headerLine.split('|').map(function(cell) { return cell.trim(); }).filter(function(cell, idx, arr) { return (idx > 0 && idx < arr.length - 1) || (idx === 0 && cell !== '') || (idx === arr.length - 1 && cell !== ''); });
    var rows = bodyLines.map(function(line) {
      return line.split('|').map(function(cell) { return cell.trim(); }).filter(function(cell, idx, arr) { return (idx > 0 && idx < arr.length - 1) || (idx === 0 && cell !== '') || (idx === arr.length - 1 && cell !== ''); });
    });
    var tableHtml = '<div class="table-wrapper"><table><thead><tr>';
    headers.forEach(function(h) { tableHtml += '<th>' + escapeHtml(h) + '</th>'; });
    tableHtml += '</tr></thead><tbody>';
    rows.forEach(function(row) {
      tableHtml += '<tr>';
      row.forEach(function(cell) { tableHtml += '<td>' + escapeHtml(cell) + '</td>'; });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table></div>';
    return tableHtml;
  }

  tableBlocks.forEach(function(block, index) {
    var placeholder = '\x00TABLE_' + index + '\x00';
    html = html.replace(placeholder, parseTableBlock(block));
  });

  var svgPlaceholders = [];
  html = html.replace(/!?\[([^\]]+)\]\(([^)]+)\)/g, function(match, text, url) {
    if (url.endsWith('.svg')) {
      var placeholder = '\x00SVG_PLACEHOLDER_' + svgPlaceholders.length + '\x00';
      svgPlaceholders.push({ text: text, url: url });
      return placeholder;
    }
    if (url.endsWith('.png') || url.endsWith('.jpg')) {
      return '<img src="' + url + '" alt="' + escapeHtml(text) + '" style="max-width:100%;">';
    }
    return '<a href="' + url + '">' + text + '</a>';
  });

  html = html.replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';

  svgPlaceholders.forEach(function(item, index) {
    var placeholder = '\x00SVG_PLACEHOLDER_' + index + '\x00';
    var url = item.url;
    var svgPath = path.join(__dirname, '..', url);
    if (fs.existsSync(svgPath)) {
      var svgContent = fs.readFileSync(svgPath, 'utf-8').replace(/\n/g, '').replace(/\s{2,}/g, ' ');
      html = html.replace(placeholder, '<div class="docs-diagram">' + svgContent + '</div>');
    } else {
      html = html.replace(placeholder, '<div class="docs-diagram"><img src="' + url + '" alt="' + escapeHtml(item.text) + '" style="max-width:100%;"></div>');
    }
  });

  codeBlocks.forEach((block, index) => {
    const placeholder = `\x00CODE_BLOCK_${index}\x00`;
    html = html.replace(placeholder, block);
  });

  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[123]>)/g, '$1');
  html = html.replace(/(<\/h[123]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
  html = html.replace(/<p>(<div)/g, '$1');
  html = html.replace(/(<\/div>)<\/p>/g, '$1');
  html = html.replace(/<p>(<table)/g, '$1');
  html = html.replace(/(<\/table>)<\/p>/g, '$1');

  html = html.replace(/^\s*<h1>.*?<\/h1>\s*/i, '');
  html = html.replace(/^\s*<h2>What is This Project\?<\/h2>\s*/i, '');
  html = html.replace(/^\s*<h2>Overview<\/h2>\s*/i, '');

  // Restore raw HTML blocks
  rawHtmlBlocks.forEach(function(block, index) {
    const placeholder = `\x00RAW_HTML_${index}\x00`;
    html = html.replace(placeholder, block);
  });

  return html;
}

const files = scanDir(sourcesDir);

const routeMap = {};
const routeList = [];
const searchIndex = [];
const contentFiles = [];

for (const file of files) {
  const fullPath = path.join(sourcesDir, file);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const slug = file.replace(/\.md$/, '');
  const title = formatTitle(slug);
  const description = customDescriptions[slug] || `${title} - SAP BTP BookShop Multi-Buildpack documentation.`;
  
  const hash = '#' + slug;
  const contentPath = `content/${slug}.json`;

  const contentItem = {
    id: slug,
    title: title,
    phase: null,
    phaseName: null,
    category: 'Documentation',
    subcategory: slug,
    language: 'markdown',
    description: description,
    sections: [],
    content: parseMarkdown(content),
    tags: [slug, 'sap-btp', 'multi-buildpack', 'cap', 'nodejs', 'python'],
    details: ''
  };

  fs.writeFileSync(path.join(contentDir, `${slug}.json`), JSON.stringify(contentItem));
  contentFiles.push(slug);

  routeMap[hash] = contentPath;

  routeList.push({
    hash: hash,
    key: slug,
    title: title,
    phase: null,
    phaseName: null,
    sections: [{ id: 'overview', title: 'Overview' }]
  });

  const sectionsText = content.replace(/[#*`]/g, ' ').replace(/\n/g, ' ').trim();

  searchIndex.push({
    title: title,
    phase: null,
    phaseName: null,
    category: 'Documentation',
    url: 'docs.html' + hash,
    tags: [slug, 'sap-btp', 'multi-buildpack'],
    description: description.substring(0, 160),
    sections: ['Overview'],
    sectionsText: sectionsText,
    detailsText: '',
    code: ''
  });
}

// Ensure alias for developer-guide routes to support
if (routeMap['#support'] && !routeMap['#developer-guide']) {
  routeMap['#developer-guide'] = routeMap['#support'];
}

const generatedJs = `// Auto-generated by scripts/build.js
window.__BUILD_TIMESTAMP = "${new Date().toISOString()}";

window.__ROUTE_MAP = ${JSON.stringify(routeMap)};

window.__ROUTES = ${JSON.stringify(routeList)};

window.__SEARCH_INDEX = ${JSON.stringify(searchIndex)};
`;

fs.writeFileSync(path.join(jsDir, 'generated.js'), generatedJs);

// Generate sitemap.xml
const today = new Date().toISOString().split('T')[0];
let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/docs.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
`;

for (const slug of contentFiles) {
  const priority = slug === 'introduction' || slug === 'support' ? '0.9' : '0.8';
  sitemapXml += `  <url>
    <loc>${SITE_URL}/docs.html#${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>
`;
}

sitemapXml += `</urlset>\n`;
fs.writeFileSync(path.join(rootDir, 'sitemap.xml'), sitemapXml);

console.log(`Generated ${contentFiles.length} content JSON files with logical ordering.`);
console.log(`Route map entries: ${Object.keys(routeMap).length}`);
console.log(`Search index entries: ${searchIndex.length}`);
console.log(`Updated sitemap.xml with ${contentFiles.length + 2} URLs.`);
