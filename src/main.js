/**
 * CanvasFlow — Main Application Entry Point
 * Handles routing, auth state, and page mounting.
 */

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
            this.navigate('/login');
            return;
          }
          const boardId = path.split('/board/')[1];
          // BoardPage will be loaded dynamically
          import('./pages/BoardPage.js').then(({ BoardPage }) => {
            this.currentPage = new BoardPage(this.root, this, boardId);
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
