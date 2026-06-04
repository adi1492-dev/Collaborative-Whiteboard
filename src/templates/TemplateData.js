/**
 * TemplateData — Pre-built board templates for Brainstorming, Wireframe, Retro, Mindmap, Kanban, SWOT, etc.
 * Each template returns an array of element-like JSON objects.
 * IDs are placeholders and will be replaced with fresh UUIDs on load.
 */

// Improved aesthetic color palette with better contrast for backgrounds
const COLORS = {
  purple: '#818cf8',
  blue: '#60a5fa',
  green: '#34d399',
  yellow: '#fbb515',
  red: '#f87171',
  pink: '#f472b6',
  orange: '#fb923c',
  gray: '#9ca3af',
  darkBg: '#1e293b',
  lightBg: '#f8fafc',
  darkText: '#0f172a',
  lightText: '#ffffff'
};

// Pale backgrounds for better text visibility
const PALE = {
  purple: '#e0e7ff',
  blue: '#dbeafe',
  green: '#d1fae5',
  yellow: '#fef3c7',
  red: '#fee2e2',
  pink: '#fce7f3',
  orange: '#ffedd5',
  gray: '#f3f4f6'
};

function sticky(id, x, y, text, bgColor, w = 220, h = 140, textColor = COLORS.darkText) {
  return {
    id, type: 'sticky', x, y, width: w, height: h,
    text, zIndex: 1, opacity: 1, visible: true, locked: false, rotation: 0,
    style: { fillColor: bgColor, strokeColor: 'transparent', strokeWidth: 0, fontSize: 14, fontFamily: 'Inter, sans-serif', textAlign: 'center', color: textColor },
    createdAt: Date.now(), updatedAt: Date.now(), createdBy: null
  };
}

function shape(id, x, y, w, h, shapeType, fill, stroke, text = '', textColor = COLORS.darkText) {
  return {
    id, type: 'shape', x, y, width: w, height: h,
    shapeType, text, zIndex: 0, opacity: 1, visible: true, locked: false, rotation: 0,
    style: { fillColor: fill, strokeColor: stroke, strokeWidth: 2, fontSize: 14, fontFamily: 'Inter, sans-serif', textAlign: 'center', color: textColor },
    createdAt: Date.now(), updatedAt: Date.now(), createdBy: null
  };
}

function textEl(id, x, y, text, fontSize = 24, bold = false, color = COLORS.purple) {
  return {
    id, type: 'text', x, y, width: 400, height: fontSize * 1.6,
    text, zIndex: 2, opacity: 1, visible: true, locked: false, rotation: 0,
    style: { fillColor: 'transparent', strokeColor: 'transparent', strokeWidth: 0, fontSize, fontFamily: 'Inter, sans-serif', textAlign: 'left', fontWeight: bold ? 'bold' : 'normal', color },
    createdAt: Date.now(), updatedAt: Date.now(), createdBy: null
  };
}

// ─── BRAINSTORMING TEMPLATE ──────────────────────────────────────────────────

const BRAINSTORMING = [
  textEl('t-bh', 300, 20, '🧠 Brainstorming Session', 28, true, COLORS.purple),
  shape('t-bc', 420, 200, 240, 100, 'ellipse', PALE.purple, COLORS.purple, 'Main Topic', COLORS.darkText),
  sticky('t-b1', 80, 100, '💡 Idea 1\n\nWrite your first key idea here', PALE.purple),
  sticky('t-b2', 740, 100, '💡 Idea 2\n\nAdd another perspective here', PALE.blue),
  sticky('t-b3', 80, 350, '🎯 Opportunity\n\nWhat opportunity does this unlock?', PALE.green),
  sticky('t-b4', 740, 350, '⚠️ Challenge\n\nWhat obstacles do we face?', PALE.yellow),
  sticky('t-b5', 300, 500, '✅ Next Action\n\nWhat is the first step we take?', PALE.red),
  sticky('t-b6', 560, 500, '👥 Who Is Responsible?\n\nAssign ownership here', PALE.pink),
];

// ─── WIREFRAME TEMPLATE ──────────────────────────────────────────────────────

const WIREFRAME = [
  textEl('t-wh', 100, 10, '📱 App Wireframe', 28, true, COLORS.gray),
  shape('t-wf', 100, 60, 300, 560, 'rounded-rect', PALE.gray, COLORS.gray),
  shape('t-wsb', 115, 80, 270, 24, 'rect', COLORS.gray, 'transparent'),
  shape('t-wnav', 115, 570, 270, 40, 'rect', COLORS.purple, COLORS.purple),
  shape('t-wimg', 130, 120, 238, 140, 'rect', PALE.gray, COLORS.gray, 'Hero Image', COLORS.darkText),
  shape('t-wt1', 130, 275, 238, 24, 'rect', PALE.blue, 'transparent', 'Title Text', COLORS.darkText),
  shape('t-wt2', 130, 310, 180, 16, 'rect', PALE.gray, 'transparent', 'Subtitle', COLORS.darkText),
  shape('t-wbtn', 170, 380, 160, 44, 'rect', COLORS.purple, COLORS.purple, 'CTA Button', COLORS.lightText),
  shape('t-wcard1', 130, 445, 110, 110, 'rect', PALE.gray, COLORS.gray, 'Card 1', COLORS.darkText),
  shape('t-wcard2', 255, 445, 110, 110, 'rect', PALE.gray, COLORS.gray, 'Card 2', COLORS.darkText),
  sticky('t-wa1', 460, 80, '📐 Layout Notes\n\nTop navigation + hero pattern. CTA below fold.', PALE.yellow, 220, 120),
  sticky('t-wa2', 460, 220, '🎨 Style Notes\n\nPrimary: #818cf8\nFont: Inter 16px\nRadius: 12px', PALE.blue, 220, 120),
];

// ─── RETRO TEMPLATE ──────────────────────────────────────────────────────────

const RETRO = [
  textEl('t-rh', 260, 10, '🔄 Sprint Retrospective', 28, true, COLORS.darkText),
  textEl('t-rh1', 60, 60, '😊 Went Well', 18, true, COLORS.green),
  textEl('t-rh2', 360, 60, '😞 Could Improve', 18, true, COLORS.red),
  textEl('t-rh3', 660, 60, '🚀 Action Items', 18, true, COLORS.blue),
  shape('t-rc1', 40, 55, 270, 600, 'rect', 'transparent', COLORS.green),
  shape('t-rc2', 340, 55, 270, 600, 'rect', 'transparent', COLORS.red),
  shape('t-rc3', 640, 55, 270, 600, 'rect', 'transparent', COLORS.blue),
  sticky('t-rg1', 55, 100, '✅ Great team communication this sprint!', PALE.green, 240, 100),
  sticky('t-rg2', 55, 220, '✅ Delivered all stories before deadline', PALE.green, 240, 100),
  sticky('t-rb1', 355, 100, '❌ Too many context switches hurt focus', PALE.red, 240, 100),
  sticky('t-rb2', 355, 220, '❌ Stand-ups ran too long on Thursdays', PALE.red, 240, 100),
  sticky('t-ra1', 655, 100, '➡️ Block 2h focus time on calendars', PALE.blue, 240, 100),
  sticky('t-ra2', 655, 220, '➡️ Set 15min timebox for stand-ups', PALE.blue, 240, 100),
];

// ─── MIND MAP TEMPLATE ───────────────────────────────────────────────────────

const MINDMAP = [
  textEl('t-mh', 340, 10, '🗺️ Mind Map', 28, true, COLORS.purple),
  shape('t-mc', 400, 250, 200, 80, 'ellipse', COLORS.purple, COLORS.purple, 'Central Idea', COLORS.lightText),
  shape('t-m1', 100, 80, 160, 60, 'ellipse', COLORS.blue, COLORS.blue, 'Branch A', COLORS.lightText),
  shape('t-m2', 740, 80, 160, 60, 'ellipse', COLORS.green, COLORS.green, 'Branch B', COLORS.lightText),
  shape('t-m3', 100, 400, 160, 60, 'ellipse', COLORS.yellow, COLORS.yellow, 'Branch C', COLORS.darkText),
  shape('t-m4', 740, 400, 160, 60, 'ellipse', COLORS.red, COLORS.red, 'Branch D', COLORS.lightText),
  sticky('t-ml1', -100, -20, 'Sub-idea 1', PALE.blue, 160, 70),
  sticky('t-ml2', -100, 80, 'Sub-idea 2', PALE.blue, 160, 70),
  sticky('t-ml3', 940, -20, 'Sub-idea 3', PALE.green, 160, 70),
  sticky('t-ml4', 940, 80, 'Sub-idea 4', PALE.green, 160, 70),
  sticky('t-ml5', -100, 350, 'Sub-idea 5', PALE.yellow, 160, 70),
  sticky('t-ml6', -100, 450, 'Sub-idea 6', PALE.yellow, 160, 70),
  sticky('t-ml7', 940, 350, 'Sub-idea 7', PALE.red, 160, 70),
  sticky('t-ml8', 940, 450, 'Sub-idea 8', PALE.red, 160, 70),
];

// ─── KANBAN TEMPLATE ─────────────────────────────────────────────────────────

const KANBAN = [
  textEl('k-h', 260, 10, '📋 Kanban Board', 28, true, COLORS.darkText),
  textEl('k-h1', 60, 60, '📝 To Do', 18, true, COLORS.gray),
  textEl('k-h2', 360, 60, '🚧 In Progress', 18, true, COLORS.blue),
  textEl('k-h3', 660, 60, '✅ Done', 18, true, COLORS.green),
  shape('k-c1', 40, 55, 270, 700, 'rect', PALE.gray, 'transparent'),
  shape('k-c2', 340, 55, 270, 700, 'rect', PALE.blue, 'transparent'),
  shape('k-c3', 640, 55, 270, 700, 'rect', PALE.green, 'transparent'),
  sticky('k-i1', 55, 100, 'Research competitor features', '#ffffff', 240, 100),
  sticky('k-i2', 55, 220, 'Update landing page copy', '#ffffff', 240, 100),
  sticky('k-i3', 355, 100, 'Implement user authentication', '#ffffff', 240, 100),
  sticky('k-i4', 655, 100, 'Fix navigation bug', '#ffffff', 240, 100),
];

// ─── SWOT ANALYSIS TEMPLATE ──────────────────────────────────────────────────

const SWOT = [
  textEl('s-h', 420, 20, '📊 SWOT Analysis', 28, true, COLORS.darkText),
  shape('s-bg1', 100, 80, 400, 300, 'rect', PALE.green, COLORS.green),
  shape('s-bg2', 520, 80, 400, 300, 'rect', PALE.red, COLORS.red),
  shape('s-bg3', 100, 400, 400, 300, 'rect', PALE.blue, COLORS.blue),
  shape('s-bg4', 520, 400, 400, 300, 'rect', PALE.yellow, COLORS.yellow),
  textEl('s-th1', 120, 100, '💪 Strengths', 22, true, COLORS.green),
  textEl('s-th2', 540, 100, '📉 Weaknesses', 22, true, COLORS.red),
  textEl('s-th3', 120, 420, '🌟 Opportunities', 22, true, COLORS.blue),
  textEl('s-th4', 540, 420, '⚠️ Threats', 22, true, COLORS.orange),
  sticky('s-i1', 140, 160, 'Strong brand recognition', '#ffffff', 320, 80),
  sticky('s-i2', 560, 160, 'High operational costs', '#ffffff', 320, 80),
  sticky('s-i3', 140, 480, 'Emerging market in Asia', '#ffffff', 320, 80),
  sticky('s-i4', 560, 480, 'New competitor entering market', '#ffffff', 320, 80),
];

export const TEMPLATES = {
  brainstorming: {
    id: 'brainstorming',
    name: 'Brainstorming',
    icon: '🧠',
    description: 'Generate ideas around a central topic with structured branches.',
    elements: BRAINSTORMING,
  },
  wireframe: {
    id: 'wireframe',
    name: 'UI Wireframe',
    icon: '📱',
    description: 'Sketch a mobile app interface with blocks and annotations.',
    elements: WIREFRAME,
  },
  retro: {
    id: 'retro',
    name: 'Sprint Retrospective',
    icon: '🔄',
    description: 'Three-column format: What went well, what to improve, actions.',
    elements: RETRO,
  },
  mindmap: {
    id: 'mindmap',
    name: 'Mind Map',
    icon: '🗺️',
    description: 'Radial layout connecting a central idea to branching concepts.',
    elements: MINDMAP,
  },
  kanban: {
    id: 'kanban',
    name: 'Kanban Board',
    icon: '📋',
    description: 'Manage tasks across To Do, In Progress, and Done columns.',
    elements: KANBAN,
  },
  swot: {
    id: 'swot',
    name: 'SWOT Analysis',
    icon: '📊',
    description: 'Evaluate Strengths, Weaknesses, Opportunities, and Threats.',
    elements: SWOT,
  },
};
