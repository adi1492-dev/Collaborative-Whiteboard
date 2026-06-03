/**
 * Toast — Simple, elegant notification toast system.
 */
class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    `;
    
    // Inject CSS for toasts
    const styleId = 'toast-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .toast-item {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 280px;
          max-width: 400px;
          padding: 12px 16px;
          border-radius: 8px;
          background: rgba(20, 24, 37, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #ffffff;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
          pointer-events: auto;
          animation: toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: all 0.2s ease;
        }
        .toast-item.toast-success {
          border-left: 4px solid #22c55e;
        }
        .toast-item.toast-error {
          border-left: 4px solid #ef4444;
        }
        .toast-item.toast-info {
          border-left: 4px solid #3f3bbd;
        }
        .toast-item.toast-warning {
          border-left: 4px solid #f59e0b;
        }
        .toast-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .toast-success .toast-icon { color: #22c55e; }
        .toast-error .toast-icon { color: #ef4444; }
        .toast-info .toast-icon { color: #8ab4f8; }
        .toast-warning .toast-icon { color: #f59e0b; }
        
        .toast-content {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.4;
          flex: 1;
        }
        .toast-close {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s, color 0.2s;
        }
        .toast-close:hover {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.8);
        }
        
        @keyframes toast-slide-in {
          from {
            transform: translateX(120%) scale(0.9);
            opacity: 0;
          }
          to {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes toast-fade-out {
          to {
            transform: translateX(30%) scale(0.9);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 4000) {
    this.init();
    
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check_circle';
    if (type === 'error') iconName = 'warning';
    if (type === 'warning') iconName = 'person_off';
    
    toast.innerHTML = `
      <div class="toast-icon">
        <span class="material-symbols-outlined">${iconName}</span>
      </div>
      <div class="toast-content">${message}</div>
      <button class="toast-close" aria-label="Close message">
        <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
      </button>
    `;
    
    // Add close action
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = () => this.dismiss(toast);
    
    this.container.appendChild(toast);
    
    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => {
        if (this.container.contains(toast)) {
          this.dismiss(toast);
        }
      }, duration);
    }
    
    return toast;
  }

  showHTML(htmlContent, duration = 0) {
    this.init();
    
    const toast = document.createElement('div');
    toast.className = `toast-item`;
    
    toast.innerHTML = htmlContent;
    
    // Add close action if close button exists
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.dismiss(toast);
    }
    
    this.container.appendChild(toast);
    
    if (duration > 0) {
      setTimeout(() => {
        if (this.container.contains(toast)) {
          this.dismiss(toast);
        }
      }, duration);
    }
    
    return toast;
  }

  dismiss(toast) {
    toast.style.animation = 'toast-fade-out 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }

  success(message) { this.show(message, 'success'); }
  error(message) { this.show(message, 'error'); }
  info(message) { this.show(message, 'info'); }
  warning(message) { this.show(message, 'warning'); }
}

export const Toast = new ToastManager();
