/**
 * DashboardPage — Displays user's boards and allows creating new ones.
 * Features: grid layout, empty states, create modal, search filtering.
 */
export class DashboardPage {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.boards = [];
    this.searchQuery = '';
    this.render();
    this.fetchBoards();
  }

  render() {
    const user = this.app.auth.getUser();

    this.root.innerHTML = `
      <div class="dashboard-layout">
        <!-- Sidebar -->
        <aside class="dashboard-sidebar glass">
          <div class="sidebar-brand">
            <a href="#/" class="headline-md" style="color: var(--primary); text-decoration: none; font-weight: 900;">CanvasFlow</a>
          </div>

          <nav class="sidebar-nav">
            <a href="#/dashboard" class="sidebar-link active">
              <span class="material-symbols-outlined">dashboard</span>
              All Boards
            </a>
            <a href="#" class="sidebar-link">
              <span class="material-symbols-outlined">schedule</span>
              Recent
            </a>
            <a href="#" class="sidebar-link">
              <span class="material-symbols-outlined">star</span>
              Starred
            </a>
            <a href="#" class="sidebar-link">
              <span class="material-symbols-outlined">folder_shared</span>
              Shared with me
            </a>
          </nav>

          <div class="sidebar-footer">
            <div class="user-profile">
              <div class="user-avatar" style="background: ${user.avatarColor};">${this._getInitials(user.displayName)}</div>
              <div class="user-info truncate">
                <div class="label-md truncate">${user.displayName}</div>
                <div class="label-sm truncate" style="color: var(--on-surface-variant); text-transform: none;">${user.email}</div>
              </div>
            </div>
            <button class="btn btn-ghost" id="logout-btn" aria-label="Sign out" style="padding: 8px;">
              <span class="material-symbols-outlined">logout</span>
            </button>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="dashboard-main">
          <header class="dashboard-header">
            <h1 class="headline-lg">Your Workspace</h1>
            
            <div class="header-actions">
              <div class="search-bar">
                <span class="material-symbols-outlined">search</span>
                <input type="text" id="search-input" class="input" placeholder="Search boards..." />
              </div>
              
              <button class="btn btn-primary" id="create-board-btn">
                <span class="material-symbols-outlined" style="font-size:18px;">add</span>
                New Board
              </button>
            </div>
          </header>

          <div class="dashboard-content" id="boards-container">
            <!-- Loading state -->
            <div class="empty-state">
              <div class="loading-spinner"></div>
              <p class="body-sm" style="color: var(--on-surface-variant); margin-top: var(--space-md);">Loading boards...</p>
            </div>
          </div>
        </main>

        <!-- Create Board Modal (Hidden by default) -->
        <div class="modal-overlay" id="create-modal" style="display: none;">
          <div class="modal-content glass elevation-3 anim-slide-up">
            <div class="modal-header">
              <h2 class="headline-md">Create New Board</h2>
              <button class="modal-close" id="close-modal-btn">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form id="create-board-form">
              <div class="form-group">
                <label for="board-title" class="form-label">Board Title</label>
                <input type="text" id="board-title" class="input" placeholder="e.g. Architecture Brainstorm" required autofocus />
              </div>
              
              <div class="form-group">
                <label class="form-label">Background Pattern</label>
                <div class="background-picker">
                  <label class="bg-option">
                    <input type="radio" name="board-bg" value="grid" checked />
                    <div class="bg-preview bg-grid-pattern"></div>
                    <span class="label-sm">Grid</span>
                  </label>
                  <label class="bg-option">
                    <input type="radio" name="board-bg" value="dots" />
                    <div class="bg-preview bg-dots-pattern" style="background-image: radial-gradient(var(--grid-color) 2px, transparent 2px); background-size: 24px 24px;"></div>
                    <span class="label-sm">Dots</span>
                  </label>
                  <label class="bg-option">
                    <input type="radio" name="board-bg" value="blank" />
                    <div class="bg-preview bg-blank-pattern"></div>
                    <span class="label-sm">Blank</span>
                  </label>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-ghost" id="cancel-modal-btn">Cancel</button>
                <button type="submit" class="btn btn-primary" id="submit-board-btn">Create Board</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Inject Dashboard specific styles if not present
    this._injectStyles();
    this._bindEvents();
  }

  async fetchBoards() {
    try {
      const res = await this.app.auth.apiFetch('/api/boards');
      if (res.ok) {
        const data = await res.json();
        this.boards = data.boards || [];
        this.renderBoards();
      } else {
        this._showError('Failed to load boards');
      }
    } catch (err) {
      this._showError('Network error while loading boards');
    }
  }

  renderBoards() {
    const container = this.root.querySelector('#boards-container');
    
    // Filter boards based on search
    const filtered = this.searchQuery 
      ? this.boards.filter(b => b.title.toLowerCase().includes(this.searchQuery.toLowerCase()))
      : this.boards;

    if (this.boards.length === 0) {
      // Complete empty state
      container.innerHTML = `
        <div class="empty-state anim-fade-in">
          <div class="empty-icon">
            <span class="material-symbols-outlined" style="font-size: 48px; color: var(--primary);">dashboard_customize</span>
          </div>
          <h3 class="headline-md" style="margin-bottom: 8px;">No boards yet</h3>
          <p class="body-lg" style="color: var(--on-surface-variant); max-width: 350px; margin-bottom: var(--space-xl);">
            Create your first whiteboard to start collaborating with your team.
          </p>
          <button class="btn btn-primary glow-primary" onclick="document.getElementById('create-board-btn').click()">
            <span class="material-symbols-outlined" style="font-size:18px;">add</span>
            Create New Board
          </button>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      // Search empty state
      container.innerHTML = `
        <div class="empty-state anim-fade-in">
          <span class="material-symbols-outlined" style="font-size: 48px; color: var(--outline-variant); margin-bottom: 16px;">search_off</span>
          <h3 class="headline-md" style="margin-bottom: 8px;">No results found</h3>
          <p class="body-lg" style="color: var(--on-surface-variant);">Try adjusting your search query.</p>
        </div>
      `;
      return;
    }

    // Render grid
    const gridHtml = `
      <div class="board-grid anim-fade-in">
        ${filtered.map(board => `
          <a href="#/board/${board.boardId}" class="board-card">
            <div class="board-preview ${board.background === 'grid' ? 'bg-grid-pattern' : ''}">
              <div class="board-overlay">
                <span class="btn btn-primary" style="padding: 8px 16px; border-radius: 20px;">Open Board</span>
              </div>
            </div>
            <div class="board-info">
              <h4 class="headline-sm truncate" style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">${this._escapeHtml(board.title)}</h4>
              <p class="label-sm" style="color: var(--on-surface-variant); text-transform: none;">
                Updated ${this._formatDate(board.updatedAt)}
              </p>
            </div>
          </a>
        `).join('')}
      </div>
    `;

    container.innerHTML = gridHtml;
  }

  _bindEvents() {
    // Search
    const searchInput = this.root.querySelector('#search-input');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderBoards();
    });

    // Logout
    this.root.querySelector('#logout-btn')?.addEventListener('click', async () => {
      await this.app.auth.logout();
      this.app.navigate('/login');
    });

    // Modal toggles
    const modal = this.root.querySelector('#create-modal');
    
    this.root.querySelector('#create-board-btn')?.addEventListener('click', () => {
      modal.style.display = 'flex';
      setTimeout(() => this.root.querySelector('#board-title')?.focus(), 50);
    });

    const closeModal = () => {
      modal.style.display = 'none';
      this.root.querySelector('#create-board-form').reset();
    };

    this.root.querySelector('#close-modal-btn')?.addEventListener('click', closeModal);
    this.root.querySelector('#cancel-modal-btn')?.addEventListener('click', closeModal);
    
    // Close modal on click outside
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Form submit
    this.root.querySelector('#create-board-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = this.root.querySelector('#board-title').value.trim();
      const bgInput = this.root.querySelector('input[name="board-bg"]:checked');
      const background = bgInput ? bgInput.value : 'grid';
      const submitBtn = this.root.querySelector('#submit-board-btn');

      submitBtn.classList.add('btn-loading');
      submitBtn.disabled = true;

      try {
        const res = await this.app.auth.apiFetch('/api/boards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, background })
        });

        if (res.ok) {
          const data = await res.json();
          closeModal();
          // Navigate to new board
          this.app.navigate(`/board/${data.board.boardId}`);
        } else {
          alert('Failed to create board');
        }
      } catch (err) {
        alert('Network error');
      } finally {
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
      }
    });
  }

  _getInitials(name) {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  _formatDate(dateString) {
    const d = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  _escapeHtml(unsafe) {
    return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  _showError(msg) {
    const container = this.root.querySelector('#boards-container');
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined" style="font-size: 48px; color: var(--error); margin-bottom: 16px;">error_outline</span>
        <h3 class="headline-md" style="color: var(--error);">${msg}</h3>
        <button class="btn btn-outline" style="margin-top: var(--space-lg);" onclick="window.location.reload()">Retry</button>
      </div>
    `;
  }

  _injectStyles() {
    if (!document.getElementById('dashboard-styles')) {
      const style = document.createElement('style');
      style.id = 'dashboard-styles';
      style.textContent = `
        /* Dashboard Layout */
        .dashboard-layout { display: flex; height: 100vh; overflow: hidden; background: var(--surface); }
        
        /* Sidebar */
        .dashboard-sidebar {
          width: 260px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          background: var(--surface-container-low);
          z-index: 20;
        }
        [data-theme="light"] .dashboard-sidebar { border-right-color: var(--outline-variant); }
        
        .sidebar-brand { padding: var(--space-xl) var(--space-xl) var(--space-md); }
        
        .sidebar-nav { flex: 1; padding: 0 var(--space-md); display: flex; flex-direction: column; gap: 4px; }
        
        .sidebar-link {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 16px; border-radius: var(--radius);
          color: var(--on-surface-variant); text-decoration: none; font-weight: 500; font-size: 14px;
          transition: all 0.2s;
        }
        .sidebar-link:hover { color: var(--on-surface); background: rgba(255, 255, 255, 0.05); }
        [data-theme="light"] .sidebar-link:hover { background: rgba(0, 0, 0, 0.04); }
        
        .sidebar-link.active { color: var(--primary); background: rgba(192, 193, 255, 0.1); }
        [data-theme="light"] .sidebar-link.active { background: rgba(63, 59, 189, 0.08); }
        
        .sidebar-link .material-symbols-outlined { font-size: 20px; }
        
        /* Sidebar Footer (User) */
        .sidebar-footer {
          padding: var(--space-md); border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        [data-theme="light"] .sidebar-footer { border-top-color: var(--outline-variant); }
        
        .user-profile { display: flex; align-items: center; gap: 12px; overflow: hidden; }
        .user-avatar {
          width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-label); font-weight: 600; font-size: 12px; color: var(--surface);
        }
        .user-info { min-width: 0; }
        
        /* Main Content */
        .dashboard-main { flex: 1; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; }
        
        .dashboard-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 40px var(--space-xl) var(--space-lg);
        }
        
        .header-actions { display: flex; align-items: center; gap: var(--space-lg); }
        
        .search-bar { position: relative; width: 300px; }
        .search-bar .material-symbols-outlined {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          color: var(--outline); font-size: 20px; pointer-events: none;
        }
        .search-bar .input { padding-left: 40px; background: var(--surface-container-lowest); }
        
        .dashboard-content { flex: 1; padding: 0 var(--space-xl) var(--space-xl); }
        
        /* Board Grid */
        .board-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--space-lg);
        }
        
        .board-card {
          display: flex; flex-direction: column;
          background: var(--surface-container-low); border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-lg); overflow: hidden; text-decoration: none; color: inherit;
          transition: all 0.2s ease;
        }
        [data-theme="light"] .board-card { border-color: var(--outline-variant); background: var(--surface-container-lowest); }
        
        .board-card:hover { border-color: rgba(192, 193, 255, 0.3); transform: translateY(-2px); box-shadow: 0 10px 20px -5px rgba(0,0,0,0.2); }
        [data-theme="light"] .board-card:hover { border-color: var(--primary); box-shadow: 0 10px 20px -5px rgba(0,0,0,0.05); }
        
        .board-preview {
          height: 160px; position: relative; background-color: var(--surface-container-lowest);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: center;
        }
        [data-theme="light"] .board-preview { border-bottom-color: var(--outline-variant); background-color: var(--surface-container-low); }
        
        .board-overlay {
          position: absolute; inset: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;
        }
        .board-card:hover .board-overlay { opacity: 1; }
        
        .board-info { padding: var(--space-md); }
        
        /* Empty State */
        .empty-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 400px; text-align: center; border: 1px dashed var(--outline-variant);
          border-radius: var(--radius-lg); margin-top: var(--space-md);
        }
        
        .empty-icon {
          width: 80px; height: 80px; border-radius: 50%; background: rgba(192, 193, 255, 0.1);
          display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-md);
        }
        [data-theme="light"] .empty-icon { background: rgba(63, 59, 189, 0.08); }
        
        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
          z-index: 100; display: flex; align-items: center; justify-content: center;
        }
        .modal-content {
          width: 100%; max-width: 500px; padding: var(--space-xl); border-radius: var(--radius-xl);
          background: var(--surface-container);
        }
        [data-theme="light"] .modal-content { background: var(--surface-container-lowest); }
        
        .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xl); }
        
        .modal-close {
          background: none; border: none; color: var(--outline); cursor: pointer;
          display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%;
        }
        .modal-close:hover { color: var(--on-surface); background: rgba(255, 255, 255, 0.05); }
        
        .modal-actions { display: flex; justify-content: flex-end; gap: var(--space-md); margin-top: var(--space-xl); }
        
        /* Background Picker (Radio Cards) */
        .background-picker { display: flex; gap: var(--space-md); margin-top: 8px; }
        
        .bg-option { flex: 1; cursor: pointer; text-align: center; }
        .bg-option input { display: none; }
        
        .bg-preview {
          height: 80px; border-radius: var(--radius); border: 2px solid var(--outline-variant);
          margin-bottom: 8px; transition: all 0.2s; background-color: var(--surface-container-lowest);
        }
        .bg-option input:checked + .bg-preview { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
        
        /* Loading Spinner */
        .loading-spinner {
          width: 32px; height: 32px; border: 3px solid rgba(192, 193, 255, 0.2);
          border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite;
        }
        [data-theme="light"] .loading-spinner { border-color: rgba(63, 59, 189, 0.1); border-top-color: var(--primary); }
        
        @media (max-width: 768px) {
          .dashboard-layout { flex-direction: column; }
          .dashboard-sidebar { width: 100%; height: auto; flex-direction: row; align-items: center; padding: 0; }
          .sidebar-brand { padding: var(--space-md); }
          .sidebar-nav { flex-direction: row; overflow-x: auto; padding: 0 var(--space-md); margin-bottom: 0; }
          .sidebar-link { padding: 8px 12px; white-space: nowrap; }
          .sidebar-footer { display: none; }
          .dashboard-header { flex-direction: column; align-items: flex-start; gap: var(--space-md); padding: var(--space-xl) var(--space-md) var(--space-lg); }
          .header-actions { width: 100%; flex-direction: column-reverse; align-items: stretch; }
          .search-bar { width: 100%; }
          .dashboard-content { padding: 0 var(--space-md) var(--space-xl); }
          .background-picker { flex-direction: column; }
        }
      `;
      document.head.appendChild(style);
    }
  }
}
