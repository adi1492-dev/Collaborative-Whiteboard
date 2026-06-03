/**
 * AuthManager — Handles JWT authentication, token refresh, and API calls.
 * Access token stored in memory (XSS safe), refresh token in localStorage.
 *
 * Production note: Set VITE_API_URL env var on Vercel to point to the Railway
 * backend (e.g. https://your-app.up.railway.app). In dev, Vite proxy handles it.
 */

// Resolve the API base URL once at module load time.
// In dev: '' (empty) — Vite proxy forwards /api/* to localhost:3001
// In prod: 'https://your-app.up.railway.app' — direct cross-domain call
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class AuthManager {
  constructor() {
    this._accessToken = null;
    // Guard against localStorage storing literal "null" string
    const storedRefresh = localStorage.getItem('canvasflow-refresh-token');
    this._refreshToken = (storedRefresh && storedRefresh !== 'null') ? storedRefresh : null;
    const storedUser = localStorage.getItem('canvasflow-user');
    this._user = (storedUser && storedUser !== 'null') ? JSON.parse(storedUser) : null;
    this._refreshTimer = null;
  }

  /**
   * Check if user is authenticated.
   */
  isAuthenticated() {
    return this._user !== null && (this._accessToken !== null || this._refreshToken !== null);
  }

  /**
   * Get current user profile.
   */
  getUser() {
    return this._user;
  }

  /**
   * Get access token for API calls.
   */
  getAccessToken() {
    return this._accessToken;
  }

  /**
   * Get authorization headers for fetch calls.
   */
  getAuthHeaders() {
    if (!this._accessToken) return {};
    return { 'Authorization': `Bearer ${this._accessToken}` };
  }

  /**
   * Register a new user.
   */
  async register(email, password, displayName) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Registration failed');
    }

    const data = await res.json();
    this._setTokens(data);
    return data.user;
  }

  /**
   * Login with email and password.
   */
  async login(email, password) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Login failed');
    }

    const data = await res.json();
    this._setTokens(data);
    return data.user;
  }

  /**
   * Refresh the access token using the refresh token.
   */
  async refreshAccessToken() {
    if (!this._refreshToken) {
      this.logout();
      return false;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this._refreshToken }),
      });

      if (!res.ok) {
        this.logout();
        return false;
      }

      const data = await res.json();
      this._setTokens(data);
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  /**
   * Logout — clear all auth state.
   */
  async logout() {
    // Clear timer first to prevent any in-flight refresh from reviving the session
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }

    try {
      if (this._refreshToken) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
          },
          body: JSON.stringify({ refreshToken: this._refreshToken }),
        });
      }
    } catch {
      // Ignore errors during logout — user is being logged out regardless
    }

    this._accessToken = null;
    this._refreshToken = null;
    this._user = null;
    localStorage.removeItem('canvasflow-refresh-token');
    localStorage.removeItem('canvasflow-user');
  }

  /**
   * Make an authenticated API call with automatic token refresh.
   */
  async apiFetch(url, options = {}) {
    // Prepend API_BASE so calls work cross-domain in production
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    const headers = { ...this.getAuthHeaders(), ...options.headers };
    let res = await fetch(fullUrl, { ...options, headers });

    // If 401, try refreshing token once
    if (res.status === 401 && this._refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const retryHeaders = { ...this.getAuthHeaders(), ...options.headers };
        res = await fetch(fullUrl, { ...options, headers: retryHeaders });
      }
    }

    return res;
  }

  /**
   * Internal: Store tokens and schedule refresh.
   */
  _setTokens(data) {
    this._accessToken = data.accessToken;
    this._refreshToken = data.refreshToken;
    this._user = data.user;

    localStorage.setItem('canvasflow-refresh-token', data.refreshToken);
    localStorage.setItem('canvasflow-user', JSON.stringify(data.user));

    // Schedule token refresh (13 minutes — before 15 min expiry)
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      this.refreshAccessToken();
    }, 13 * 60 * 1000);
  }
}
