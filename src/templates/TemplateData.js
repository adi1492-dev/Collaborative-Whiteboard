/**
 * TemplateData — Pre-built board templates for Brainstorming, Wireframe, Retro, and Mindmap.
 * Each template returns an array of element-like JSON objects.
 * IDs are placeholders and will be replaced with fresh UUIDs on load.
 */

const COLORS = {
  purple: '#c0c1ff',
  blue: '#60a5fa',
  green: '#34d399',
  yellow: '#fbbf24',
  red: '#f87171',
  pink: '#f472b6',
  orange: '#fb923c',
  gray: '#9ca3af',
};

function sticky(id, x, y, text, color, w = 220, h = 140) {
  return {
    id, type: 'sticky', x, y, width: w, height: h,
    text, zIndex: 1, opacity: 1, visible: true, locked: false, rotation: 0,
    style: { fillColor: color, strokeColor: 'transparent', strokeWidth: 0, fontSize: 14, fontFamily: 'Inter, sans-serif', textAlign: 'center' },
    createdAt: Date.now(), updatedAt: Date.now(), createdBy: null
  };
}

function shape(id, x, y, w, h, shapeType, fill, stroke, text = '') {
  return {
    id, type: 'shape', x, y, width: w, height: h,
    shapeType, text, zIndex: 0, opacity: 1, visible: true, locked: false, rotation: 0,
    style: { fillColor: fill, strokeColor: stroke, strokeWidth: 2, fontSize: 14, fontFamily: 'Inter, sans-serif', textAlign: 'center' },
    createdAt: Date.now(), updatedAt: Date.now(), createdBy: null
  };
}

function textEl(id, x, y, text, fontSize = 24, bold = false, color = '#c0c1ff') {
  return {
    id, type: 'text', x, y, width: 400, height: fontSize * 1.6,
    text, zIndex: 2, opacity: 1, visible: true, locked: false, rotation: 0,
    style: { fillColor: 'transparent', strokeColor: 'transparent', strokeWidth: 0, fontSize, fontFamily: 'Inter, sans-serif', textAlign: 'left', fontWeight: bold ? 'bold' : 'normal', color },
    createdAt: Date.now(), updatedAt: Date.now(), createdBy: null
  };
}

// ─── BRAINSTORMING TEMPLATE ──────────────────────────────────────────────────

const BRAINSTORMING = [
  textEl('t-bh', 300, 20, '🧠 Brainstorming Session', 28, true),
  // Center topic
  shape('t-bc', 420, 200, 240, 100, 'ellipse', 'rgba(192,193,255,0.2)', COLORS.purple, 'Main Topic'),
  // Branches
  sticky('t-b1', 80, 100, '💡 Idea 1\n\nWrite your first key idea here', 'rgba(192,193,255,0.15)'),
  sticky('t-b2', 740, 100, '💡 Idea 2\n\nAdd another perspective here', 'rgba(96,165,250,0.15)'),
  sticky('t-b3', 80, 350, '🎯 Opportunity\n\nWhat opportunity does this unlock?', 'rgba(52,211,153,0.15)'),
  sticky('t-b4', 740, 350, '⚠️ Challenge\n\nWhat obstacles do we face?', 'rgba(251,191,36,0.15)'),
  sticky('t-b5', 300, 500, '✅ Next Action\n\nWhat is the first step we take?', 'rgba(248,113,113,0.15)'),
  sticky('t-b6', 560, 500, '👥 Who Is Responsible?\n\nAssign ownership here', 'rgba(244,114,182,0.15)'),
];

// ─── WIREFRAME TEMPLATE ──────────────────────────────────────────────────────

const WIREFRAME = [
  textEl('t-wh', 100, 10, '📱 App Wireframe', 28, true),
  // Phone frame
  shape('t-wf', 100, 60, 300, 560, 'rounded-rect', 'rgba(255,255,255,0.05)', COLORS.gray),
  // Status bar
  shape('t-wsb', 115, 80, 270, 24, 'rect', 'rgba(156,163,175,0.2)', 'transparent'),
  // Nav bar
  shape('t-wnav', 115, 570, 270, 40, 'rect', 'rgba(192,193,255,0.15)', COLORS.purple),
  // Content blocks
  shape('t-wimg', 130, 120, 238, 140, 'rect', 'rgba(156,163,175,0.15)', COLORS.gray, 'Hero Image'),
  shape('t-wt1', 130, 275, 238, 24, 'rect', 'rgba(192,193,255,0.1)', 'transparent', 'Title Text'),
  shape('t-wt2', 130, 310, 180, 16, 'rect', 'rgba(156,163,175,0.1)', 'transparent', 'Subtitle'),
  shape('t-wbtn', 170, 380, 160, 44, 'rect', 'rgba(192,193,255,0.3)', COLORS.purple, 'CTA Button'),
  shape('t-wcard1', 130, 445, 110, 110, 'rect', 'rgba(156,163,175,0.1)', COLORS.gray, 'Card 1'),
  shape('t-wcard2', 255, 445, 110, 110, 'rect', 'rgba(156,163,175,0.1)', COLORS.gray, 'Card 2'),
  // Annotations
  sticky('t-wa1', 460, 80, '📐 Layout Notes\n\nTop navigation + hero pattern. CTA below fold.', 'rgba(251,191,36,0.1)', 220, 120),
  sticky('t-wa2', 460, 220, '🎨 Style Notes\n\nPrimary: #c0c1ff\nFont: Inter 16px\nRadius: 12px', 'rgba(96,165,250,0.1)', 220, 120),
];

// ─── RETRO TEMPLATE ──────────────────────────────────────────────────────────

const RETRO = [
  textEl('t-rh', 260, 10, '🔄 Sprint Retrospective', 28, true),
  // Column headers
  textEl('t-rh1', 60, 60, '😊 Went Well', 18, true, COLORS.green),
  textEl('t-rh2', 360, 60, '😞 Could Improve', 18, true, COLORS.red),
  textEl('t-rh3', 660, 60, '🚀 Action Items', 18, true, COLORS.blue),
  // Column lanes
  shape('t-rc1', 40, 55, 270, 600, 'rect', 'rgba(52,211,153,0.05)', 'rgba(52,211,153,0.2)'),
  shape('t-rc2', 340, 55, 270, 600, 'rect', 'rgba(248,113,113,0.05)', 'rgba(248,113,113,0.2)'),
  shape('t-rc3', 640, 55, 270, 600, 'rect', 'rgba(96,165,250,0.05)', 'rgba(96,165,250,0.2)'),
  // Sample stickies
  sticky('t-rg1', 55, 100, '✅ Great team communication this sprint!', 'rgba(52,211,153,0.15)', 240, 100),
  sticky('t-rg2', 55, 220, '✅ Delivered all stories before deadline', 'rgba(52,211,153,0.15)', 240, 100),
  sticky('t-rb1', 355, 100, '❌ Too many context switches hurt focus', 'rgba(248,113,113,0.15)', 240, 100),
  sticky('t-rb2', 355, 220, '❌ Stand-ups ran too long on Thursdays', 'rgba(248,113,113,0.15)', 240, 100),
  sticky('t-ra1', 655, 100, '➡️ Block 2h focus time on calendars', 'rgba(96,165,250,0.15)', 240, 100),
  sticky('t-ra2', 655, 220, '➡️ Set 15min timebox for stand-ups', 'rgba(96,165,250,0.15)', 240, 100),
];

// ─── MIND MAP TEMPLATE ───────────────────────────────────────────────────────

const MINDMAP = [
  textEl('t-mh', 340, 10, '🗺️ Mind Map', 28, true),
  // Center
  shape('t-mc', 400, 250, 200, 80, 'ellipse', 'rgba(192,193,255,0.25)', COLORS.purple, 'Central Idea'),
  // Level 1 branches
  shape('t-m1', 100, 80, 160, 60, 'ellipse', 'rgba(96,165,250,0.2)', COLORS.blue, 'Branch A'),
  shape('t-m2', 740, 80, 160, 60, 'ellipse', 'rgba(52,211,153,0.2)', COLORS.green, 'Branch B'),
  shape('t-m3', 100, 400, 160, 60, 'ellipse', 'rgba(251,191,36,0.2)', COLORS.yellow, 'Branch C'),
  shape('t-m4', 740, 400, 160, 60, 'ellipse', 'rgba(248,113,113,0.2)', COLORS.red, 'Branch D'),
  // Level 2 leaves
  sticky('t-ml1', -100, -20, 'Sub-idea 1', 'rgba(96,165,250,0.1)', 160, 70),
  sticky('t-ml2', -100, 80, 'Sub-idea 2', 'rgba(96,165,250,0.1)', 160, 70),
  sticky('t-ml3', 940, -20, 'Sub-idea 3', 'rgba(52,211,153,0.1)', 160, 70),
  sticky('t-ml4', 940, 80, 'Sub-idea 4', 'rgba(52,211,153,0.1)', 160, 70),
  sticky('t-ml5', -100, 350, 'Sub-idea 5', 'rgba(251,191,36,0.1)', 160, 70),
  sticky('t-ml6', -100, 450, 'Sub-idea 6', 'rgba(251,191,36,0.1)', 160, 70),
  sticky('t-ml7', 940, 350, 'Sub-idea 7', 'rgba(248,113,113,0.1)', 160, 70),
  sticky('t-ml8', 940, 450, 'Sub-idea 8', 'rgba(248,113,113,0.1)', 160, 70),
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
};
