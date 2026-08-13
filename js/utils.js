(function(window) {
  'use strict';

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeHtml(html) {
    if (!html) return '';
    var doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = html;
    Array.from(doc.body.querySelectorAll('*')).forEach(function(el) {
      Array.from(el.attributes).forEach(function(attr) {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
        if (attr.name === 'href' && /^\s*javascript:/i.test(attr.value)) el.removeAttribute('href');
      });
    });
    Array.from(doc.body.querySelectorAll('script, iframe, object, embed')).forEach(function(el) { el.remove(); });
    return doc.body.innerHTML;
  }

  function showToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    var bgClass = type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white dark:bg-white dark:text-slate-900';
    toast.className = 'pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium transition-all duration-300 transform translate-y-4 opacity-0 ' + bgClass;
    
    var icon = type === 'error' ? 'error' : 'check_circle';
    toast.innerHTML = '<span class="material-symbols-outlined text-[18px]">' + icon + '</span><span>' + escapeHtml(message) + '</span>';
    
    container.appendChild(toast);

    requestAnimationFrame(function() {
      toast.classList.remove('translate-y-4', 'opacity-0');
    });

    setTimeout(function() {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2500);
  }

  function copyToClipboard(text, successMsg) {
    successMsg = successMsg || 'Copied to clipboard!';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function() {
        showToast(successMsg);
      }).catch(function() {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    var textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg);
    } catch (err) {
      showToast('Failed to copy', 'error');
    }
    document.body.removeChild(textArea);
  }

  function closeMobileSidebar() {
    var sidebar = document.getElementById('left-sidebar');
    var backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar && backdrop && !backdrop.classList.contains('hidden')) {
      sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  window.DocUtils = {
    escapeHtml: escapeHtml,
    sanitizeHtml: sanitizeHtml,
    showToast: showToast,
    copyToClipboard: copyToClipboard,
    closeMobileSidebar: closeMobileSidebar
  };
})(window);
