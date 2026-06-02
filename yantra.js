// Sri Yantra Sacred Geometry and Animation Engine
// Generates, scales, and animates the Sri Yantra geometrically

const SVG_NS = "http://www.w3.org/2000/svg";

// State Management
const state = {
  cx: 500,
  cy: 500,
  r: 175,
  rotation: 0,
  rotationSpeed: 0.15, // degrees per frame
  isPlaying: false,
  duration: 600, // 10 minutes in seconds
  timeLeft: 600,
  syncMode: 'zigzag', // 'zigzag', 'wave', 'breathing', 'still'
  theme: 'gold',     // 'gold', 'indigo', 'emerald', 'crimson'
  
  // Animation variables
  zigzagIndex: 0,
  zigzagSpeed: 0.35, // speed of sequential line tracing
  radialWaveR: 0,
  radialWaveSpeed: 4.0, // speed of expanding radial wave
  breathingScale: 1.0,
  breathingTimer: 0,
  breathingState: 'inhale', // 'inhale', 'hold-in', 'exhale', 'hold-out'
  
  // Audio configuration link
  binauralFreq: 6,
  
  // Gayatri Mantra Lyric configuration
  lyricsVisible: true
};

// Lists of generated SVG elements for real-time glow control
let yantraLines = [];
let leftSideElements = [];
let rightSideElements = [];
let centerElements = [];

// Particle Starfield variables
let starfieldCanvas;
let starctx;
let stars = [];

// Breathing rhythm sequence: 4s inhale, 4s hold, 4s exhale, 4s hold (Sama Vritti / Box Breathing)
const breathingPattern = {
  inhale: 4000,
  holdIn: 4000,
  exhale: 4000,
  holdOut: 4000
};

// Math Helpers for Geometric Solver
function getInfiniteLineIntersection(p1, p2, p3, p4) {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;
  const D = dx1 * dy2 - dy1 * dx2;
  if (D === 0) return null;
  const t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / D;
  return { x: p1.x + t * dx1, y: p1.y + t * dy1 };
}

function reflectPointAboutYAxis(point, cx) {
  return { x: cx + (cx - point.x), y: point.y };
}

function getPointOnCircle(cx, cy, r, angleInDegrees) {
  const angleInRadians = angleInDegrees * (Math.PI / 180);
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians)
  };
}

function getPointOnCircleFromPoint(point, cx, cy, r, angleInDegrees) {
  const currentAngle = Math.atan2(point.y - cy, point.x - cx);
  const angleInRadians = angleInDegrees * (Math.PI / 180);
  const newAngle = currentAngle + angleInRadians;
  return {
    x: cx + r * Math.cos(newAngle),
    y: cy + r * Math.sin(newAngle)
  };
}

function getLineCircleIntersections(lineP1, lineP2, cx, cy, r) {
  const dx = lineP2.x - lineP1.x;
  const dy = lineP2.y - lineP1.y;
  const A = dx * dx + dy * dy;
  const B = 2 * (dx * (lineP1.x - cx) + dy * (lineP1.y - cy));
  const C = (lineP1.x - cx) * (lineP1.x - cx) + (lineP1.y - cy) * (lineP1.y - cy) - r * r;
  const discriminant = B * B - 4 * A * C;
  const intersections = [];
  if (discriminant < 0) return intersections;
  if (discriminant === 0) {
    const t = -B / (2 * A);
    intersections.push({ x: lineP1.x + t * dx, y: lineP1.y + t * dy });
  } else {
    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-B + sqrtDisc) / (2 * A);
    const t2 = (-B - sqrtDisc) / (2 * A);
    intersections.push({ x: lineP1.x + t1 * dx, y: lineP1.y + t1 * dy });
    intersections.push({ x: lineP1.x + t2 * dx, y: lineP1.y + t2 * dy });
  }
  return intersections;
}

function swapPointsIfNeeded(p1, p2) {
  return p1.x > p2.x ? [p2, p1] : [p1, p2];
}

function sortTrianglePointsByX(tri) {
  const pts = [tri.p1, tri.p2, tri.p3].sort((a, b) => a.x - b.x);
  return { p1: pts[0], p2: pts[1], p3: pts[2] };
}

// SVG Element Builders
function createSVGLine(p1, p2, className) {
  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", p1.x);
  line.setAttribute("y1", p1.y);
  line.setAttribute("x2", p2.x);
  line.setAttribute("y2", p2.y);
  line.setAttribute("class", className);
  
  // Store midpoints and radial distance for geometric tracing and radial waves
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const radialDist = Math.sqrt((midX - 500) * (midX - 500) + (midY - 500) * (midY - 500));
  
  line.setAttribute("data-mid-x", midX);
  line.setAttribute("data-radial-dist", radialDist);
  
  categorizeElement(line, midX);
  return line;
}

function createSVGPath(d, className, midX) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("class", className);
  path.setAttribute("data-mid-x", midX);
  
  // Compute radial distance relative to center
  const radialDist = Math.abs(midX - 500);
  path.setAttribute("data-radial-dist", radialDist);
  
  // Traditional theme visual overrides
  if (state.theme === 'traditional') {
    if (className === "yantra-bhupura") {
      path.setAttribute("fill", "#2ba150"); // Vivid leaf green
      path.setAttribute("stroke", "#d4af37"); // Rich gold border
      path.setAttribute("stroke-width", "3.5px");
      path.style.opacity = "1.0";
    } else if (className === "yantra-petal") {
      // Differentiate 8-petal and 16-petal lotus by radius
      // 8 petals radius is ~262px, 16 petals radius is ~306px
      if (radialDist < 280) {
        path.setAttribute("fill", "#c62828"); // Deep crimson red
        path.setAttribute("stroke", "#d4af37"); // Gold border
      } else {
        path.setAttribute("fill", "#fdd835"); // Vibrant warm yellow
        path.setAttribute("stroke", "#b58d22"); // Gold-dark border
      }
      path.setAttribute("stroke-width", "1.5px");
      path.style.opacity = "1.0";
    }
  }
  
  categorizeElement(path, midX);
  return path;
}

function createSVGCircle(cx, cy, r, className) {
  const circ = document.createElementNS(SVG_NS, "circle");
  circ.setAttribute("cx", cx);
  circ.setAttribute("cy", cy);
  circ.setAttribute("r", r);
  circ.setAttribute("class", className);
  circ.setAttribute("data-mid-x", cx);
  circ.setAttribute("data-radial-dist", r);
  
  // Traditional theme backing circles (provides white background for the triangles)
  if (state.theme === 'traditional') {
    circ.setAttribute("fill", "#ffffff"); // White backing
    circ.setAttribute("stroke", "#d4af37"); // Gold border
    circ.setAttribute("stroke-width", "1.5px");
    circ.style.opacity = "1.0";
  }
  
  categorizeElement(circ, cx);
  return circ;
}

// Categorize element to support Bilateral Synchronization (EMDR)
function categorizeElement(element, midX) {
  yantraLines.push(element);
  
  // If midpoint is very close to vertical axis of symmetry (x=500), consider it center
  if (Math.abs(midX - 500) < 5) {
    centerElements.push(element);
  } else if (midX < 500) {
    leftSideElements.push(element);
  } else {
    rightSideElements.push(element);
  }
}

// Core Geometric Renderer of the Sri Yantra
function drawSriYantra() {
  const yantra = document.getElementById("sri");
  if (!yantra) return;
  
  // Clear previous drawings
  yantra.innerHTML = "";
  yantraLines = [];
  leftSideElements = [];
  rightSideElements = [];
  centerElements = [];
  
  const cx = state.cx;
  const cy = state.cy;
  const r = state.r;

  // 1. Draw Outer Gateway Frame (3 concentric stepped Bhupuras)
  const bhupuraBorders = [r * 2.3, r * 2.15, r * 2.0];
  const gateWidth = r * 0.55;
  const gateDepth = r * 0.12;
  const gateEar = r * 0.1;
  
  bhupuraBorders.forEach((L, index) => {
    const w = gateWidth;
    const d = gateDepth;
    const e = gateEar;
    
    // Draw 4 symmetric stepped sides of the citadel
    // Top Side
    const topD = `M ${cx - L},${cy - L} L ${cx - w/2},${cy - L} L ${cx - w/2},${cy - L - d} L ${cx - w/2 - e},${cy - L - d} L ${cx - w/2 - e},${cy - L - 2*d} L ${cx + w/2 + e},${cy - L - 2*d} L ${cx + w/2 + e},${cy - L - d} L ${cx + w/2},${cy - L - d} L ${cx + w/2},${cy - L} L ${cx + L},${cy - L}`;
    yantra.appendChild(createSVGPath(topD, "yantra-bhupura", cx));
    
    // Right Side
    const rightD = `M ${cx + L},${cy - L} L ${cx + L},${cy - w/2} L ${cx + L + d},${cy - w/2} L ${cx + L + d},${cy - w/2 - e} L ${cx + L + 2*d},${cy - w/2 - e} L ${cx + L + 2*d},${cy + w/2 + e} L ${cx + L + d},${cy + w/2 + e} L ${cx + L + d},${cy + w/2} L ${cx + L},${cy + w/2} L ${cx + L},${cy + L}`;
    yantra.appendChild(createSVGPath(rightD, "yantra-bhupura", cx + L + d));
    
    // Bottom Side
    const bottomD = `M ${cx + L},${cy + L} L ${cx + w/2},${cy + L} L ${cx + w/2},${cy + L + d} L ${cx + w/2 + e},${cy + L + d} L ${cx + w/2 + e},${cy + L + 2*d} L ${cx - w/2 - e},${cy + L + 2*d} L ${cx - w/2 - e},${cy + L + d} L ${cx - w/2},${cy + L + d} L ${cx - w/2},${cy + L} L ${cx - L},${cy + L}`;
    yantra.appendChild(createSVGPath(bottomD, "yantra-bhupura", cx));
    
    // Left Side
    const leftD = `M ${cx - L},${cy + L} L ${cx - L},${cy + w/2} L ${cx - L - d},${cy + w/2} L ${cx - L - d},${cy + w/2 + e} L ${cx - L - 2*d},${cy + w/2 + e} L ${cx - L - 2*d},${cy - w/2 - e} L ${cx - L - d},${cy - w/2 - e} L ${cx - L - d},${cy - w/2} L ${cx - L},${cy - w/2} L ${cx - L},${cy - L}`;
    yantra.appendChild(createSVGPath(leftD, "yantra-bhupura", cx - L - d));
  });
  
  // 2. Draw Concentric Circles
  const circleRadius3 = r * 1.75; // Outside 16 petals
  const circleRadius2 = r * 1.5;  // Outside 8 petals
  const circleRadius1 = r * 1.16;  // Outside triangles
  
  // Triple boundary circle
  yantra.appendChild(createSVGCircle(cx, cy, circleRadius3, "yantra-circle"));
  yantra.appendChild(createSVGCircle(cx, cy, circleRadius3 - 6, "yantra-circle"));
  yantra.appendChild(createSVGCircle(cx, cy, circleRadius3 - 12, "yantra-circle"));
  
  // 3. Draw 16 Lotus Petals
  drawLotusPetals(yantra, cx, cy, circleRadius2, 16, r * 0.25);
  
  // Circle bounding 8 petals
  yantra.appendChild(createSVGCircle(cx, cy, circleRadius2, "yantra-circle"));
  
  // 4. Draw 8 Lotus Petals
  drawLotusPetals(yantra, cx, cy, circleRadius1, 8, r * 0.34);
  
  // Inner circle enclosing the triangles
  yantra.appendChild(createSVGCircle(cx, cy, circleRadius1, "yantra-circle"));
  
  // 5. Mathematical Sri Yantra Triangle Solver
  const innerR = circleRadius1;
  const P_top = { x: cx, y: cy - innerR };
  const P_bottom = { x: cx, y: cy + innerR };
  
  // Helper points on circle
  const P1 = getPointOnCircle(cx, cy, innerR, -30);
  const P2 = getPointOnCircle(cx, cy, innerR, -150);
  const P3 = getPointOnCircle(cx, cy, innerR, 150);
  const P4 = getPointOnCircle(cx, cy, innerR, 30);
  const P_left = { x: cx - innerR, y: cy };
  const P_right = { x: cx + innerR, y: cy };
  
  // DOWN 1 TRIANGLE (d1)
  const d1_i1 = getInfiniteLineIntersection(P_bottom, P2, P_left, P_top);
  const d1_i2 = getInfiniteLineIntersection(P_bottom, P1, P_right, P_top);
  const d1_intersections = getLineCircleIntersections(d1_i1, d1_i2, cx, cy, innerR);
  const d1_base = swapPointsIfNeeded(d1_intersections[0], d1_intersections[1]);
  
  const d1 = { p1: d1_base[0], p2: P_bottom, p3: d1_base[1] };
  const d1_leftline = { p1: d1_base[0], p2: P_bottom };
  const d1_rightline = { p1: d1_base[1], p2: P_bottom };
  drawTriangleLines(yantra, d1, "d1");
  
  // UP 1 TRIANGLE (u1)
  const u1_markertip = { x: cx, y: d1_base[0].y };
  const u1_markerline1 = { p1: P3, p2: u1_markertip };
  const u1_basemarkerpoint1 = getInfiniteLineIntersection(u1_markerline1.p1, u1_markerline1.p2, d1_leftline.p1, d1_leftline.p2);
  const u1_markerline2 = { p1: P4, p2: u1_markertip };
  const u1_basemarkerpoint2 = getInfiniteLineIntersection(u1_markerline2.p1, u1_markerline2.p2, d1_rightline.p1, d1_rightline.p2);
  const u1_baselinemarker = { p1: u1_basemarkerpoint1, p2: u1_basemarkerpoint2 };
  const u1_baseintersection = getLineCircleIntersections(u1_baselinemarker.p1, u1_baselinemarker.p2, cx, cy, innerR);
  const u1_base = swapPointsIfNeeded(u1_baseintersection[0], u1_baseintersection[1]);
  
  const u1 = { p1: u1_base[0], p2: P_top, p3: u1_base[1] };
  const u1_leftline = { p1: u1_base[0], p2: P_top };
  const u1_rightline = { p1: u1_base[1], p2: P_top };
  drawTriangleLines(yantra, u1, "u1");
  
  // UP 2 TRIANGLE (u2)
  const d3_leftmarkerpoint = getPointOnCircleFromPoint(u1.p1, cx, cy, innerR, 60);
  const u2_tip = { x: cx, y: d3_leftmarkerpoint.y };
  const d3_rightmarkerpoint = getPointOnCircleFromPoint(u1.p3, cx, cy, innerR, -60);
  const d1LeftAndU1BaseLineIntersection = getInfiniteLineIntersection(d1_leftline.p1, d1_leftline.p2, u1_base[0], u1_base[1]);
  
  const u2_leftline = { p1: d1LeftAndU1BaseLineIntersection, p2: u2_tip };
  const u2_rightline = { p1: reflectPointAboutYAxis(d1LeftAndU1BaseLineIntersection, cx), p2: u2_tip };
  const d3_basemarkerline = { p1: d3_leftmarkerpoint, p2: d3_rightmarkerpoint };
  
  // DOWN 2 TRIANGLE (d2)
  const u3_leftmarkerpoint = getPointOnCircleFromPoint(d1.p1, cx, cy, innerR, -60);
  const d2_tip = { x: cx, y: u3_leftmarkerpoint.y };
  const u3_rightmarkerpoint = getPointOnCircleFromPoint(d1.p3, cx, cy, innerR, 60);
  const u1LeftAndD1BaseLineIntersection = getInfiniteLineIntersection(u1_leftline.p1, u1_leftline.p2, d1_base[0], d1_base[1]);
  
  const d2_leftline = { p1: u1LeftAndD1BaseLineIntersection, p2: d2_tip };
  const d2_rightline = { p1: reflectPointAboutYAxis(u1LeftAndD1BaseLineIntersection, cx), p2: d2_tip };
  const u3_basemarkerline = { p1: u3_leftmarkerpoint, p2: u3_rightmarkerpoint };
  
  // UP 3 TRIANGLE (u3)
  const U3_tip = { x: cx, y: d1_base[0].y };
  const U3_leftmarkerpoint = getInfiniteLineIntersection(d2_leftline.p1, d2_leftline.p2, u1_base[0], u1_base[1]);
  const U3_leftline = { p1: U3_leftmarkerpoint, p2: U3_tip };
  const U3_rightline = { p1: reflectPointAboutYAxis(U3_leftmarkerpoint, cx), p2: U3_tip };
  
  const u3_leftpoint = getInfiniteLineIntersection(U3_leftline.p1, U3_leftline.p2, u3_basemarkerline.p1, u3_basemarkerline.p2);
  const u3_rightpoint = reflectPointAboutYAxis(u3_leftpoint, cx);
  
  const u3 = { p1: u3_leftpoint, p2: U3_tip, p3: u3_rightpoint };
  drawTriangleLines(yantra, u3, "u3");
  
  // Render completed u2
  const u2_base_markerline = {
    p1: getInfiniteLineIntersection(d1_leftline.p1, d1_leftline.p2, U3_leftline.p1, U3_leftline.p2),
    p2: getInfiniteLineIntersection(d1_rightline.p1, d1_rightline.p2, U3_rightline.p1, U3_rightline.p2)
  };
  const u2_baseline_p1 = getInfiniteLineIntersection(u2_leftline.p1, u2_leftline.p2, u2_base_markerline.p1, u2_base_markerline.p2);
  const u2_baseline_p2 = getInfiniteLineIntersection(u2_rightline.p1, u2_rightline.p2, u2_base_markerline.p1, u2_base_markerline.p2);
  const u2_baseline = swapPointsIfNeeded(u2_baseline_p1, u2_baseline_p2);
  
  const u2 = { p1: u2_baseline[0], p2: u2_tip, p3: u2_baseline[1] };
  drawTriangleLines(yantra, u2, "u2");
  
  // DOWN 3 TRIANGLE (d3)
  const u2_leftlineAndD1BaseLineIntersection = getInfiniteLineIntersection(u2_leftline.p1, u2_leftline.p2, d1_base[0], d1_base[1]);
  const u2_rightlineAndU1BaseLineIntersection = getInfiniteLineIntersection(u2_rightline.p1, u2_rightline.p2, u1_base[0], u1_base[1]);
  const centerDownSlopeLine = { p1: u2_leftlineAndD1BaseLineIntersection, p2: u2_rightlineAndU1BaseLineIntersection };
  
  const u2_leftlineAndU1BaseLineIntersection = getInfiniteLineIntersection(u2_leftline.p1, u2_leftline.p2, u1_base[0], u1_base[1]);
  const u2_rightlineAndD1BaseLineIntersection = getInfiniteLineIntersection(u2_rightline.p1, u2_rightline.p2, d1_base[0], d1_base[1]);
  const centerUpSlopeLine = { p1: u2_leftlineAndU1BaseLineIntersection, p2: u2_rightlineAndD1BaseLineIntersection };
  
  const U4_base_line_p1 = getInfiniteLineIntersection(d2_rightline.p1, d2_rightline.p2, centerDownSlopeLine.p1, centerDownSlopeLine.p2);
  const U4_base_line_p2 = getInfiniteLineIntersection(d2_leftline.p1, d2_leftline.p2, centerUpSlopeLine.p1, centerUpSlopeLine.p2);
  const U4_base_line = swapPointsIfNeeded(U4_base_line_p1, U4_base_line_p2);
  
  const D3_tip = { x: cx, y: U4_base_line[0].y };
  const D3_leftline = { p1: centerDownSlopeLine.p1, p2: D3_tip };
  const D3_rightline = { p1: centerUpSlopeLine.p2, p2: D3_tip };
  
  const d3_leftpoint = getInfiniteLineIntersection(D3_leftline.p1, D3_leftline.p2, d3_basemarkerline.p1, d3_basemarkerline.p2);
  const d3_rightpoint = getInfiniteLineIntersection(D3_rightline.p1, D3_rightline.p2, d3_basemarkerline.p1, d3_basemarkerline.p2);
  
  const d3 = { p1: d3_leftpoint, p2: D3_tip, p3: d3_rightpoint };
  drawTriangleLines(yantra, d3, "d3");
  
  // Render completed d2
  const D2_base_line_p1 = getInfiniteLineIntersection(u1_leftline.p1, u1_leftline.p2, D3_leftline.p1, D3_leftline.p2);
  const D2_base_line_p2 = getInfiniteLineIntersection(u1_rightline.p1, u1_rightline.p2, D3_rightline.p1, D3_rightline.p2);
  const D2_base_line = swapPointsIfNeeded(D2_base_line_p1, D2_base_line_p2);
  
  const d2_leftpoint = getInfiniteLineIntersection(d2_leftline.p1, d2_leftline.p2, D2_base_line[0], D2_base_line[1]);
  const d2_rightpoint = getInfiniteLineIntersection(d2_rightline.p1, d2_rightline.p2, D2_base_line[0], D2_base_line[1]);
  
  const d2 = { p1: d2_leftpoint, p2: d2_tip, p3: d2_rightpoint };
  drawTriangleLines(yantra, d2, "d2");
  
  // Render completed UP 4 TRIANGLE (u4)
  const u4_tip = { x: cx, y: D2_base_line[0].y };
  const u4 = { p1: U4_base_line[0], p2: u4_tip, p3: reflectPointAboutYAxis(U4_base_line[0], cx) };
  drawTriangleLines(yantra, u4, "u4");
  
  // DOWN 4 TRIANGLE (d4)
  const D4_base_line_p1 = getInfiniteLineIntersection(D3_leftline.p1, D3_leftline.p2, u4.p1, u4.p2);
  const D4_base_line_p2 = getInfiniteLineIntersection(D3_rightline.p1, D3_rightline.p2, u4.p2, u4.p3);
  const D4_base_line = swapPointsIfNeeded(D4_base_line_p1, D4_base_line_p2);
  
  const d4_leftpoint = getInfiniteLineIntersection(u2_leftline.p1, u2_leftline.p2, D4_base_line[0], D4_base_line[1]);
  const d4_rightpoint = getInfiniteLineIntersection(u2_rightline.p1, u2_rightline.p2, D4_base_line[0], D4_base_line[1]);
  const d4_tip = { x: cx, y: u2_baseline[0].y };
  
  const d4 = { p1: d4_leftpoint, p2: d4_tip, p3: d4_rightpoint };
  drawTriangleLines(yantra, d4, "d4");
  
  // DOWN 5 TRIANGLE (d5)
  const D5_base_line_p1 = getInfiniteLineIntersection(D3_leftline.p1, D3_leftline.p2, u3.p1, u3.p2);
  const D5_base_line_p2 = getInfiniteLineIntersection(D3_rightline.p1, D3_rightline.p2, u3.p2, u3.p3);
  const D5_base_line = swapPointsIfNeeded(D5_base_line_p1, D5_base_line_p2);
  
  const d5_leftpoint = getInfiniteLineIntersection(u4.p1, u4.p2, D5_base_line[0], D5_base_line[1]);
  const d5_rightpoint = getInfiniteLineIntersection(u4.p2, u4.p3, D5_base_line[0], D5_base_line[1]);
  const d5_tip = { x: cx, y: u1_base[0].y };
  
  const d5 = { p1: d5_leftpoint, p2: d5_tip, p3: d5_rightpoint };
  drawTriangleLines(yantra, d5, "d5");
  
  // 6. Draw Central Bindu Point
  const binduNode = document.createElementNS(SVG_NS, "circle");
  binduNode.setAttribute("cx", cx);
  binduNode.setAttribute("cy", cy + r * 0.05); // Traditionally offset slightly downwards in the inner triangle
  binduNode.setAttribute("r", 4.5);
  binduNode.setAttribute("class", "yantra-bindu");
  if (state.theme === 'traditional') {
    binduNode.setAttribute("fill", "#c62828"); // Red Shakti Bindu
    binduNode.setAttribute("stroke", "#d4af37"); // Gold border
    binduNode.setAttribute("stroke-width", "1.5px");
  }
  yantra.appendChild(binduNode);
  
  console.log(`Sri Yantra generated successfully: ${yantraLines.length} visual components structured.`);
}

function drawTriangleLines(yantra, tri, triId) {
  const t = sortTrianglePointsByX(tri);
  
  // Draw the filled polygon in the background for traditional theme
  if (state.theme === 'traditional') {
    const poly = document.createElementNS(SVG_NS, "polygon");
    const pointsStr = `${t.p1.x},${t.p1.y} ${t.p2.x},${t.p2.y} ${t.p3.x},${t.p3.y}`;
    poly.setAttribute("points", pointsStr);
    
    // Traditional colors of Sri Yantra interlocking rings
    let fillCol = "rgba(255, 255, 255, 0.9)";
    let strokeCol = "#d4af37";
    
    if (triId === "d1" || triId === "d2" || triId === "d4" || triId === "d5") {
      // Shakti downwards triangles - Beautiful transparent blues
      fillCol = "rgba(41, 128, 185, 0.32)";
      strokeCol = "#2980b9";
    } else if (triId === "u1" || triId === "u2" || triId === "u3" || triId === "u4") {
      // Shiva upwards triangles - Beautiful transparent reds
      fillCol = "rgba(192, 57, 43, 0.32)";
      strokeCol = "#c0392b";
    } else if (triId === "d3") {
      // Central downwards triangle - Vibrant gold yellow
      fillCol = "rgba(241, 196, 15, 0.9)";
      strokeCol = "#d35400";
    }
    
    poly.setAttribute("fill", fillCol);
    poly.setAttribute("stroke", strokeCol);
    poly.setAttribute("stroke-width", "1.5px");
    yantra.appendChild(poly);
  }
  
  // Build 3 separate outlines for animation sweeps
  let strokeStyle = "";
  if (state.theme === 'traditional') {
    if (triId === "d1" || triId === "d2" || triId === "d4" || triId === "d5") {
      strokeStyle = "stroke: #2980b9;";
    } else if (triId === "u1" || triId === "u2" || triId === "u3" || triId === "u4") {
      strokeStyle = "stroke: #c0392b;";
    } else if (triId === "d3") {
      strokeStyle = "stroke: #d35400; stroke-width: 2px;";
    }
  }
  
  const l1 = createSVGLine(t.p1, t.p2, "yantra-line");
  const l2 = createSVGLine(t.p2, t.p3, "yantra-line");
  const l3 = createSVGLine(t.p3, t.p1, "yantra-line");
  
  if (strokeStyle) {
    l1.setAttribute("style", strokeStyle);
    l2.setAttribute("style", strokeStyle);
    l3.setAttribute("style", strokeStyle);
  }
  
  yantra.appendChild(l1);
  yantra.appendChild(l2);
  yantra.appendChild(l3);
}

// Draw elegant lotus petals using SVG quadratic curves
function drawLotusPetals(yantra, cx, cy, innerR, count, petalHeight) {
  const outerR = innerR + petalHeight;
  const midR = innerR + petalHeight / 2;
  const divisions = count * 4;
  
  // Generate outer circular points for curves
  const getCircPt = (radius, angleDeg) => {
    const rad = angleDeg * (Math.PI / 180);
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };
  
  for (let i = 0; i < count; i++) {
    const startDiv = i * 4;
    const petalAngleCenter = (360 / count) * (i + 0.5);
    
    // Key control points for the petal curves
    const c1_0 = getCircPt(innerR, (360 / divisions) * startDiv);
    const c2_0 = getCircPt(outerR, (360 / divisions) * startDiv);
    const c2_1 = getCircPt(outerR, (360 / divisions) * (startDiv + 1));
    const c2_2 = getCircPt(outerR, (360 / divisions) * (startDiv + 2));
    const c3_2 = getCircPt(midR, (360 / divisions) * (startDiv + 2));
    const c3_3 = getCircPt(midR, (360 / divisions) * (startDiv + 3));
    const c2_3 = getCircPt(outerR, (360 / divisions) * (startDiv + 3));
    const c2_4 = getCircPt(outerR, (360 / divisions) * (startDiv + 4));
    const c1_4 = getCircPt(innerR, (360 / divisions) * (startDiv + 4));
    
    // Construct petal outline using quadratic curves
    const pathD = `M ${c1_0.x},${c1_0.y} Q ${c2_0.x},${c2_0.y} ${c2_1.x},${c2_1.y} Q ${c2_2.x},${c2_2.y} ${c3_2.x},${c2_2.y} Q ${c3_3.x},${c3_3.y} ${c2_3.x},${c2_3.y} Q ${c2_4.x},${c2_4.y} ${c1_4.x},${c1_4.y}`;
    
    // Calculate petal's horizontal midpoint for sweep mapping
    const petalTipPt = getPointOnCircle(cx, cy, outerR, petalAngleCenter);
    yantra.appendChild(createSVGPath(pathD, "yantra-petal", petalTipPt.x));
  }
}

// Particle Starfield Background Renderer
function initStarfield() {
  starfieldCanvas = document.getElementById("starfield");
  if (!starfieldCanvas) return;
  
  starctx = starfieldCanvas.getContext("2d");
  resizeStarfield();
  
  window.addEventListener('resize', resizeStarfield);
  
  // Create stars
  stars = [];
  const starCount = 120;
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * starfieldCanvas.width,
      y: Math.random() * starfieldCanvas.height,
      radius: Math.random() * 1.5 + 0.2,
      depth: Math.random() * 0.8 + 0.2,
      opacity: Math.random() * 0.6 + 0.2,
      pulseSpeed: Math.random() * 0.02 + 0.005,
      pulseTimer: Math.random() * Math.PI
    });
  }
}

function resizeStarfield() {
  if (!starfieldCanvas) return;
  starfieldCanvas.width = window.innerWidth;
  starfieldCanvas.height = window.innerHeight;
}

function drawStarfield() {
  if (!starctx || !starfieldCanvas) return;
  
  // Clear starfield
  starctx.clearRect(0, 0, starfieldCanvas.width, starfieldCanvas.height);
  
  const themeRGB = state.theme === 'gold' ? '212, 175, 55' : 
                   state.theme === 'indigo' ? '99, 102, 241' : 
                   state.theme === 'emerald' ? '16, 185, 129' : '244, 63, 94';
  
  stars.forEach(star => {
    // Pulse stars softly
    star.pulseTimer += star.pulseSpeed;
    const currentOpacity = star.opacity + Math.sin(star.pulseTimer) * 0.15;
    
    starctx.beginPath();
    starctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    starctx.fillStyle = `rgba(${themeRGB}, ${currentOpacity})`;
    starctx.fill();
    
    // Slow drift of starfield
    star.x -= 0.15 * star.depth;
    if (star.x < 0) {
      star.x = starfieldCanvas.width;
      star.y = Math.random() * starfieldCanvas.height;
    }
  });
}

// Breathing Cycle Controller (Sama Vritti Box Breathing)
function updateBreathingCycle(deltaTime) {
  state.breathingTimer += deltaTime;
  
  let label = "Breathe In";
  let scale = 1.0;
  
  const stageDuration = 4000; // 4 seconds per box side
  const cycleTime = state.breathingTimer % (stageDuration * 4);
  
  // Map breathing phase to Gayatri Mantra Lyric Index!
  let lyricIdx = 0;
  
  if (cycleTime < stageDuration) {
    // Inhale: expand ring from scale 1.0 to 1.18
    state.breathingState = 'inhale';
    const progress = cycleTime / stageDuration;
    scale = 1.0 + progress * 0.18;
    label = "Inhale";
    lyricIdx = 0;
  } else if (cycleTime < stageDuration * 2) {
    // Hold In: maintain scale at 1.18
    state.breathingState = 'hold-in';
    scale = 1.18;
    label = "Hold In";
    lyricIdx = 1;
  } else if (cycleTime < stageDuration * 3) {
    // Exhale: contract ring from scale 1.18 to 1.0
    state.breathingState = 'exhale';
    const progress = (cycleTime - stageDuration * 2) / stageDuration;
    scale = 1.18 - progress * 0.18;
    label = "Exhale";
    lyricIdx = 2;
  } else {
    // Hold Out: maintain scale at 1.0
    state.breathingState = 'hold-out';
    scale = 1.0;
    label = "Hold Out";
    lyricIdx = 3;
  }
  
  state.breathingScale = scale;
  
  // Smooth breathing guide scale ring in DOM
  const ring = document.querySelector(".breathing-ring");
  const breathingLabel = document.querySelector(".breathing-label");
  if (ring) {
    ring.style.transform = `scale(${scale})`;
  }
  if (breathingLabel && breathingLabel.innerHTML !== label) {
    breathingLabel.innerHTML = label;
  }
  
  // Update Gayatri Lyrics Overlay in lockstep with breathing pranayama!
  const overlay = document.getElementById("mantra-overlay");
  if (state.lyricsVisible && state.isPlaying) {
    const sanskritText = document.getElementById("mantra-sanskrit");
    const translitText = document.getElementById("mantra-translit");
    const translationText = document.getElementById("mantra-translation");
    
    const gayatriLyrics = [
      { sanskrit: "ॐ भूर्भुवः स्वः ।", translit: "oṃ bhūr bhuvaḥ svaḥ", translation: "We contemplate the cosmic fields of physical, vital, and causal existence." },
      { sanskrit: "तत्सवितुर्वरेण्यं ।", translit: "tat savitur vareṇyaṃ", translation: "May we absorb the sublime, radiant light of the creative solar consciousness." },
      { sanskrit: "भर्गो देवस्य धीमहि ।", translit: "bhargo devasya dhīmahi", translation: "May it dissolve all mental darkness, impurities, and intellectual ignorance." },
      { sanskrit: "धियो यो नः प्रचोदयात् ॥", translit: "dhiyo yo naḥ pracodayāt", translation: "And awaken, inspire, and illuminate our minds into pure awareness." }
    ];
    
    if (overlay && !overlay.classList.contains("visible")) {
      overlay.classList.add("visible");
    }
    
    const currentLyric = gayatriLyrics[lyricIdx];
    if (sanskritText && sanskritText.innerHTML !== currentLyric.sanskrit) {
      // Soft crossfade transition
      sanskritText.style.opacity = "0";
      translitText.style.opacity = "0";
      translationText.style.opacity = "0";
      
      setTimeout(() => {
        sanskritText.innerHTML = currentLyric.sanskrit;
        translitText.innerHTML = currentLyric.translit;
        translationText.innerHTML = currentLyric.translation;
        
        sanskritText.style.opacity = "1";
        translitText.style.opacity = "1";
        translationText.style.opacity = "1";
      }, 250);
    }
  } else {
    if (overlay && overlay.classList.contains("visible")) {
      overlay.classList.remove("visible");
    }
  }
}

// Dynamic Animation Engine Loop
let lastTime = 0;

function animationLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;
  
  // 1. Draw Starfield
  drawStarfield();
  
  // 2. Slow Yantra spin
  const wrapper = document.querySelector(".yantra-wrapper");
  if (wrapper && state.isPlaying) {
    state.rotation += state.rotationSpeed;
    wrapper.style.transform = `rotate(${state.rotation}deg)`;
  }
  
  // 3. Perform Brain Hemisphere Sync and Line Glow Modulation
  if (state.isPlaying) {
    updateBreathingCycle(deltaTime);
    applyHemisphereSync(timestamp);
  } else {
    // Still state: uniform, soft resting glow
    yantraLines.forEach(line => {
      line.classList.remove("active");
      line.style.opacity = "0.45";
    });
  }
  
  requestAnimationFrame(animationLoop);
}

// Bilateral Eye Movement and Hemisphere Stimulator Engine
function applyHemisphereSync(timestamp) {
  if (state.syncMode === 'zigzag') {
    // Sacred Zig-Zag Flow: highlight lines in sequence!
    state.zigzagIndex += state.zigzagSpeed;
    if (state.zigzagIndex >= yantraLines.length) {
      state.zigzagIndex = 0;
    }
    
    const currentIdx = Math.floor(state.zigzagIndex);
    
    yantraLines.forEach((line, idx) => {
      // Highlight active line and apply a trail to the previous 5 lines
      const trailLength = 6;
      let diff = currentIdx - idx;
      if (diff < 0) diff += yantraLines.length; // wrap-around trail
      
      if (diff === 0) {
        line.classList.add("active");
        line.style.opacity = "1.0";
      } else if (diff < trailLength) {
        line.classList.remove("active");
        // Fading trail
        line.style.opacity = (1.0 - diff / trailLength).toFixed(2);
      } else {
        line.classList.remove("active");
        line.style.opacity = "0.2";
      }
    });
  } 
  
  else if (state.syncMode === 'wave') {
    // Concentric Circle Ripples: radial wave expanding outwards
    state.radialWaveR += state.radialWaveSpeed;
    if (state.radialWaveR > 750) {
      state.radialWaveR = 0; // reset wave
    }
    
    const waveWidth = 80; // width of radial glow wave
    
    yantraLines.forEach(line => {
      const radialDist = parseFloat(line.getAttribute("data-radial-dist"));
      const dist = Math.abs(radialDist - state.radialWaveR);
      
      if (dist < waveWidth) {
        const intensity = 1.0 - dist / waveWidth;
        line.classList.add("active");
        line.style.opacity = intensity.toFixed(2);
      } else {
        line.classList.remove("active");
        line.style.opacity = "0.2";
      }
    });
  } 
  
  else if (state.syncMode === 'breathing') {
    // Breathing Harmony: glow pulses globally in sync with breathing box-scale
    const minGlow = 0.3;
    const maxGlow = 1.0;
    const currentGlow = minGlow + (state.breathingScale - 1.0) / 0.18 * (maxGlow - minGlow);
    
    yantraLines.forEach(line => {
      line.style.opacity = currentGlow.toFixed(2);
      if (currentGlow > 0.8) {
        line.classList.add("active");
      } else {
        line.classList.remove("active");
      }
    });
  } 
  
  else {
    // Stillness focus: all elements glow softly for focal Trataka meditation
    yantraLines.forEach(line => {
      line.style.opacity = "0.8";
      line.classList.add("active");
    });
  }
}

// Timer and Session controller
let sessionTimerInterval = null;

function startMeditationSession() {
  if (state.isPlaying) return;
  
  state.isPlaying = true;
  state.timeLeft = state.duration;
  
  // 1. Trigger audio start
  audio.start();
  
  // 2. Clear previous session intervals
  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  
  // 3. UI Changes
  const startBtn = document.querySelector(".start-meditation-btn");
  const hud = document.querySelector(".hud-display");
  const ring = document.querySelector(".breathing-ring");
  
  if (startBtn) {
    startBtn.innerHTML = "Stop Meditation";
    startBtn.classList.add("running");
  }
  if (hud) hud.classList.add("visible");
  if (ring) ring.classList.add("active");
  
  // Collapse side panel for visual immersive focus on desktop
  if (window.innerWidth > 900) {
    const panel = document.querySelector(".settings-panel");
    const toggleBtn = document.querySelector(".toggle-settings-btn");
    if (panel) {
      panel.classList.add("collapsed");
      if (toggleBtn) toggleBtn.innerHTML = "⚙️";
    }
  }
  
  // 4. Timer loop
  updateHUDTimerText();
  sessionTimerInterval = setInterval(() => {
    state.timeLeft--;
    updateHUDTimerText();
    
    // Update circular progress overlay
    const progressCircle = document.querySelector(".circle-progress");
    if (progressCircle) {
      const radius = 26;
      const circumference = 2 * Math.PI * radius;
      const progressRatio = state.timeLeft / state.duration;
      const strokeDashoffset = circumference * (1 - progressRatio);
      progressCircle.style.strokeDashoffset = strokeDashoffset;
    }
    
    if (state.timeLeft <= 0) {
      endMeditationSession(true);
    }
  }, 1000);
}

function endMeditationSession(completed = false) {
  if (!state.isPlaying) return;
  
  state.isPlaying = false;
  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  
  // Stop audio generators
  audio.stop();
  
  // Reset HUD
  const startBtn = document.querySelector(".start-meditation-btn");
  const hud = document.querySelector(".hud-display");
  const ring = document.querySelector(".breathing-ring");
  const panel = document.querySelector(".settings-panel");
  const toggleBtn = document.querySelector(".toggle-settings-btn");
  
  if (startBtn) {
    startBtn.innerHTML = "Start Meditation";
    startBtn.classList.remove("running");
  }
  if (hud) hud.classList.remove("visible");
  if (ring) ring.classList.remove("active");
  if (panel) panel.classList.remove("collapsed");
  if (toggleBtn) toggleBtn.innerHTML = "✕";
  
  // Reset rotation and line glow
  yantraLines.forEach(line => {
    line.classList.remove("active");
    line.style.opacity = "0.45";
  });
  
  if (completed) {
    playCompletionChime();
    showCompletionModal();
  }
}

function updateHUDTimerText() {
  const min = Math.floor(state.timeLeft / 60);
  const sec = state.timeLeft % 60;
  const timeStr = `${min}:${sec.toString().padStart(2, '0')}`;
  
  const hudText = document.querySelector(".hud-timer");
  const overlayText = document.querySelector(".timer-text-overlay");
  
  if (hudText) hudText.innerHTML = timeStr;
  if (overlayText) overlayText.innerHTML = timeStr;
}

// Gentle chime to signal session ending
function playCompletionChime() {
  try {
    audio.playSpatialChime(0);
    setTimeout(() => {
      audio.playSpatialChime(1);
    }, 200);
  } catch (e) {
    console.warn("Chime playback error:", e);
  }
}

function showCompletionModal() {
  const overlay = document.getElementById("completion-modal");
  if (overlay) overlay.classList.add("visible");
}

function closeCompletionModal() {
  const overlay = document.getElementById("completion-modal");
  if (overlay) overlay.classList.remove("visible");
}

// Headphone Calibration Overlay triggers
function startHeadphoneTest() {
  const testBtn = document.getElementById("headphone-test-btn");
  if (!testBtn) return;
  
  testBtn.disabled = true;
  testBtn.innerHTML = "⚙️ Testing Channels...";
  
  const textVal = document.querySelector(".sound-test-btn");
  
  audio.testHeadphones(
    () => {
      testBtn.innerHTML = "🔊 Left Ear Playing...";
      testBtn.style.color = "var(--accent-color)";
      document.body.setAttribute("data-theme", state.theme);
    },
    () => {
      testBtn.innerHTML = "🔊 Right Ear Playing...";
    },
    () => {
      testBtn.innerHTML = "✓ Channels Balanced";
      testBtn.style.color = "var(--text-secondary)";
      setTimeout(() => {
        testBtn.disabled = false;
        testBtn.innerHTML = "Spatial Sound Calibration";
      }, 2500);
    }
  );
}

// Page Initialization Bindings
window.addEventListener("DOMContentLoaded", () => {
  // 1. Draw Sri Yantra SVG
  drawSriYantra();
  
  // 2. Initialize starfield background
  initStarfield();
  
  // 3. Start animation frame loop
  requestAnimationFrame(animationLoop);
  
  // 4. Set circle progress overlay dash-array size
  const progressCircle = document.querySelector(".circle-progress");
  if (progressCircle) {
    const radius = 26;
    const circumference = 2 * Math.PI * radius;
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressCircle.style.strokeDashoffset = circumference;
  }
});
