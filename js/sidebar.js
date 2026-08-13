(function() {
  'use strict';

  var escapeHtml = window.DocUtils ? window.DocUtils.escapeHtml : function(s) { return s; };
  var closeMobileSidebar = window.DocUtils ? window.DocUtils.closeMobileSidebar : function() {};

  function initSidebar() {
    var container = document.getElementById('sidebarNav');
    if (!container) return;
    try {
      var routes = window.__ROUTES;
      if (!routes) throw new Error('Site data not loaded');
      
      var iconMap = {
        'introduction': 'info',
        'architecture': 'account_tree',
        'file-structure': 'folder_copy',
        'buildpacks': 'layers',
        'server-js': 'terminal',
        'communication': 'sync_alt',
        'endpoints': 'api',
        'services': 'cloud_sync',
        'destinations': 'hub',
        'configuration': 'tune',
        'deployment': 'rocket_launch',
        'developer-guide': 'code',
        'testing': 'fact_check',
        'libraries': 'inventory_2'
      };

      var html = '<div class="sidebar-label">Documentation</div>';
      routes.forEach(function(route) {
        var title = route.title || route.key;
        var icon = iconMap[route.key] || 'article';
        html += '<a href="' + escapeHtml(route.hash) + '" class="sidebar-link flex items-center gap-2">' +
          '<span class="material-symbols-outlined text-brand-500 text-[18px] shrink-0">' + icon + '</span>' +
          '<span>' + escapeHtml(title) + '</span>' +
          '</a>';
      });
      container.innerHTML = html;

      container.querySelectorAll('.sidebar-link').forEach(function(link) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          var hash = this.getAttribute('href');
          if (hash) {
            window.location.hash = hash;
            if (window.innerWidth < 1024) {
              closeMobileSidebar();
            }
          }
        });
      });
    } catch (err) {
      console.error('Sidebar init failed:', err);
      container.innerHTML = '<p class="text-xs text-slate-400 p-2">Failed to load sidebar navigation.</p>';
    }
  }

  function initMobileToggle() {
    var sidebar = document.getElementById('left-sidebar');
    var backdrop = document.getElementById('sidebar-backdrop');
    var toggle = document.getElementById('sidebar-toggle');
    if (!sidebar || !backdrop || !toggle) return;

    function openSidebar() {
      sidebar.classList.remove('-translate-x-full');
      backdrop.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    toggle.addEventListener('click', function() {
      if (sidebar.classList.contains('-translate-x-full')) {
        openSidebar();
      } else {
        closeMobileSidebar();
      }
    });

    backdrop.addEventListener('click', closeMobileSidebar);

    window.addEventListener('resize', function() {
      if (window.innerWidth >= 1024) {
        backdrop.classList.add('hidden');
        document.body.style.overflow = '';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    initSidebar();
    initMobileToggle();
  });
})();
