/**
 * LoginPage — Matches the Stitch Kinetic Dark/Light login design.
 * Split layout: visual panel (left) + login form (right).
 */
export class LoginPage {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.render();
  }

  render() {
    this.root.innerHTML = `
      <div class="auth-container">
        <div class="auth-layout">
          <!-- Left Visual Panel -->
          <div class="auth-visual-panel bg-grid-pattern">
            <div class="auth-visual-glow-1"></div>
            <div class="auth-visual-glow-2"></div>

            <div class="auth-visual-content">
              <div class="auth-visual-graphic">
                <div class="auth-graphic-ring auth-graphic-ring-1"></div>
                <div class="auth-graphic-ring auth-graphic-ring-2"></div>
                <div class="auth-graphic-ring auth-graphic-ring-3"></div>
                <div class="auth-graphic-center">
                  <span class="material-symbols-outlined" style="color: var(--on-primary); font-size: 28px;">edit</span>
                </div>
              </div>

              <h2 class="headline-lg" style="margin-bottom: 8px;">Welcome Back</h2>
              <p class="body-lg" style="color: var(--on-surface-variant); max-width: 350px; margin: 0 auto;">
                Your team's canvas is waiting. Jump back in and continue creating.
              </p>
            </div>
          </div>

          <!-- Right Form Panel -->
          <div class="auth-form-panel">
            <div class="auth-form-inner">
              <a href="#/" class="headline-md" style="color: var(--primary); text-decoration: none; font-weight: 900; display:inline-block; margin-bottom: var(--space-xl);">CanvasFlow</a>

              <h1 class="headline-lg">Sign In</h1>
              <p class="body-lg auth-subtitle">Enter your credentials to access your workspace.</p>

              <div class="auth-error" id="login-error">
                <span class="material-symbols-outlined" style="font-size:18px;">error</span>
                <span id="login-error-text"></span>
              </div>

              <form id="login-form">
                <div class="form-group">
                  <label for="login-email" class="form-label">Email Address</label>
                  <div class="input-wrapper">
                    <span class="material-symbols-outlined">mail</span>
                    <input type="email" id="login-email" class="input" placeholder="you@company.com" required autocomplete="email" />
                  </div>
                </div>

                <div class="form-group">
                  <label for="login-password" class="form-label">Password</label>
                  <div class="input-wrapper">
                    <span class="material-symbols-outlined">lock</span>
                    <input type="password" id="login-password" class="input" placeholder="Enter your password" required autocomplete="current-password" />
                    <button type="button" class="password-toggle" id="toggle-password" aria-label="Toggle password visibility">
                      <span class="material-symbols-outlined">visibility_off</span>
                    </button>
                  </div>
                </div>

                <div class="auth-actions">
                  <button type="submit" class="btn btn-primary" id="login-submit">
                    <span class="material-symbols-outlined" style="font-size:18px;">login</span>
                    Sign In
                  </button>
                </div>
              </form>

              <p class="auth-link">
                Don't have an account? <a href="#/register">Create one</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const form = this.root.querySelector('#login-form');
    const errorEl = this.root.querySelector('#login-error');
    const errorText = this.root.querySelector('#login-error-text');
    const submitBtn = this.root.querySelector('#login-submit');
    const toggleBtn = this.root.querySelector('#toggle-password');
    const passwordInput = this.root.querySelector('#login-password');

    // Toggle password visibility
    toggleBtn?.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      toggleBtn.querySelector('.material-symbols-outlined').textContent =
        type === 'password' ? 'visibility_off' : 'visibility';
    });

    // Form submit
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = this.root.querySelector('#login-email').value.trim();
      const password = this.root.querySelector('#login-password').value;

      // Clear error
      errorEl.classList.remove('visible');
      submitBtn.classList.add('btn-loading');
      submitBtn.disabled = true;

      try {
        await this.app.auth.login(email, password);
        this.app.navigate('/dashboard');
      } catch (err) {
        errorText.textContent = err.message;
        errorEl.classList.add('visible');
      } finally {
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
      }
    });
  }
}
