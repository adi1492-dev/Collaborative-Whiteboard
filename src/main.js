/**
 * CanvasFlow — Main Application Entry Point
 * Handles routing, auth state, and page mounting.
 */

import './logger.js';
import { AuthManager } from './auth/AuthManager.js';
import { LandingPage } from './pages/LandingPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { DashboardPage } from './pages/DashboardPage.js';

class App {
  constructor() {
    this.root = document.getElementById('app');
    this.auth = new AuthManager();
    this.currentPage = null;

    // Load saved theme
    const savedTheme = localStorage.getItem('canvasflow-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Setup routing
    window.addEventListener('hashchange', () => this.route());
    window.addEventListener('popstate', () => this.route());

    // Initial route
    this.route();
  }

  /**
   * Simple hash-based router.
   */
  route() {
    const hash = window.location.hash.slice(1) || '/';
    const path = hash.split('?')[0];

    // Cleanup previous page if it has a destroy method
    if (this.currentPage && typeof this.currentPage.destroy === 'function') {
      try {
        this.currentPage.destroy();
      } catch (err) {
        console.error('Error destroying previous page:', err);
      }
    }

    // Clear current page
    this.root.innerHTML = '';

    switch (path) {
      case '/':
      case '/landing':
        this.currentPage = new LandingPage(this.root, this);
        break;

      case '/login':
        this.currentPage = new LoginPage(this.root, this);
        break;

      case '/register':
        this.currentPage = new RegisterPage(this.root, this);
        break;

      case '/dashboard':
        if (!this.auth.isAuthenticated()) {
          this.navigate('/login');
          return;
        }
        this.currentPage = new DashboardPage(this.root, this);
        break;

      default:
        // Check if it's a board route
        if (path.startsWith('/board/')) {
          if (!this.auth.isAuthenticated()) {
            localStorage.setItem('canvasflow-redirect', window.location.hash);
            this.navigate('/login');
            return;
          }
          const boardId = path.split('/board/')[1];
          const expectedPath = path; // Capture at time of route() call

          // BoardPage will be loaded dynamically
          import('./pages/BoardPage.js').then(({ BoardPage }) => {
            const currentPath = (window.location.hash.slice(1) || '/').split('?')[0];
            if (currentPath !== expectedPath) {
              console.log('[Router] Ignoring stale BoardPage mount for', expectedPath);
              return;
            }
            if (this.currentPage && typeof this.currentPage.destroy === 'function') {
              try { this.currentPage.destroy(); } catch (_) {}
            }
            this.currentPage = new BoardPage(this.root, this, boardId);
          }).catch(err => {
            console.error('[Router] Failed to load BoardPage:', err);
          });
        } else if (path.startsWith('/join/')) {
          if (!this.auth.isAuthenticated()) {
            localStorage.setItem('canvasflow-redirect', window.location.hash);
            this.navigate('/login');
            return;
          }
          const key = path.split('/join/')[1];
          this.joinBoard(key);
        } else if (path.startsWith('/view/')) {
          const boardId = path.split('/view/')[1];
          // We can just load the BoardPage and let it handle the view token from query params
          // We might need to ensure BoardPage knows it's viewing a public link, but for now we'll just load it.
          // Wait, BoardPage's render calls `/api/boards/${this.boardId}` which requires auth.
          // For public view, we might need a special ViewerPage or adapt BoardPage to use `/api/boards/:id/view?token=...`
          // We will address this if needed, for now let's delegate to a ViewBoardPage or handle it in BoardPage.
          
          import('./pages/BoardPage.js').then(({ BoardPage }) => {
            // Need to pass token, BoardPage might not support it out of the box, we will have to modify BoardPage too.
            this.currentPage = new BoardPage(this.root, this, boardId, true);
          });
        } else {
          this.currentPage = new LandingPage(this.root, this);
        }
        break;
    }
  }

  /**
   * Navigate to a new route.
   */
  navigate(path) {
    window.location.hash = path;
  }

  async joinBoard(key) {
    try {
      this.root.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--on-surface);">Joining room...</div>';
      const res = await this.auth.apiFetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      if (res.ok) {
        const data = await res.json();
        this.navigate(`/board/${data.boardId}`);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to join room. The key might be invalid or expired.');
        this.navigate('/dashboard');
      }
    } catch (err) {
      alert('Network error while trying to join the room.');
      this.navigate('/dashboard');
    }
  }

  /**
   * Toggle between dark and light theme.
   */
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('canvasflow-theme', next);
    return next;
  }

  /**
   * Get current theme.
   */
  getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }
}

// Boot the app
const app = new App();
window.__canvasflow = app; // Debug access
