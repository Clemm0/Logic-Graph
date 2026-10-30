var LEFT = 90;
var GATE_W = 64;
var TOP = 34;
var BUBBLE_R = 5.5;
var ANIM_MS = 450;
function gatePath(shape, H) {
  const r = H / 2;
  switch (shape) {
    case "AND":
      return `M0,0 H${52 - r} A${r},${r} 0 0 1 ${52 - r},${H} H0 Z`;
    case "OR":
    case "XOR":
      return `M0,0 Q32,0 52,${r} Q32,${H} 0,${H} Q14,${r} 0,0 Z`;
    default:
      return `M0,0 L52,${r} L0,${H} Z`;
  }
}
var CH_FIRST = 18;
var CH_STEP = 6;
var CH_MARGIN = 14;
var laneY = (lane) => 6 + 6 * lane;
var channelNeed = (tracks) => CH_FIRST + CH_STEP * Math.max(0, tracks - 1) + CH_MARGIN;
function layout(c, geo) {
  const SP = 40 + geo.vgap, GAP = geo.vgap, T0 = TOP + (geo.topPad || 0);
  const level = {}, cy = {};
  c.inputs.forEach((n, i) => {
    level[n] = 0;
    cy[n] = T0 + i * SP;
  });
  c.order.forEach((g) => {
    g.level = 1 + Math.max(...g.ins.map((x) => level[x]));
    level[g.out] = g.level;
    g.H = Math.max(44, 14 * (g.ins.length + 1));
  });
  const maxL = c.order.length ? Math.max(...c.order.map((g) => g.level)) : 0;
  const colX = {};
  for (let L = 1; L <= maxL; L++) {
    const need = geo.gapBefore && geo.gapBefore[L] || 0;
    colX[L] = L === 1 ? LEFT + Math.max(70, need) : colX[L - 1] + GATE_W + Math.max(geo.hgap, need);
  }
  c.order.forEach((g) => {
    g.x0 = colX[g.level];
  });
  let bottom = T0 + Math.max(0, c.inputs.length - 1) * SP + 12;
  for (let L = 1; L <= maxL; L++) {
    const gs = c.order.filter((g) => g.level === L);
    gs.forEach((g) => {
      g.want = g.ins.reduce((a, x) => a + cy[x], 0) / g.ins.length;
    });
    gs.sort((a, b) => a.want - b.want);
    let prevBottom = -Infinity;
    gs.forEach((g) => {
      const top = Math.max(g.want - g.H / 2, prevBottom + GAP + 14);
      g.cy = top + g.H / 2;
      prevBottom = top + g.H;
      cy[g.out] = g.cy;
      bottom = Math.max(bottom, prevBottom);
    });
  }
  let right = LEFT + 40;
  c.order.forEach((g) => {
    right = Math.max(right, g.x0 + GATE_W + 16);
  });
  c.outputs.forEach((n) => {
    right = Math.max(right, c.driver[n].x0 + GATE_W + 52 + n.length * 8 + 12);
  });
  return { cy, maxL, width: right, height: bottom + TOP };
}
function wireChannel(g, i, hgap) {
  const n = g.ins.length, avail = Math.max(10, hgap - 6), first = Math.min(20, avail / 2);
  const step = n > 1 ? Math.min(7, (avail - first) / (n - 1)) : 0;
  return g.x0 - first - step * i;
}
function planRoutes(c, L, hgap) {
  const boxes = c.order.map((g) => ({ g, x0: g.x0 - 2, x1: g.x0 + GATE_W + 2, y0: g.cy - g.H / 2 - 14, y1: g.cy + g.H / 2 + 16 }));
  const routes = /* @__PURE__ */ new Map();
  let lanes = 0;
  c.order.forEach((g) => g.ins.forEach((sig, i) => {
    const d = c.driver[sig];
    const ax = d ? d.x0 + GATE_W : LEFT, ay = d ? d.cy : L.cy[sig], mx = wireChannel(g, i, hgap);
    if (boxes.some((b) => b.g !== g && b.g !== d && b.x1 > ax + 2 && b.x0 < mx && ay > b.y0 && ay < b.y1)) {
      routes.set(g.out + ":" + i, { lane: lanes % 5 });
      lanes++;
    }
  }));
  return { routes, lanes: Math.min(lanes, 5) };
}
function planChannels(c, L, plan) {
  const byLevel = /* @__PURE__ */ new Map();
  c.order.forEach((g) => {
    if (!byLevel.has(g.level)) byLevel.set(g.level, []);
    byLevel.get(g.level).push(g);
  });
  const trackOf = /* @__PURE__ */ new Map(), tracks = {}, nets = {};
  for (const [lvl, gates] of byLevel) {
    const perNet = /* @__PURE__ */ new Map();
    gates.forEach((g) => g.ins.forEach((sig, i) => {
      const key = g.out + ":" + i, d = c.driver[sig], route = plan.routes.get(key);
      const ay = route ? laneY(route.lane) : d ? d.cy : L.cy[sig];
      const py = g.cy - g.H / 2 + g.H * (i + 1) / (g.ins.length + 1);
      if (!perNet.has(sig)) perNet.set(sig, { sig, lo: Infinity, hi: -Infinity, keys: [], track: 0 });
      const n = perNet.get(sig);
      n.lo = Math.min(n.lo, ay, py);
      n.hi = Math.max(n.hi, ay, py);
      n.keys.push(key);
    }));
    const list = [...perNet.values()].sort((a, b) => a.lo - b.lo || a.hi - b.hi);
    const ends = [];
    list.forEach((n) => {
      if (n.hi - n.lo >= 1) {
        let t = ends.findIndex((end) => end < n.lo - 5);
        if (t < 0) {
          t = ends.length;
          ends.push(-Infinity);
        }
        ends[t] = n.hi;
        n.track = t;
      }
      n.keys.forEach((k) => trackOf.set(k, n.track));
    });
    tracks[lvl] = Math.max(1, ends.length);
    nets[lvl] = list;
  }
  return { trackOf, tracks, nets };
}
function solveGap(c, vgap, targetW) {
  const L0 = layout(c, { hgap: 90, vgap });
  if (L0.maxL < 2) return 90;
  return clamp(90 + (targetW - L0.width) / (L0.maxL - 1), 40, 1e3);
}