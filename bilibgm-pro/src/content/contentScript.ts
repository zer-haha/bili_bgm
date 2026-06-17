// ============================================
// BiliBGM Pro - Content Script
// ============================================
// 注意: CDN fetch 已改用 chrome.scripting.executeScript(world: 'MAIN')
// 由 service worker 直接注入，不再通过 content script 消息通信
// (原因: B站页面 CSP 禁止 inline script 注入)

// 悬浮按钮
if (!document.getElementById('bilibgm-float-btn')) {
  chrome.storage.local.get('settings', (r) => {
    if ((r.settings || {}).showFloatButton !== false) {
      const b = document.createElement('button');
      b.id = 'bilibgm-float-btn';
      b.title = 'BiliBGM Pro';
      b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>';
      document.body.appendChild(b);
      b.onclick = () => chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_INFO' });
    }
  });
}
