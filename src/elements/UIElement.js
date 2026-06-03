/**
 * UIElement — Canvas UI component for the UI Builder mode.
 * Renders interactive-looking UI components (Button, Input, Card, Badge, Toggle, Dropdown)
 * directly on the canvas, useful for designing app mockups.
 */
import { Element } from './Element.js';

const UI_COMPONENTS = {
  button: {
    defaultWidth: 140, defaultHeight: 44,
    label: 'Button',
    defaultProps: { label: 'Click Me', variant: 'primary', radius: 8 }
  },
  input: {
    defaultWidth: 240, defaultHeight: 44,
    label: 'Input Field',
    defaultProps: { placeholder: 'Enter text...', variant: 'outlined', radius: 8 }
  },
  card: {
    defaultWidth: 280, defaultHeight: 180,
    label: 'Card',
    defaultProps: { title: 'Card Title', body: 'Card content goes here.', radius: 12 }
  },
  badge: {
    defaultWidth: 90, defaultHeight: 28,
    label: 'Badge',
    defaultProps: { label: 'New', variant: 'primary', radius: 20 }
  },
  toggle: {
    defaultWidth: 52, defaultHeight: 28,
    label: 'Toggle',
    defaultProps: { checked: false, radius: 14 }
  },
  dropdown: {
    defaultWidth: 200, defaultHeight: 44,
    label: 'Dropdown',
    defaultProps: { label: 'Select option', options: ['Option 1', 'Option 2', 'Option 3'], radius: 8 }
  },
  navbar: {
    defaultWidth: 600, defaultHeight: 56,
    label: 'Navbar',
    defaultProps: { title: 'App Title', radius: 0 }
  },
  modal: {
    defaultWidth: 380, defaultHeight: 280,
    label: 'Modal Dialog',
    defaultProps: { title: 'Dialog Title', body: 'Are you sure you want to do this?', radius: 16 }
  }
};

export { UI_COMPONENTS };

export class UIElement extends Element {
  constructor(options = {}) {
    const componentDef = UI_COMPONENTS[options.component] || UI_COMPONENTS.button;
    const merged = {
      width: componentDef.defaultWidth,
      height: componentDef.defaultHeight,
      ...options,
    };
    super(merged);
    this.type = 'ui';
    this.component = options.component || 'button';
    this.props = { ...componentDef.defaultProps, ...(options.props || {}) };
    // UI theme colors
    this.uiTheme = options.uiTheme || 'dark'; // 'dark' | 'light'
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    switch (this.component) {
      case 'button': this._renderButton(ctx); break;
      case 'input': this._renderInput(ctx); break;
      case 'card': this._renderCard(ctx); break;
      case 'badge': this._renderBadge(ctx); break;
      case 'toggle': this._renderToggle(ctx); break;
      case 'dropdown': this._renderDropdown(ctx); break;
      case 'navbar': this._renderNavbar(ctx); break;
      case 'modal': this._renderModal(ctx); break;
      default: this._renderButton(ctx);
    }

    ctx.restore();
  }

  _isDark() { return this.uiTheme === 'dark'; }

  _colors() {
    return this._isDark()
      ? { bg: '#1e1e2e', surface: '#2a2a3e', text: '#ffffff', muted: '#9ca3af', primary: '#c0c1ff', border: 'rgba(255,255,255,0.12)' }
      : { bg: '#ffffff', surface: '#f8f9ff', text: '#1a1a2e', muted: '#6b7280', primary: '#5b5ef4', border: 'rgba(0,0,0,0.12)' };
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  _renderButton(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const r = props.radius ?? 8;

    const isPrimary = props.variant === 'primary' || !props.variant;
    const isOutlined = props.variant === 'outlined';
    const isGhost = props.variant === 'ghost';

    this._roundRect(ctx, 0, 0, w, h, r);
    if (isPrimary) {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, c.primary);
      grad.addColorStop(1, this._isDark() ? '#9899e8' : '#4b4ecc');
      ctx.fillStyle = grad;
    } else if (isOutlined) {
      ctx.fillStyle = 'transparent';
    } else {
      ctx.fillStyle = 'rgba(192,193,255,0.08)';
    }
    ctx.fill();

    if (isOutlined) {
      ctx.strokeStyle = c.primary;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Shadow for primary
    if (isPrimary) {
      ctx.shadowColor = 'rgba(192,193,255,0.4)';
      ctx.shadowBlur = 12;
    }

    ctx.font = `600 14px Inter, sans-serif`;
    ctx.fillStyle = isPrimary ? '#0b1c30' : c.primary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText(props.label || 'Button', w / 2, h / 2);
  }

  _renderInput(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const r = props.radius ?? 8;

    this._roundRect(ctx, 0, 0, w, h, r);
    ctx.fillStyle = c.surface;
    ctx.fill();
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Placeholder text
    ctx.font = `14px Inter, sans-serif`;
    ctx.fillStyle = c.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.placeholder || 'Enter text...', 14, h / 2);

    // Cursor blink simulation
    ctx.fillStyle = c.primary;
    ctx.fillRect(14, h / 2 - 8, 1.5, 16);
  }

  _renderCard(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const r = props.radius ?? 12;

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;

    this._roundRect(ctx, 0, 0, w, h, r);
    ctx.fillStyle = c.surface;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Card header stripe
    this._roundRect(ctx, 0, 0, w, 48, [r, r, 0, 0]);
    ctx.fillStyle = c.bg;
    ctx.fill();

    // Title
    ctx.font = `bold 14px Inter, sans-serif`;
    ctx.fillStyle = c.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.title || 'Card', 16, 24);

    // Body text
    ctx.font = `13px Inter, sans-serif`;
    ctx.fillStyle = c.muted;
    ctx.fillText(props.body || '', 16, 68);
  }

  _renderBadge(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();

    this._roundRect(ctx, 0, 0, w, h, props.radius ?? 20);
    ctx.fillStyle = props.variant === 'success' ? 'rgba(52,211,153,0.2)' :
                    props.variant === 'error' ? 'rgba(248,113,113,0.2)' :
                    props.variant === 'warning' ? 'rgba(251,191,36,0.2)' :
                    'rgba(192,193,255,0.2)';
    ctx.fill();
    ctx.strokeStyle = props.variant === 'success' ? '#34d399' :
                      props.variant === 'error' ? '#f87171' :
                      props.variant === 'warning' ? '#fbbf24' : c.primary;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = `bold 12px Inter, sans-serif`;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.label || 'Badge', w / 2, h / 2);
  }

  _renderToggle(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const checked = props.checked;
    const r = h / 2;

    // Track
    this._roundRect(ctx, 0, 0, w, h, r);
    ctx.fillStyle = checked ? c.primary : c.border;
    ctx.fill();

    // Thumb
    const thumbX = checked ? w - h + 4 : 4;
    ctx.beginPath();
    ctx.arc(thumbX + (h - 8) / 2, h / 2, (h - 8) / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  _renderDropdown(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const r = props.radius ?? 8;

    this._roundRect(ctx, 0, 0, w, h, r);
    ctx.fillStyle = c.surface;
    ctx.fill();
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = `14px Inter, sans-serif`;
    ctx.fillStyle = c.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.label || 'Select...', 14, h / 2);

    // Chevron
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - 26, h / 2 - 4);
    ctx.lineTo(w - 18, h / 2 + 4);
    ctx.lineTo(w - 10, h / 2 - 4);
    ctx.stroke();
  }

  _renderNavbar(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();

    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, h);
    ctx.stroke();

    ctx.font = `bold 16px Inter, sans-serif`;
    ctx.fillStyle = c.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.title || 'App', 20, h / 2);

    // Nav items
    const items = ['Home', 'About', 'Contact'];
    let itemX = w - 20;
    for (let i = items.length - 1; i >= 0; i--) {
      ctx.font = `13px Inter, sans-serif`;
      ctx.fillStyle = i === 0 ? c.primary : c.muted;
      ctx.textAlign = 'right';
      ctx.fillText(items[i], itemX, h / 2);
      itemX -= ctx.measureText(items[i]).width + 24;
    }
  }

  _renderModal(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const r = props.radius ?? 16;

    // Backdrop hint
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-20, -20, w + 40, h + 40);

    // Modal box
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    this._roundRect(ctx, 0, 0, w, h, r);
    ctx.fillStyle = c.surface;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Title
    ctx.font = `bold 16px Inter, sans-serif`;
    ctx.fillStyle = c.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.title || 'Dialog', 20, 32);

    // Body
    ctx.font = `13px Inter, sans-serif`;
    ctx.fillStyle = c.muted;
    ctx.fillText(props.body || '', 20, 80);

    // Buttons
    const btnY = h - 52;
    this._roundRect(ctx, w - 180, btnY, 80, 36, 8);
    ctx.fillStyle = c.border;
    ctx.fill();
    ctx.font = `600 13px Inter, sans-serif`;
    ctx.fillStyle = c.muted;
    ctx.textAlign = 'center';
    ctx.fillText('Cancel', w - 140, btnY + 18);

    this._roundRect(ctx, w - 90, btnY, 74, 36, 8);
    ctx.fillStyle = c.primary;
    ctx.fill();
    ctx.fillStyle = '#0b1c30';
    ctx.fillText('Confirm', w - 53, btnY + 18);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      component: this.component,
      props: { ...this.props },
      uiTheme: this.uiTheme,
    };
  }
}
