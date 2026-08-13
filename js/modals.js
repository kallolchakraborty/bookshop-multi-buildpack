(function() {
  'use strict';

  var sanitizeHtml = window.DocUtils ? window.DocUtils.sanitizeHtml : function(h) { return h; };
  var escapeHtml = window.DocUtils ? window.DocUtils.escapeHtml : function(s) { return s; };
  var copyToClipboard = window.DocUtils ? window.DocUtils.copyToClipboard : function(t) {};

  var searchModal = document.getElementById('search-modal');
  var searchInput = document.getElementById('modal-search-input');
  var searchResults = document.getElementById('modal-search-results');
  var searchBackdrop = document.getElementById('search-modal-backdrop');
  var closeSearch = document.getElementById('close-search-modal');
  var searchTriggers = document.querySelectorAll('.open-search-btn');

  var shareModal = document.getElementById('share-modal');
  var shareBackdrop = document.getElementById('share-modal-backdrop');
  var closeShare = document.getElementById('close-share-modal');
  var shareTriggers = document.querySelectorAll('.open-share-btn');
  var shareUrlInput = document.getElementById('share-url-input');
  var copyBtn = document.getElementById('copy-link-btn');

  var fuse = null;
  var lastResults = [];
  var selectedIdx = -1;
  var lastFocused = null;

  function initFuse() {
    var index = [];
    try { index = window.__SEARCH_INDEX || []; } catch(e) {}
    if (!index.length) return;
    fuse = new Fuse(index, {
      keys: [
        { name: 'title', weight: 3 },
        { name: 'description', weight: 2 },
        { name: 'tags', weight: 2 },
        { name: 'sectionsText', weight: 1.5 },
        { name: 'code', weight: 1.5 },
        { name: 'detailsText', weight: 1 },
        { name: 'category', weight: 1 }
      ],
      threshold: 0.4,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2
    });
  }

  function highlightText(text, matches, key) {
    if (!matches || !matches.length) return escapeHtml(text);
    var fieldMatches = matches.filter(function(m) { return m.key === key; });
    if (!fieldMatches.length) return escapeHtml(text);

    var indices = [];
    fieldMatches.forEach(function(m) {
      (m.indices || []).forEach(function(idx) {
        indices.push(idx);
      });
    });
    if (!indices.length) return escapeHtml(text);

    indices.sort(function(a, b) { return a[0] - b[0]; });

    var result = '';
    var lastEnd = 0;
    for (var i = 0; i < indices.length; i++) {
      var start = indices[i][0];
      var end = indices[i][1] + 1;
      if (start < lastEnd) continue;
      result += escapeHtml(text.substring(lastEnd, start));
      result += '<mark>' + escapeHtml(text.substring(start, end)) + '</mark>';
      lastEnd = end;
    }
    result += escapeHtml(text.substring(lastEnd));
    return result;
  }

  function openSearch() {
    if (!searchModal) return;
    lastFocused = document.activeElement;
    searchModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    selectedIdx = -1;
    setTimeout(function() {
      if (searchInput) {
        searchInput.focus();
        if (searchInput.value) performSearch(searchInput.value);
      }
    }, 50);
  }

  function closeSearchModal() {
    if (!searchModal) return;
    searchModal.classList.add('hidden');
    document.body.style.overflow = '';
    if (searchInput) searchInput.value = '';
    if (searchResults) {
      searchResults.innerHTML = '<div class="p-6 text-center text-slate-400 text-sm font-medium">Type to search documentation...</div>';
    }
    lastResults = [];
    selectedIdx = -1;
    if (lastFocused) { lastFocused.focus(); lastFocused = null; }
  }

  function openShare() {
    if (!shareModal) return;
    lastFocused = document.activeElement;
    shareModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (shareUrlInput) {
      shareUrlInput.value = window.location.href;
      shareUrlInput.focus();
      shareUrlInput.select();
    }
  }

  function closeShareModal() {
    if (!shareModal) return;
    shareModal.classList.add('hidden');
    document.body.style.overflow = '';
    if (lastFocused) { lastFocused.focus(); lastFocused = null; }
  }

  function navigateResults(dir) {
    if (!lastResults.length || !searchResults) return;
    var items = searchResults.querySelectorAll('.search-result-item');
    if (!items.length) return;

    if (selectedIdx >= 0 && items[selectedIdx]) {
      items[selectedIdx].classList.remove('bg-brand-500/10', 'dark:bg-brand-500/20');
    }

    selectedIdx += dir;
    if (selectedIdx < 0) selectedIdx = 0;
    if (selectedIdx >= items.length) selectedIdx = items.length - 1;

    items[selectedIdx].classList.add('bg-brand-500/10', 'dark:bg-brand-500/20');
    items[selectedIdx].scrollIntoView({ block: 'nearest' });
  }

  function performSearch(query) {
    if (!searchResults) return;
    var q = query.trim();
    if (!q) {
      searchResults.innerHTML = '<div class="p-6 text-center text-slate-400 text-sm font-medium">Type to search documentation...</div>';
      lastResults = [];
      selectedIdx = -1;
      return;
    }

    if (!fuse) initFuse();
    var results = fuse ? fuse.search(q) : [];
    lastResults = results;
    selectedIdx = -1;

    if (!results.length) {
      searchResults.innerHTML = '<div class="p-6 text-center text-slate-400 text-sm font-medium">No documentation found for "' + escapeHtml(q) + '"</div>';
      return;
    }

    var html = '<div class="divide-y divide-slate-100 dark:divide-slate-800/60">';
    html += results.slice(0, 15).map(function(result, idx) {
      var item = result.item;
      var matches = result.matches || [];
      var desc = item.description || '';
      var descHighlighted = highlightText(desc.substring(0, 180), matches, 'description');
      var titleHighlighted = highlightText(item.title, matches, 'title');

      return '<a href="' + escapeHtml(item.url) + '" class="search-result-item block p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors" data-index="' + idx + '">' +
        '<div class="flex items-center justify-between mb-1">' +
          '<span class="text-xs font-semibold text-brand-500 uppercase tracking-wider">' + escapeHtml(item.category || 'Docs') + '</span>' +
          '<span class="text-[11px] font-mono text-slate-400">' + escapeHtml(item.url.replace('docs.html', '')) + '</span>' +
        '</div>' +
        '<div class="text-sm font-bold text-slate-900 dark:text-white mb-1">' + titleHighlighted + '</div>' +
        (desc ? '<div class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">' + descHighlighted + '</div>' : '') +
        '</a>';
    }).join('');
    html += '</div>';

    var metaHtml = '<div class="px-4 py-2 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">' + results.length + ' result' + (results.length !== 1 ? 's' : '') + ' found</div>';
    searchResults.innerHTML = metaHtml + html;
  }

  searchTriggers.forEach(function(t) {
    t.addEventListener('click', openSearch);
  });

  if (closeSearch) closeSearch.addEventListener('click', closeSearchModal);
  if (searchBackdrop) searchBackdrop.addEventListener('click', closeSearchModal);

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      performSearch(this.value);
    });
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeSearchModal();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateResults(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateResults(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIdx >= 0 && lastResults[selectedIdx]) {
          window.location.href = lastResults[selectedIdx].item.url;
          closeSearchModal();
        }
      }
    });
  }

  if (searchResults) {
    searchResults.addEventListener('click', function(e) {
      var item = e.target.closest('.search-result-item');
      if (item) {
        closeSearchModal();
      }
    });
  }

  shareTriggers.forEach(function(t) {
    t.addEventListener('click', openShare);
  });

  if (closeShare) closeShare.addEventListener('click', closeShareModal);
  if (shareBackdrop) shareBackdrop.addEventListener('click', closeShareModal);

  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      if (!shareUrlInput) return;
      copyToClipboard(shareUrlInput.value, 'Documentation URL copied to clipboard!');
      closeShareModal();
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (searchModal && !searchModal.classList.contains('hidden')) closeSearchModal();
      if (shareModal && !shareModal.classList.contains('hidden')) closeShareModal();
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (searchModal && searchModal.classList.contains('hidden')) {
        openSearch();
      } else {
        closeSearchModal();
      }
    }
  });

  initFuse();
})();
