/**
 * RegisterPage — Matches the Stitch Kinetic Dark/Light signup design.
 * Split layout: visual panel (left) + registration form (right).
 */
export class RegisterPage {
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
                  <span class="material-symbols-outlined" style="color: var(--on-primary); font-size: 28px;">person_add</span>
                </div>
              </div>

              <h2 class="headline-lg" style="margin-bottom: 8px;">Join the Canvas</h2>
              <p class="body-lg" style="color: var(--on-surface-variant); max-width: 350px; margin: 0 auto;">
                Create your workspace and start collaborating with your team in seconds.
              </p>
            </div>
          </div>

          <!-- Right Form Panel -->
          <div class="auth-form-panel">
            <div class="auth-form-inner">
              <a href="#/" class="headline-md" style="color: var(--primary); text-decoration: none; font-weight: 900; display:inline-block; margin-bottom: var(--space-xl);">CanvasFlow</a>

              <h1 class="headline-lg">Create Account</h1>
              <p class="body-lg auth-subtitle">Set up your workspace and start creating.</p>

              <div class="auth-error" id="register-error">
                <span class="material-symbols-outlined" style="font-size:18px;">error</span>
                <span id="register-error-text"></span>
              </div>

              <form id="register-form">
                <div class="form-group">
                  <label for="register-name" class="form-label">Display Name</label>
                  <div class="input-wrapper">
                    <span class="material-symbols-outlined">person</span>
                    <input type="text" id="register-name" class="input" placeholder="Your name" required minlength="2" autocomplete="name" />
                  </div>
                </div>

                <div class="form-group">
                  <label for="register-email" class="form-label">Email Address</label>
                  <div class="input-wrapper">
                    <span class="material-symbols-outlined">mail</span>
                    <input type="email" id="register-email" class="input" placeholder="you@company.com" required autocomplete="email" />
                  </div>
                </div>

                <div class="form-group">
                  <label for="register-password" class="form-label">Password</label>
                  <div class="input-wrapper">
                    <span class="material-symbols-outlined">lock</span>
                    <input type="password" id="register-password" class="input" placeholder="Minimum 8 characters" required minlength="8" autocomplete="new-password" />
                    <button type="button" class="password-toggle" id="toggle-register-password" aria-label="Toggle password visibility">
                      <span class="material-symbols-outlined">visibility_off</span>
                    </button>
                  </div>
                  <div class="password-strength" id="password-strength">
                    <div class="strength-bar">
                      <div class="strength-fill" id="strength-fill"></div>
                    </div>
                    <span class="label-sm" id="strength-text" style="color: var(--on-surface-variant);">Enter password</span>
                  </div>
                </div>

                <div class="auth-actions">
                  <button type="submit" class="btn btn-primary" id="register-submit">
                    <span class="material-symbols-outlined" style="font-size:18px;">how_to_reg</span>
                    Create Account
                  </button>
                </div>
              </form>

              <p class="auth-link">
                Already have an account? <a href="#/login">Sign in</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const form = this.root.querySelector('#register-form');
    const errorEl = this.root.querySelector('#register-error');
    const errorText = this.root.querySelector('#register-error-text');
    const submitBtn = this.root.querySelector('#register-submit');
    const toggleBtn = this.root.querySelector('#toggle-register-password');
    const passwordInput = this.root.querySelector('#register-password');
    const strengthFill = this.root.querySelector('#strength-fill');
    const strengthText = this.root.querySelector('#strength-text');

    // Toggle password visibility
    toggleBtn?.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      toggleBtn.querySelector('.material-symbols-outlined').textContent =
        type === 'password' ? 'visibility_off' : 'visibility';
    });

    // Password strength meter
    passwordInput?.addEventListener('input', () => {
      const val = passwordInput.value;
      let strength = 0;
      if (val.length >= 8) strength++;
      if (val.length >= 12) strength++;
      if (/[A-Z]/.test(val)) strength++;
      if (/[0-9]/.test(val)) strength++;
      if (/[^a-zA-Z0-9]/.test(val)) strength++;

      const pct = (strength / 5) * 100;
      const colors = ['var(--error)', 'var(--tertiary)', '#FFA500', 'var(--secondary)', '#22c55e'];
      const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

      strengthFill.style.width = pct + '%';
      strengthFill.style.background = colors[strength - 1] || 'transparent';
      strengthText.textContent = val.length > 0 ? labels[strength - 1] || 'Very Weak' : 'Enter password';
    });

    // Form submit
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const displayName = this.root.querySelector('#register-name').value.trim();
      const email = this.root.querySelector('#register-email').value.trim();
      const password = this.root.querySelector('#register-password').value;

      errorEl.classList.remove('visible');
      submitBtn.classList.add('btn-loading');
      submitBtn.disabled = true;

      try {
        await this.app.auth.register(email, password, displayName);
        const redirectUrl = localStorage.getItem('canvasflow-redirect');
        if (redirectUrl) {
          localStorage.removeItem('canvasflow-redirect');
          this.app.navigate(redirectUrl.startsWith('#') ? redirectUrl.slice(1) : redirectUrl);
        } else {
          this.app.navigate('/dashboard');
        }
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
