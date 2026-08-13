const fs = require('fs');
const path = require('path');

const sourcesDir = path.join(__dirname, '..', 'sources');
const contentDir = path.join(__dirname, '..', 'content');
const jsDir = path.join(__dirname, '..', 'js');

if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });

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
  'developer-guide',
  'testing',
  'libraries'
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
    'introduction': '1. Introduction',
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
    'developer-guide': '12. Developer Getting Started',
    'testing': '13. Testing Suite',
    'libraries': '14. Dependencies & Tech Stack'
  };
  return customTitles[slug] || slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

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
    var headers = headerLine.split('|').map(function(cell) { return cell.trim(); }).filter(function(cell, idx, arr) { return idx > 0 && idx < arr.length - 1 || (idx === 0 && cell !== '') || (idx === arr.length - 1 && cell !== ''); });
    var rows = bodyLines.map(function(line) {
      return line.split('|').map(function(cell) { return cell.trim(); }).filter(function(cell, idx, arr) { return idx > 0 && idx < arr.length - 1 || (idx === 0 && cell !== '') || (idx === arr.length - 1 && cell !== ''); });
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
  const description = '';
  
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
    tags: [slug],
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
    tags: [slug],
    description: description.substring(0, 160),
    sections: ['Overview'],
    sectionsText: sectionsText,
    detailsText: '',
    code: ''
  });
}

const generatedJs = `// Auto-generated by scripts/build.js
window.__BUILD_TIMESTAMP = "${new Date().toISOString()}";

window.__ROUTE_MAP = ${JSON.stringify(routeMap)};

window.__ROUTES = ${JSON.stringify(routeList)};

window.__SEARCH_INDEX = ${JSON.stringify(searchIndex)};
`;

fs.writeFileSync(path.join(jsDir, 'generated.js'), generatedJs);
console.log(`Generated ${contentFiles.length} content JSON files with logical ordering.`);
console.log(`Route map entries: ${Object.keys(routeMap).length}`);
console.log(`Search index entries: ${searchIndex.length}`);
