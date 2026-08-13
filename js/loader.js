(function() {
  'use strict';

  var sanitizeHtml = window.DocUtils ? window.DocUtils.sanitizeHtml : function(h) { return h; };
  var escapeHtml = window.DocUtils ? window.DocUtils.escapeHtml : function(s) { return s; };
  var closeMobileSidebar = window.DocUtils ? window.DocUtils.closeMobileSidebar : function() {};
  var copyToClipboard = window.DocUtils ? window.DocUtils.copyToClipboard : function(t) {};

  function injectJsonLd(data) {
    var jsonld = document.getElementById('jsonld-dynamic');
    if (!jsonld) {
      jsonld = document.createElement('script');
      jsonld.id = 'jsonld-dynamic';
      jsonld.type = 'application/ld+json';
      document.head.appendChild(jsonld);
    }
    var schema = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "headline": data.title || '',
      "name": data.title || '',
      "description": data.description || '',
      "url": window.location.href,
      "publisher": { "@type": "Person", "name": "SAP BTP Architect" }
    };
    jsonld.textContent = JSON.stringify(schema);
  }

  function updateMetaTags(title, description) {
    var ogTitle = document.querySelector('meta[property="og:title"]');
    var ogDesc = document.querySelector('meta[property="og:description"]');
    var ogUrl = document.querySelector('meta[property="og:url"]');
    var twTitle = document.querySelector('meta[name="twitter:title"]');
    var twDesc = document.querySelector('meta[name="twitter:description"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    if (ogDesc && description) ogDesc.setAttribute('content', description);
    if (ogUrl) ogUrl.setAttribute('content', window.location.href);
    if (twTitle) twTitle.setAttribute('content', title);
    if (twDesc && description) twDesc.setAttribute('content', description);
  }

  var main = document.getElementById('docs-dynamic-content');
  var rightOutline = document.getElementById('docs-right-outline');
  var shareUrlInput = document.getElementById('share-url-input');
  var shareTrigger = document.querySelector('.open-share-btn');

  var loadingHTML = '<div class="flex items-center justify-center py-20"><div class="flex items-center gap-3 text-slate-400"><span class="material-symbols-outlined text-[24px] animate-spin text-brand-500">progress_activity</span><span class="text-sm font-medium">Loading documentation...</span></div></div>';
  var errorHTML = '<div class="text-center py-20"><div class="text-slate-400 mb-4"><span class="material-symbols-outlined text-[48px] text-red-500">error_outline</span></div><p class="text-slate-600 dark:text-slate-400 text-sm mb-4 font-medium">Failed to load content. Please try again.</p><button id="retryBtn" class="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-all shadow-md">Retry</button></div>';

  var routeMap = window.__ROUTE_MAP || {};
  var contentCache = {};
  var currentHash = null;
  var scrollObserver = null;

  function setActiveLink(hash) {
    var links = document.querySelectorAll('#left-sidebar .sidebar-link');
    links.forEach(function(link) {
      var href = link.getAttribute('href');
      if (href === hash) {
        link.classList.add('active-doc-link');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active-doc-link');
        link.removeAttribute('aria-current');
      }
    });
  }

  function updatePageTitle(title, description, phase, phaseName) {
    document.title = title + ' — bookshop-multi-buildpack';
    updateMetaTags(title + ' — bookshop-multi-buildpack', description);
    var badgeHtml = '';
    if (phase !== undefined && phase !== null) {
      badgeHtml = '<span class="phase-badge">' + escapeHtml(phaseName || ('Phase ' + phase)) + '</span>';
    }
    
    var iconMap = {
      '1. Introduction': 'info',
      '2. System Architecture': 'account_tree',
      '3. File Structure': 'folder_copy',
      '4. Multi-Buildpack Mechanism': 'layers',
      '5. Orchestrator (server.js)': 'terminal',
      '6. IPC & Communication': 'sync_alt',
      '7. Application Endpoints': 'api',
      '8. SAP BTP Services': 'cloud_sync',
      '9. Destinations Setup': 'hub',
      '10. Configuration & Envs': 'tune',
      '11. Deployment Modes': 'rocket_launch',
      '12. Developer Getting Started': 'code',
      '13. Testing Suite': 'fact_check',
      '14. Dependencies & Tech Stack': 'inventory_2'
    };
    var icon = iconMap[title] || 'article';

    return '<div class="mb-4 flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/80 pb-3">' + 
           (badgeHtml ? '<div class="flex">' + badgeHtml + '</div>' : '') +
           '<div class="flex items-center gap-3">' +
           '<div class="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[24px]">' + icon + '</span></div>' +
           '<h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">' + escapeHtml(title) + '</h1>' + 
           '</div>' +
           '</div>';
  }

  function updateShareUrl(hash) {
    if (!shareUrlInput) return;
    var url = window.location.origin + window.location.pathname + hash;
    shareUrlInput.value = url;
    if (shareTrigger) {
      shareTrigger.setAttribute('data-href', url);
    }
    window.history.replaceState(null, '', hash);
  }

  function fetchWithRetry(path, maxAttempts) {
    var lastErr;
    function attempt(n) {
      return fetch(path, { cache: 'no-cache' }).then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).catch(function(err) {
        lastErr = err;
        if (n < maxAttempts) {
          return new Promise(function(resolve) {
            setTimeout(function() { resolve(attempt(n + 1)); }, Math.min(1000, 200 * n));
          });
        }
        throw lastErr;
      });
    }
    return attempt(1);
  }

  function renderContent(data, hash) {
    if (!main) return;
    var title = data.title || data.id || hash.replace('#', '');
    var description = data.description || '';
    var sectionsHtml = data.content || '';

    var header = updatePageTitle(title, description, data.phase, data.phaseName);

    main.innerHTML = header + '<div class="content space-y-6">' + sanitizeHtml(sectionsHtml) + '</div>';

    injectJsonLd(data);

    // Code block enhancements (Copy Code buttons)
    main.querySelectorAll('pre').forEach(function(pre) {
      var code = pre.querySelector('code');
      if (!code) return;
      var rawCode = code.textContent || code.innerText || '';

      var wrapper = document.createElement('div');
      wrapper.className = 'code-wrapper relative group';

      var copyBtn = document.createElement('button');
      copyBtn.className = 'copy-code-btn opacity-80 hover:opacity-100';
      copyBtn.setAttribute('aria-label', 'Copy code snippet');
      copyBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">content_copy</span>';
      
      copyBtn.addEventListener('click', function() {
        copyToClipboard(rawCode, 'Code copied to clipboard!');
        copyBtn.innerHTML = '<span class="material-symbols-outlined text-[16px] text-green-400">check</span>';
        setTimeout(function() {
          copyBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">content_copy</span>';
        }, 2000);
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
      wrapper.appendChild(copyBtn);

      if (typeof hljs !== 'undefined') {
        hljs.highlightElement(code);
      }
    });

    updateRightOutline();
    updateShareUrl(hash);
    setActiveLink(hash);
    setupScrollSpy();
  }

  function updateRightOutline() {
    if (!rightOutline) return;
    var h2s = main.querySelectorAll('h2');
    if (!h2s.length) {
      rightOutline.innerHTML = '<p class="text-xs text-slate-400 italic">No section headings</p>';
      return;
    }

    var html = '';
    h2s.forEach(function(h2, idx) {
      var id = h2.getAttribute('id');
      if (!id) {
        id = 'heading-' + idx + '-' + h2.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        h2.setAttribute('id', id);
      }
      html += '<a href="#' + id + '" class="block text-slate-500 hover:text-brand-500 dark:text-slate-400 dark:hover:text-brand-400 text-xs py-1 transition-colors outline-link">' + escapeHtml(h2.textContent) + '</a>';
    });
    rightOutline.innerHTML = html;

    rightOutline.querySelectorAll('.outline-link').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var targetId = this.getAttribute('href').replace('#', '');
        var target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  function setupScrollSpy() {
    if (scrollObserver) scrollObserver.disconnect();
    var h2s = main.querySelectorAll('h2');
    if (!h2s.length || !rightOutline) return;

    scrollObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var id = entry.target.getAttribute('id');
          var links = rightOutline.querySelectorAll('.outline-link');
          links.forEach(function(l) {
            if (l.getAttribute('href') === '#' + id) {
              l.classList.add('active-outline-link');
            } else {
              l.classList.remove('active-outline-link');
            }
          });
        }
      });
    }, { rootMargin: '-60px 0px -70% 0px' });

    h2s.forEach(function(h2) { scrollObserver.observe(h2); });
  }

  function getCleanHash(hash) {
    if (!hash) return null;
    var base = hash.split('?')[0].split('#')[1];
    if (!base) return null;
    // Extract base page route slug (e.g., #architecture from #architecture or #architecture-main-architecture)
    var routeMap = window.__ROUTE_MAP || {};
    if (routeMap['#' + base]) return '#' + base;
    // Try matching prefix if heading sub-id is attached
    var keys = Object.keys(routeMap);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i].replace('#', '');
      if (base.indexOf(k) === 0) return keys[i];
    }
    return '#' + base;
  }

  function loadContent(rawHash) {
    var map = window.__ROUTE_MAP || routeMap || {};
    var hash = getCleanHash(rawHash);
    if (!hash) return;
    if (currentHash === hash) return;
    currentHash = hash;

    var contentPath = map[hash];
    if (!contentPath) {
      main.innerHTML = errorHTML;
      return;
    }

    main.innerHTML = loadingHTML;
    setActiveLink(hash);

    var cached = contentCache[hash];
    if (cached) {
      renderContent(cached, hash);
      return;
    }

    fetchWithRetry(contentPath, 3)
      .then(function(data) {
        contentCache[hash] = data;
        renderContent(data, hash);
      })
      .catch(function(err) {
        console.error('Failed to load content:', err);
        main.innerHTML = errorHTML;
        var retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
          retryBtn.addEventListener('click', function() { 
            currentHash = null;
            loadContent(hash); 
          });
        }
      });
  }

  window.addEventListener('hashchange', function() {
    loadContent(window.location.hash);
  });

  document.addEventListener('DOMContentLoaded', function() {
    var map = window.__ROUTE_MAP || routeMap || {};
    var hash = window.location.hash;
    var clean = getCleanHash(hash);
    if (!clean || !map[clean]) {
      clean = Object.keys(map)[0] || '#introduction';
    }
    loadContent(clean);
  });
})();
