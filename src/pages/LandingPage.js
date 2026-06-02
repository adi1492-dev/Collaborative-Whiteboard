/**
 * LandingPage — Marketing landing page matching the Stitch Kinetic Dark/Light designs.
 * Features: hero section with animated whiteboard preview, value props bento grid.
 */
export class LandingPage {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.render();
  }

  render() {
    this.root.innerHTML = `
      <!-- Navigation Bar -->
      <nav class="landing-nav glass" id="global-nav">
        <div class="nav-left">
          <div class="nav-brand headline-md" style="font-weight:900; color: var(--primary); cursor:pointer;">CanvasFlow</div>
          <div class="nav-links">
            <a href="#/dashboard" class="nav-link label-md">Dashboard</a>
            <a href="#" class="nav-link label-md">Templates</a>
            <a href="#" class="nav-link label-md">Settings</a>
          </div>
        </div>
        <div class="nav-right">
          <button class="nav-icon-btn" aria-label="Notifications">
            <span class="material-symbols-outlined">notifications</span>
          </button>
          <button class="nav-icon-btn" aria-label="Help">
            <span class="material-symbols-outlined">help</span>
          </button>
          <button class="btn btn-primary" id="nav-new-board">New Board</button>
        </div>
      </nav>

      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-glow-1"></div>
        <div class="hero-glow-2"></div>
        
        <div class="hero-content">
          <div class="hero-badge anim-fade-in">
            <span class="badge-dot anim-pulse-glow"></span>
            <span class="label-md" style="color: var(--secondary);">CanvasFlow 2.0 is Live</span>
          </div>

          <h1 class="hero-title headline-xl text-glow">
            The Infinite Canvas for<br/>
            <span class="gradient-text">High-Performance</span> Teams.
          </h1>

          <p class="hero-subtitle body-lg" style="color: var(--on-surface-variant);">
            Design, draw, and ideate at the speed of thought. An ultra-responsive workspace 
            engineered for data density, deep focus, and seamless collaboration.
          </p>

          <div class="hero-actions">
            <button class="btn btn-primary glow-primary" id="hero-cta">Start Free Trial</button>
            <button class="btn btn-outline" id="hero-demo">
              <span class="material-symbols-outlined" style="font-size:18px;">play_circle</span>
              View Demo
            </button>
          </div>
        </div>

        <!-- Living Whiteboard Preview -->
        <div class="whiteboard-preview bg-grid-pattern">
          <div class="preview-header">
            <div class="preview-dots">
              <span class="dot dot-red"></span>
              <span class="dot dot-primary"></span>
              <span class="dot dot-secondary"></span>
            </div>
            <span class="label-md" style="color: var(--on-surface-variant);">Project Alpha - Architecture</span>
            <div class="preview-avatars">
              <div class="avatar-small" style="background: var(--primary);">JS</div>
              <div class="avatar-small" style="background: var(--secondary); margin-left:-8px;">MK</div>
            </div>
          </div>
          
          <div class="preview-canvas">
            <svg class="preview-lines" width="100%" height="100%">
              <path class="anim-pulse-glow" d="M 180 160 C 300 160, 260 320, 440 320" fill="none" stroke="var(--primary)" stroke-dasharray="6 6" stroke-width="2"/>
              <path style="opacity:0.5" d="M 480 320 L 600 240" fill="none" stroke="var(--secondary)" stroke-width="2"/>
            </svg>

            <!-- Node 1 -->
            <div class="preview-node anim-float-slow" style="top:120px; left:8%;">
              <div class="label-md" style="color: var(--primary); display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <span class="material-symbols-outlined" style="font-size:16px;">database</span>Data Layer
              </div>
              <p class="body-sm" style="color: var(--on-surface-variant); font-size:12px;">High-throughput processing cluster configuration.</p>
            </div>

            <!-- Sticky Note -->
            <div class="preview-sticky anim-float-fast" style="top:220px; left:28%; transform: rotate(-2deg);">
              <p class="body-sm">Optimize caching strategy here before Q3 rollout.</p>
            </div>

            <!-- Node 2 (Active) -->
            <div class="preview-node preview-node-active anim-float-slow" style="top:280px; left:42%; animation-delay:1s;">
              <div class="label-md" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="display:flex; align-items:center; gap:6px;">
                  <span class="material-symbols-outlined" style="font-size:16px; color:var(--primary);">api</span>Core API
                </span>
                <span class="badge-dot anim-pulse-glow" style="background:var(--secondary);"></span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width:70%;"></div>
              </div>
            </div>

            <!-- Cursor -->
            <div class="preview-cursor anim-float-slow" style="top:200px; left:22%;">
              <span class="material-symbols-outlined" style="color: var(--secondary); font-variation-settings: 'FILL' 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">near_me</span>
              <div class="cursor-label" style="background: var(--secondary); color: var(--on-secondary);">Sarah</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Value Propositions Bento Grid -->
      <section class="bento-section">
        <div class="bento-header">
          <h2 class="headline-lg" style="text-align:center;">Engineered for Velocity</h2>
          <p class="body-lg" style="text-align:center; color: var(--on-surface-variant); max-width:500px; margin: var(--space-sm) auto 0;">
            Leave clunky whiteboards behind. CanvasFlow renders complex architectures instantly.
          </p>
        </div>

        <div class="bento-grid">
          <!-- Card 1: Hardware Accelerated -->
          <div class="bento-card bento-card-wide">
            <div class="bento-glow"></div>
            <div class="bento-card-content">
              <div class="bento-icon">
                <span class="material-symbols-outlined" style="color: var(--primary);">bolt</span>
              </div>
              <h3 class="headline-md">Hardware Accelerated</h3>
              <p class="body-lg" style="color: var(--on-surface-variant); max-width:400px;">
                Our rendering engine ensures 60fps performance even with 10,000+ objects on the canvas.
              </p>
              <div class="bento-bars">
                <div class="bar" style="height:30%;"></div>
                <div class="bar" style="height:50%;"></div>
                <div class="bar" style="height:40%;"></div>
                <div class="bar bar-active" style="height:90%;"></div>
                <div class="bar" style="height:60%;"></div>
                <div class="bar" style="height:45%;"></div>
              </div>
            </div>
          </div>

          <!-- Card 2: Multiplayer -->
          <div class="bento-card">
            <div class="bento-card-content">
              <div class="bento-icon">
                <span class="material-symbols-outlined" style="color: var(--secondary);">group</span>
              </div>
              <h3 class="headline-md">Multiplayer Native</h3>
              <p class="body-lg" style="color: var(--on-surface-variant);">
                Real-time presence, cursor tracking, and instant conflict resolution powered by CRDTs.
              </p>
              <div class="bento-avatars">
                <div class="avatar-medium" style="background:var(--surface-bright);">JD</div>
                <div class="avatar-medium" style="background:var(--primary-container); color:var(--on-primary-container); margin-left:-12px;">AL</div>
                <div class="avatar-medium" style="background:var(--secondary-container); color:var(--on-secondary-container); margin-left:-12px;">MR</div>
              </div>
            </div>
          </div>

          <!-- Card 3: AI Powered (NEW) -->
          <div class="bento-card">
            <div class="bento-card-content">
              <div class="bento-icon">
                <span class="material-symbols-outlined" style="color: var(--tertiary);">auto_awesome</span>
              </div>
              <h3 class="headline-md">AI-Powered</h3>
              <p class="body-lg" style="color: var(--on-surface-variant);">
                Shape recognition, smart layouts, and note summarization powered by Gemini AI.
              </p>
            </div>
          </div>

          <!-- Card 4: Infinite Spatial Context (Full Width) -->
          <div class="bento-card bento-card-full">
            <div class="bento-card-row">
              <div class="bento-card-content" style="flex:1;">
                <div class="bento-icon">
                  <span class="material-symbols-outlined" style="color: var(--primary);">all_out</span>
                </div>
                <h3 class="headline-md">Infinite Spatial Context</h3>
                <p class="body-lg" style="color: var(--on-surface-variant); max-width:400px; margin-bottom: var(--space-lg);">
                  Zoom seamlessly from a 10,000-foot strategic overview down to individual API endpoint configurations.
                </p>
                <a href="#/register" class="label-md" style="color: var(--primary); display:flex; align-items:center; gap:4px; text-decoration:none;">
                  Get Started <span class="material-symbols-outlined" style="font-size:16px;">arrow_forward</span>
                </a>
              </div>
              <div class="bento-visual bg-grid-pattern">
                <div class="spatial-rings">
                  <div class="ring ring-1 anim-pulse-glow"></div>
                  <div class="ring ring-2" style="animation: pulse-glow 6s infinite;"></div>
                  <span class="material-symbols-outlined" style="font-size:48px; color: var(--surface-bright);">zoom_out_map</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="landing-footer">
        <p class="body-sm" style="color: var(--on-surface-variant);">
          © 2026 CanvasFlow. Built for high-performance teams.
        </p>
      </footer>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    // CTA buttons
    this.root.querySelector('#hero-cta')?.addEventListener('click', () => {
      this.app.navigate('/register');
    });

    this.root.querySelector('#nav-new-board')?.addEventListener('click', () => {
      if (this.app.auth.isAuthenticated()) {
        this.app.navigate('/dashboard');
      } else {
        this.app.navigate('/register');
      }
    });

    this.root.querySelector('#hero-demo')?.addEventListener('click', () => {
      this.app.navigate('/register');
    });
  }
}
