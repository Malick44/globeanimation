/**
 * Floating Toast Notification Component
 */

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'info', duration = 3500) {
  const cont = ensureContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const colors = {
    success: '#10b981',
    info: '#06b6d4',
    warning: '#f59e0b',
    error: '#ef4444',
  };

  const accent = colors[type] || colors.info;

  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    background: rgba(13, 17, 26, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-left: 4px solid ${accent};
    border-radius: 10px;
    backdrop-filter: blur(16px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    color: #f8fafc;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 500;
    pointer-events: auto;
    animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    transition: all 0.3s ease;
  `;

  toast.innerHTML = `
    <span style="color: ${accent}; font-size: 18px;">●</span>
    <span>${message}</span>
  `;

  cont.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
