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
  },
  checkbox: {
    defaultWidth: 140, defaultHeight: 24,
    label: 'Checkbox',
    defaultProps: { label: 'Remember me', checked: true, radius: 4 }
  },
  slider: {
    defaultWidth: 200, defaultHeight: 24,
    label: 'Slider',
    defaultProps: { progress: 0.6, radius: 12 }
  },
  tabs: {
    defaultWidth: 320, defaultHeight: 40,
    label: 'Tabs',
    defaultProps: { tabs: ['Details', 'Reviews', 'FAQ'], active: 0, radius: 8 }
  },
  avatar: {
    defaultWidth: 48, defaultHeight: 48,
    label: 'Avatar',
    defaultProps: { initials: 'JD', radius: 24 }
  },
  textarea: {
    defaultWidth: 240, defaultHeight: 120,
    label: 'Textarea',
    defaultProps: { placeholder: 'Enter description...', radius: 8 }
  },
  radio: {
    defaultWidth: 200, defaultHeight: 80,
    label: 'Radio Group',
    defaultProps: { options: ['Option 1', 'Option 2'], active: 0 }
  },
  stepper: {
    defaultWidth: 120, defaultHeight: 36,
    label: 'Number Stepper',
    defaultProps: { value: '1', radius: 8 }
  },
  breadcrumbs: {
    defaultWidth: 240, defaultHeight: 24,
    label: 'Breadcrumbs',
    defaultProps: { path: ['Home', 'Category', 'Product'] }
  },
  pagination: {
    defaultWidth: 240, defaultHeight: 36,
    label: 'Pagination',
    defaultProps: { pages: 5, active: 1, radius: 4 }
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
      case 'checkbox': this._renderCheckbox(ctx); break;
      case 'slider': this._renderSlider(ctx); break;
      case 'tabs': this._renderTabs(ctx); break;
      case 'avatar': this._renderAvatar(ctx); break;
      case 'textarea': this._renderTextarea(ctx); break;
      case 'radio': this._renderRadio(ctx); break;
      case 'stepper': this._renderStepper(ctx); break;
      case 'breadcrumbs': this._renderBreadcrumbs(ctx); break;
      case 'pagination': this._renderPagination(ctx); break;
      default: this._renderButton(ctx);
    }

    ctx.restore();
  }

  _isDark() { return this.uiTheme === 'dark'; }

  get text() {
    if (this.component === 'card' || this.component === 'modal') return this.props.body || '';
    if (this.component === 'input' || this.component === 'textarea') return this.props.placeholder || '';
    if (this.component === 'navbar') return this.props.title || '';
    if (this.component === 'stepper') return this.props.value || '';
    if (this.component === 'slider' || this.component === 'toggle' || this.component === 'radio' || this.component === 'breadcrumbs' || this.component === 'pagination') return '';
    return this.props.label || '';
  }

  set text(val) {
    if (this.component === 'card' || this.component === 'modal') this.props.body = val;
    else if (this.component === 'input' || this.component === 'textarea') this.props.placeholder = val;
    else if (this.component === 'navbar') this.props.title = val;
    else if (this.component === 'stepper') this.props.value = val;
    else if (this.component === 'slider' || this.component === 'toggle' || this.component === 'radio' || this.component === 'breadcrumbs' || this.component === 'pagination') { /* no text */ }
    else this.props.label = val;
  }

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
    ctx.textBaseline = 'top';
    this._wrapText(ctx, props.body || '', 16, 56, w - 32, 18);
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
    ctx.textBaseline = 'top';
    this._wrapText(ctx, props.body || '', 20, 60, w - 40, 18);

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

  _renderCheckbox(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const checked = props.checked;
    
    // Checkbox box
    this._roundRect(ctx, 0, (h - 20) / 2, 20, 20, props.radius ?? 4);
    ctx.fillStyle = checked ? c.primary : 'transparent';
    ctx.fill();
    ctx.strokeStyle = checked ? c.primary : c.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Checkmark
    if (checked) {
      ctx.beginPath();
      ctx.moveTo(5, h / 2);
      ctx.lineTo(9, h / 2 + 4);
      ctx.lineTo(15, h / 2 - 4);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Label
    ctx.font = `14px Inter, sans-serif`;
    ctx.fillStyle = c.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.label || 'Checkbox', 32, h / 2);
  }

  _renderSlider(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const progress = Math.max(0, Math.min(1, props.progress ?? 0.5));
    
    const trackH = 6;
    const cy = h / 2;
    
    // Background track
    this._roundRect(ctx, 0, cy - trackH / 2, w, trackH, trackH / 2);
    ctx.fillStyle = c.border;
    ctx.fill();

    // Fill track
    this._roundRect(ctx, 0, cy - trackH / 2, w * progress, trackH, trackH / 2);
    ctx.fillStyle = c.primary;
    ctx.fill();

    // Thumb
    ctx.beginPath();
    ctx.arc(w * progress, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = c.primary;
    ctx.stroke();
  }

  _renderTabs(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const tabs = props.tabs || ['Tab 1', 'Tab 2'];
    const active = props.active ?? 0;
    
    // Bottom border
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, h);
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    const tabW = w / tabs.length;
    
    for (let i = 0; i < tabs.length; i++) {
      const isActive = i === active;
      ctx.font = `${isActive ? '600' : '400'} 14px Inter, sans-serif`;
      ctx.fillStyle = isActive ? c.primary : c.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tabs[i], i * tabW + tabW / 2, h / 2);
      
      if (isActive) {
        ctx.beginPath();
        ctx.moveTo(i * tabW, h - 1);
        ctx.lineTo((i + 1) * tabW, h - 1);
        ctx.strokeStyle = c.primary;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  _renderAvatar(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const r = Math.min(w, h) / 2;
    
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, c.primary);
    grad.addColorStop(1, this._isDark() ? '#9899e8' : '#4b4ecc');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.font = `600 ${r}px Inter, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(props.initials || 'AB', w / 2, h / 2);
  }

  _renderTextarea(ctx) {
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
    ctx.fillStyle = c.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    this._wrapText(ctx, props.placeholder || 'Enter text...', 14, 14, w - 28, 20);

    // Resize handle hint (bottom right)
    ctx.beginPath();
    ctx.moveTo(w - 14, h - 6);
    ctx.lineTo(w - 6, h - 14);
    ctx.moveTo(w - 10, h - 6);
    ctx.lineTo(w - 6, h - 10);
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  _renderRadio(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const options = props.options || ['Option 1', 'Option 2'];
    const active = props.active ?? 0;
    
    const rowHeight = h / options.length;

    for (let i = 0; i < options.length; i++) {
      const cy = i * rowHeight + rowHeight / 2;
      const isActive = i === active;
      
      // Outer circle
      ctx.beginPath();
      ctx.arc(12, cy, 8, 0, Math.PI * 2);
      ctx.strokeStyle = isActive ? c.primary : c.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner circle
      if (isActive) {
        ctx.beginPath();
        ctx.arc(12, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = c.primary;
        ctx.fill();
      }

      ctx.font = `14px Inter, sans-serif`;
      ctx.fillStyle = c.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(options[i], 32, cy);
    }
  }

  _renderStepper(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const r = props.radius ?? 8;

    this._roundRect(ctx, 0, 0, w, h, r);
    ctx.fillStyle = c.surface;
    ctx.fill();
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dividers
    ctx.beginPath();
    ctx.moveTo(32, 0); ctx.lineTo(32, h);
    ctx.moveTo(w - 32, 0); ctx.lineTo(w - 32, h);
    ctx.stroke();

    ctx.font = `18px Inter, sans-serif`;
    ctx.fillStyle = c.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Minus
    ctx.fillText('-', 16, h / 2);
    // Plus
    ctx.fillText('+', w - 16, h / 2);
    
    // Value
    ctx.font = `14px Inter, sans-serif`;
    ctx.fillText(props.value || '1', w / 2, h / 2);
  }

  _renderBreadcrumbs(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const path = props.path || ['Home', 'Category', 'Product'];
    
    let cx = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < path.length; i++) {
      const isLast = i === path.length - 1;
      ctx.font = `${isLast ? '600' : '400'} 13px Inter, sans-serif`;
      ctx.fillStyle = isLast ? c.text : c.muted;
      ctx.fillText(path[i], cx, h / 2);
      cx += ctx.measureText(path[i]).width + 8;
      
      if (!isLast) {
        ctx.fillStyle = c.border;
        ctx.fillText('/', cx, h / 2);
        cx += ctx.measureText('/').width + 8;
      }
    }
  }

  _renderPagination(ctx) {
    const { w, h, props } = { w: this.width, h: this.height, props: this.props };
    const c = this._colors();
    const pages = props.pages ?? 5;
    const active = props.active ?? 1;
    const r = props.radius ?? 4;
    
    // Calculate total width of buttons (pages + prev + next)
    const btnW = 32;
    const gap = 4;
    const totalBtn = pages + 2;
    const totalW = totalBtn * btnW + (totalBtn - 1) * gap;
    
    let startX = (w - totalW) / 2;
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `14px Inter, sans-serif`;

    const drawBtn = (x, text, isActive, isEnabled) => {
      this._roundRect(ctx, x, (h - btnW)/2, btnW, btnW, r);
      if (isActive) {
        ctx.fillStyle = c.primary;
        ctx.fill();
        ctx.fillStyle = '#0b1c30';
      } else {
        ctx.strokeStyle = c.border;
        ctx.stroke();
        ctx.fillStyle = isEnabled ? c.text : c.muted;
      }
      ctx.fillText(text, x + btnW/2, h/2);
    };

    drawBtn(startX, '<', false, active > 1);
    startX += btnW + gap;
    
    for (let i = 1; i <= pages; i++) {
      drawBtn(startX, String(i), i === active, true);
      startX += btnW + gap;
    }
    
    drawBtn(startX, '>', false, active < pages);
  }

  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const lines = text.split('\n');
    let currentY = y;

    for (let i = 0; i < lines.length; i++) {
      const words = lines[i].split(' ');
      let line = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, x, currentY);
          line = words[n] + ' ';
          currentY += lineHeight;
        } else if (testWidth > maxWidth && n === 0) {
          // Word itself is longer than maxWidth
          let charLine = '';
          const chars = words[n].split('');
          for (let c = 0; c < chars.length; c++) {
            const testCharLine = charLine + chars[c];
            if (ctx.measureText(testCharLine).width > maxWidth && c > 0) {
              ctx.fillText(charLine, x, currentY);
              charLine = chars[c];
              currentY += lineHeight;
            } else {
              charLine = testCharLine;
            }
          }
          line = charLine + ' ';
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    }
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
