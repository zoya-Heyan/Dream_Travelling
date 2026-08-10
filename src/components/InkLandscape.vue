<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

export type LandscapeTheme = 'danxia' | 'ink'

const props = withDefaults(
  defineProps<{
    theme?: LandscapeTheme
  }>(),
  { theme: 'danxia' },
)

interface Point {
  x: number
  y: number
  ox: number
  oy: number
  vx: number
  vy: number
}

interface Stroke {
  points: Point[]
  width: number
  alpha: number
  color: string
  soft?: boolean
}

const INK_STROKE = '#e8f6f7'

/** Danxia strata palette — terracotta, ochre, cream, cool accents */
const PALETTE = {
  ridge: '#8b3a2a',
  deepRed: '#b5452c',
  terracotta: '#c45c3e',
  brick: '#d4683a',
  orange: '#e08a45',
  ochre: '#d4a24a',
  mustard: '#c9b06a',
  cream: '#d8c9a8',
  sand: '#c4b59a',
  teal: '#5a8f8a',
  slate: '#7a8a92',
  sage: '#8aa090',
  charcoal: '#5c5348',
} as const

const STRATA = [
  PALETTE.deepRed,
  PALETTE.terracotta,
  PALETTE.brick,
  PALETTE.orange,
  PALETTE.ochre,
  PALETTE.mustard,
  PALETTE.cream,
  PALETTE.teal,
  PALETTE.sage,
  PALETTE.slate,
] as const

const canvasRef = ref<HTMLCanvasElement | null>(null)

let strokes: Stroke[] = []
let raf = 0
let width = 0
let height = 0
let dpr = 1
let pointerX = -9999
let pointerY = -9999
let pointerActive = false
let prevPointerX = -9999
let prevPointerY = -9999
let pointerVX = 0
let pointerVY = 0
let reducedMotion = false

function makePoint(x: number, y: number): Point {
  return { x, y, ox: x, oy: y, vx: 0, vy: 0 }
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Sample a ridge height profile at normalized x (0–1). */
function ridgeY(t: number, base: number, amp: number, seed: number): number {
  const a = Math.sin(t * Math.PI * (2.4 + seed * 0.3) + seed) * amp
  const b = Math.sin(t * Math.PI * (5.1 + seed) + seed * 2) * amp * 0.35
  const c = Math.sin(t * Math.PI * 11 + seed * 3) * amp * 0.12
  // Jagged peaks toward center-right like the photo
  const peak =
    Math.pow(Math.max(0, 1 - Math.abs(t - 0.55) * 2.2), 1.6) * amp * 0.9 +
    Math.pow(Math.max(0, 1 - Math.abs(t - 0.28) * 3), 1.4) * amp * 0.55 +
    Math.pow(Math.max(0, 1 - Math.abs(t - 0.78) * 2.8), 1.5) * amp * 0.7
  return base - a - b - c - peak
}

function polyline(xs: number[], ys: number[]): Point[] {
  const pts: Point[] = []
  const n = Math.min(xs.length, ys.length)
  for (let i = 0; i < n; i++) {
    pts.push(makePoint(xs[i], ys[i]))
  }
  return pts
}

function sampleRidge(
  w: number,
  segments: number,
  yFn: (t: number) => number,
  x0 = 0,
  x1 = 1,
): Point[] {
  const pts: Point[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const x = w * (x0 + (x1 - x0) * t)
    pts.push(makePoint(x, yFn(t)))
  }
  return pts
}

/** Contour that follows a hill slope with lateral undulation (strata bands). */
function strataBand(
  w: number,
  h: number,
  yBase: number,
  amp: number,
  seed: number,
  x0: number,
  x1: number,
  slope: number,
  segments: number,
): Point[] {
  return sampleRidge(w, segments, (t) => {
    const worldT = x0 + (x1 - x0) * t
    const undulate =
      Math.sin(t * Math.PI * (1.8 + seed * 0.2) + seed) * amp * 0.45 +
      Math.sin(t * Math.PI * 4.2 + seed * 1.7) * amp * 0.2
    const hill = ridgeY(worldT, yBase, amp * 0.85, seed * 0.4) - yBase
    return yBase + hill * 0.55 + undulate + slope * (t - 0.5) * h * 0.04
  }, x0, x1)
}

function buildDanxia(w: number, h: number): Stroke[] {
  const out: Stroke[] = []
  const add = (
    points: Point[],
    widthPx: number,
    alpha: number,
    color: string,
    soft = false,
  ): void => {
    if (points.length < 2) return
    out.push({ points, width: widthPx, alpha, color, soft })
  }

  // —— Far jagged ridge silhouette ——
  const farBase = h * 0.26
  const farAmp = h * 0.1
  add(
    sampleRidge(w, 90, (t) => ridgeY(t, farBase, farAmp, 1.2)),
    1.85,
    0.82,
    PALETTE.ridge,
  )
  // Inner silhouette echo
  add(
    sampleRidge(w, 72, (t) => ridgeY(t, farBase + h * 0.018, farAmp * 0.75, 1.35)),
    1.15,
    0.35,
    PALETTE.charcoal,
    true,
  )

  // Distant peak teeth (vertical cleft suggestions)
  for (let i = 0; i < 18; i++) {
    const t = 0.08 + i * 0.05
    const x = w * t
    const yTop = ridgeY(t, farBase, farAmp, 1.2)
    const len = h * (0.02 + (i % 3) * 0.012)
    add(
      [makePoint(x, yTop), makePoint(x + (i % 2 === 0 ? 3 : -2), yTop + len)],
      0.7,
      0.28,
      PALETTE.deepRed,
      true,
    )
  }

  // —— Mid-ground stacked strata (left mass) ——
  for (let i = 0; i < 16; i++) {
    const y = h * (0.32 + i * 0.018)
    const color = STRATA[i % STRATA.length]
    const alpha = 0.45 + (i % 4) * 0.08
    const widthPx = i % 5 === 0 ? 1.55 : 0.95
    add(
      strataBand(w, h, y, h * 0.07, 2 + i * 0.15, -0.02, 0.52, -0.8, 48),
      widthPx,
      alpha,
      color,
      i % 3 === 0,
    )
  }

  // —— Mid-ground stacked strata (right mass) ——
  for (let i = 0; i < 14; i++) {
    const y = h * (0.34 + i * 0.019)
    const color = STRATA[(i + 3) % STRATA.length]
    const alpha = 0.42 + (i % 5) * 0.07
    add(
      strataBand(w, h, y, h * 0.065, 4 + i * 0.12, 0.48, 1.05, 0.9, 44),
      i % 4 === 0 ? 1.45 : 0.9,
      alpha,
      color,
      i % 4 === 1,
    )
  }

  // —— Center mid hills with flowing diagonal strata ——
  for (let i = 0; i < 12; i++) {
    const y = h * (0.42 + i * 0.016)
    const color = STRATA[(i + 1) % STRATA.length]
    add(
      strataBand(w, h, y, h * 0.055, 6 + i * 0.2, 0.22, 0.78, (i % 2 === 0 ? -1 : 1) * 0.5, 40),
      1.05,
      0.5,
      color,
    )
  }

  // Bold contour ridges for mass definition
  add(
    sampleRidge(w, 56, (t) => ridgeY(t * 0.55, h * 0.48, h * 0.09, 3) + t * h * 0.04, 0, 0.55),
    2.1,
    0.75,
    PALETTE.terracotta,
  )
  add(
    sampleRidge(w, 56, (t) => ridgeY(0.45 + t * 0.55, h * 0.5, h * 0.1, 3.4) + (1 - t) * h * 0.03, 0.45, 1.02),
    2,
    0.72,
    PALETTE.brick,
  )

  // —— Foreground left slope: dense ribbed flow lines ——
  for (let i = 0; i < 22; i++) {
    const t0 = 0.02 + (i % 7) * 0.01
    const xStart = w * (0.02 + (i / 22) * 0.38)
    const yStart = h * (0.58 + (i % 5) * 0.012)
    const xEnd = xStart + w * (0.12 + (i % 4) * 0.03)
    const yEnd = yStart + h * (0.12 + (i % 3) * 0.02)
    const cx = (xStart + xEnd) / 2 + ((i % 2) * 2 - 1) * w * 0.02
    const cy = (yStart + yEnd) / 2 - h * 0.02
    const pts: Point[] = []
    const segs = 16
    for (let s = 0; s <= segs; s++) {
      const u = s / segs
      const uu = 1 - u
      const x = uu * uu * xStart + 2 * uu * u * cx + u * u * xEnd
      const y =
        uu * uu * yStart +
        2 * uu * u * cy +
        u * u * yEnd +
        Math.sin(u * Math.PI * 3 + t0) * 3
      pts.push(makePoint(x, y))
    }
    add(pts, 0.85 + (i % 3) * 0.2, 0.4 + (i % 4) * 0.08, STRATA[i % STRATA.length])
  }

  // —— Foreground right slope ——
  for (let i = 0; i < 18; i++) {
    const xStart = w * (0.58 + (i / 18) * 0.4)
    const yStart = h * (0.56 + (i % 4) * 0.014)
    const xEnd = xStart - w * (0.08 + (i % 3) * 0.025)
    const yEnd = yStart + h * (0.14 + (i % 3) * 0.018)
    const cx = (xStart + xEnd) / 2
    const cy = (yStart + yEnd) / 2 - h * 0.025
    const pts: Point[] = []
    const segs = 14
    for (let s = 0; s <= segs; s++) {
      const u = s / segs
      const uu = 1 - u
      pts.push(
        makePoint(
          uu * uu * xStart + 2 * uu * u * cx + u * u * xEnd,
          uu * uu * yStart + 2 * uu * u * cy + u * u * yEnd + Math.sin(u * Math.PI * 2.5 + i) * 2.5,
        ),
      )
    }
    add(pts, 0.8 + (i % 3) * 0.15, 0.38 + (i % 3) * 0.1, STRATA[(i + 4) % STRATA.length])
  }

  // —— Central winding valley (S-path), sparse guide lines ——
  const valleyPts: Point[] = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const x = w * (0.48 + Math.sin(t * Math.PI * 1.6) * 0.06 + (t - 0.5) * 0.04)
    const y = h * (0.52 + t * 0.32)
    valleyPts.push(makePoint(x, y))
  }
  add(valleyPts, 1.35, 0.55, PALETTE.sand)

  // Valley banks — soft parallel echoes
  for (const side of [-1, 1] as const) {
    const bank: Point[] = []
    for (let i = 0; i <= 32; i++) {
      const t = i / 32
      const x =
        w * (0.48 + Math.sin(t * Math.PI * 1.6) * 0.06 + (t - 0.5) * 0.04) +
        side * w * (0.035 + t * 0.02)
      const y = h * (0.54 + t * 0.3)
      bank.push(makePoint(x, y))
    }
    add(bank, 0.9, 0.32, side < 0 ? PALETTE.ochre : PALETTE.cream, true)
  }

  // Sparse valley-floor texture (keep center airy)
  for (let i = 0; i < 8; i++) {
    const t = 0.15 + i * 0.1
    const x = w * (0.48 + Math.sin(t * Math.PI * 1.6) * 0.06)
    const y = h * (0.56 + t * 0.28)
    add(
      [
        makePoint(x - w * 0.03, y + 2),
        makePoint(x, y),
        makePoint(x + w * 0.028, y + 3),
      ],
      0.7,
      0.22,
      PALETTE.mustard,
      true,
    )
  }

  // —— Near foreground rolling contours ——
  for (let i = 0; i < 10; i++) {
    const y = h * (0.78 + i * 0.016)
    const color = i % 3 === 0 ? PALETTE.orange : STRATA[(i + 2) % STRATA.length]
    add(
      strataBand(w, h, y, h * 0.035, 8 + i, 0, 0.42, -0.3, 36),
      1.1,
      0.48,
      color,
    )
    add(
      strataBand(w, h, y + h * 0.008, h * 0.03, 9 + i, 0.58, 1.02, 0.35, 36),
      1,
      0.42,
      STRATA[(i + 5) % STRATA.length],
    )
  }

  // Accent cool bands (photo's teal/blue seams)
  add(
    strataBand(w, h, h * 0.4, h * 0.05, 11, 0.1, 0.45, -0.4, 36),
    1.3,
    0.55,
    PALETTE.teal,
  )
  add(
    strataBand(w, h, h * 0.46, h * 0.045, 12, 0.55, 0.95, 0.5, 34),
    1.2,
    0.5,
    PALETTE.slate,
  )
  add(
    strataBand(w, h, h * 0.62, h * 0.04, 13, 0.05, 0.4, -0.6, 30),
    1.15,
    0.48,
    PALETTE.sage,
  )

  // Tiny crest ticks on far ridge for grandeur
  for (let i = 0; i < 10; i++) {
    const t = 0.2 + i * 0.07
    const x = w * t
    const y = ridgeY(t, farBase, farAmp, 1.2)
    add(
      polyline([x - 4, x, x + 5], [y + 6, y - 2, y + 5]),
      0.85,
      0.4,
      PALETTE.deepRed,
    )
  }

  return out
}

function line(x1: number, y1: number, x2: number, y2: number, segments: number): Point[] {
  const pts: Point[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    pts.push(makePoint(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t))
  }
  return pts
}

function curve(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  segments: number,
): Point[] {
  const pts: Point[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const u = 1 - t
    pts.push(
      makePoint(
        u * u * ax + 2 * u * t * bx + t * t * cx,
        u * u * ay + 2 * u * t * by + t * t * cy,
      ),
    )
  }
  return pts
}

function ridge(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  amplitude: number,
  peaks: number,
  segments: number,
): Point[] {
  const pts: Point[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const baseX = startX + (endX - startX) * t
    const baseY = startY + (endY - startY) * t
    const wave = Math.sin(t * Math.PI * peaks) * amplitude * Math.sin(t * Math.PI)
    pts.push(makePoint(baseX, baseY - wave))
  }
  return pts
}

/** Deep-teal ink landscape — mountains, pines, water, boat */
function buildInk(w: number, h: number): Stroke[] {
  const out: Stroke[] = []
  const ink = (points: Point[], widthPx: number, alpha: number, soft = false): void => {
    if (points.length < 2) return
    out.push({ points, width: widthPx, alpha, color: INK_STROKE, soft })
  }

  for (let i = 0; i < 5; i++) {
    const y = h * (0.22 + i * 0.035)
    ink(
      curve(
        w * (-0.05 + i * 0.02),
        y,
        w * (0.35 + i * 0.05),
        y - h * 0.012,
        w * (0.85 + i * 0.04),
        y + h * 0.008,
        28,
      ),
      0.7 + i * 0.08,
      0.1 + i * 0.025,
      true,
    )
  }

  ink(ridge(w * -0.05, h * 0.42, w * 1.05, h * 0.4, h * 0.08, 3.2, 64), 1.1, 0.28, true)
  ink(ridge(w * -0.08, h * 0.48, w * 1.08, h * 0.46, h * 0.12, 4.1, 72), 1.35, 0.4)
  ink(ridge(w * -0.1, h * 0.56, w * 1.1, h * 0.54, h * 0.16, 3.6, 80), 1.7, 0.55)

  ink(curve(w * 0.08, h * 0.58, w * 0.22, h * 0.28, w * 0.38, h * 0.52, 40), 2.1, 0.82)
  ink(curve(w * 0.22, h * 0.28, w * 0.3, h * 0.34, w * 0.42, h * 0.5, 24), 1.4, 0.58)
  ink(curve(w * 0.18, h * 0.4, w * 0.24, h * 0.36, w * 0.3, h * 0.42, 14), 0.9, 0.4)
  ink(curve(w * 0.26, h * 0.35, w * 0.32, h * 0.38, w * 0.36, h * 0.46, 12), 0.85, 0.35)

  ink(curve(w * 0.52, h * 0.55, w * 0.68, h * 0.32, w * 0.92, h * 0.58, 44), 2, 0.78)
  ink(curve(w * 0.68, h * 0.32, w * 0.78, h * 0.38, w * 0.95, h * 0.52, 28), 1.35, 0.55)
  ink(curve(w * 0.62, h * 0.42, w * 0.7, h * 0.4, w * 0.78, h * 0.48, 14), 0.9, 0.38)
  ink(curve(w * 0.74, h * 0.38, w * 0.82, h * 0.42, w * 0.88, h * 0.5, 12), 0.85, 0.32)

  ink(curve(w * 0.3, h * 0.56, w * 0.48, h * 0.5, w * 0.62, h * 0.57, 30), 1.5, 0.6)

  const pines = [
    { x: 0.12, y: 0.62, s: 1 },
    { x: 0.17, y: 0.64, s: 0.75 },
    { x: 0.22, y: 0.63, s: 0.9 },
    { x: 0.78, y: 0.66, s: 0.85 },
    { x: 0.84, y: 0.64, s: 1.05 },
    { x: 0.9, y: 0.67, s: 0.7 },
  ]
  for (const pine of pines) {
    const px = w * pine.x
    const py = h * pine.y
    const s = pine.s * Math.min(w, h) * 0.04
    ink(line(px, py, px, py - s * 2.4, 8), 1.1, 0.7)
    ink(curve(px - s * 0.9, py - s * 0.5, px, py - s * 1.1, px + s * 0.9, py - s * 0.5, 10), 1.2, 0.58)
    ink(curve(px - s * 0.7, py - s * 1.15, px, py - s * 1.7, px + s * 0.7, py - s * 1.15, 10), 1.05, 0.52)
    ink(curve(px - s * 0.45, py - s * 1.75, px, py - s * 2.25, px + s * 0.45, py - s * 1.75, 8), 0.95, 0.48)
  }

  ink(curve(w * -0.02, h * 0.72, w * 0.28, h * 0.7, w * 0.5, h * 0.74, 36), 1.8, 0.65)
  ink(curve(w * 0.42, h * 0.74, w * 0.7, h * 0.71, w * 1.02, h * 0.76, 36), 1.6, 0.55)
  ink(curve(w * 0.05, h * 0.74, w * 0.18, h * 0.76, w * 0.32, h * 0.73, 18), 1.1, 0.38)
  ink(curve(w * 0.68, h * 0.75, w * 0.82, h * 0.77, w * 0.96, h * 0.74, 16), 1, 0.35)

  for (let i = 0; i < 9; i++) {
    const y = h * (0.78 + i * 0.022)
    const offset = (i % 2) * 0.04
    ink(
      curve(
        w * (0.08 + offset),
        y,
        w * (0.45 + Math.sin(i) * 0.04),
        y + (i % 2 === 0 ? 4 : -3),
        w * (0.92 - offset),
        y,
        32,
      ),
      0.75 + (i % 3) * 0.15,
      0.16 + (i % 4) * 0.035,
      true,
    )
  }

  const bx = w * 0.48
  const by = h * 0.8
  ink(curve(bx - 28, by, bx, by + 6, bx + 28, by, 12), 1.4, 0.75)
  ink(line(bx, by - 2, bx, by - 26, 6), 1.1, 0.7)
  ink(curve(bx, by - 24, bx + 10, by - 18, bx + 14, by - 8, 8), 0.9, 0.48)

  for (let i = 0; i < 14; i++) {
    const gx = w * (0.04 + i * 0.07)
    const gy = h * (0.88 + (i % 3) * 0.02)
    const lean = ((i % 5) - 2) * 4
    ink(curve(gx, gy, gx + lean * 0.4, gy - 18, gx + lean, gy - 34, 8), 0.85, 0.42)
  }

  ink(curve(w * 0.88, h * 0.9, w * 0.92, h * 0.88, w * 0.96, h * 0.92, 10), 1.2, 0.38)

  return out
}

function rebuildStrokes(): void {
  strokes = props.theme === 'ink' ? buildInk(width, height) : buildDanxia(width, height)
}

function resize(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const parent = canvas.parentElement
  if (!parent) return

  width = parent.clientWidth
  height = parent.clientHeight
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  rebuildStrokes()
}

function step(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const radius = Math.max(90, Math.min(width, height) * 0.16)
  const radiusSq = radius * radius
  const spring = 0.08
  const damp = 0.86
  const push = 18

  for (const stroke of strokes) {
    for (const p of stroke.points) {
      if (pointerActive && !reducedMotion) {
        const dx = p.x - pointerX
        const dy = p.y - pointerY
        const distSq = dx * dx + dy * dy
        if (distSq < radiusSq && distSq > 0.01) {
          const dist = Math.sqrt(distSq)
          const falloff = 1 - dist / radius
          const force = falloff * falloff * push
          const nx = dx / dist
          const ny = dy / dist
          p.vx += nx * force * 0.35 + pointerVX * falloff * 0.45
          p.vy += ny * force * 0.35 + pointerVY * falloff * 0.45
        }
      }

      p.vx += (p.ox - p.x) * spring
      p.vy += (p.oy - p.y) * spring
      p.vx *= damp
      p.vy *= damp
      p.x += p.vx
      p.y += p.vy
    }
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  if (props.theme === 'ink') {
    const grad = ctx.createLinearGradient(0, 0, 0, height)
    grad.addColorStop(0, '#0e3842')
    grad.addColorStop(0.45, '#0b2f38')
    grad.addColorStop(1, '#08262e')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)

    const vignette = ctx.createRadialGradient(
      width * 0.5,
      height * 0.4,
      Math.min(width, height) * 0.18,
      width * 0.5,
      height * 0.52,
      Math.max(width, height) * 0.75,
    )
    vignette.addColorStop(0, 'rgba(26, 155, 142, 0.06)')
    vignette.addColorStop(0.55, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(4, 16, 20, 0.35)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, width, height)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const stroke of strokes) {
    const pts = stroke.points
    if (pts.length < 2) continue

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2
      const yc = (pts[i].y + pts[i + 1].y) / 2
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc)
    }
    const last = pts[pts.length - 1]
    const prev = pts[pts.length - 2]
    ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y)

    const alpha = stroke.soft ? stroke.alpha * 0.85 : stroke.alpha
    ctx.strokeStyle = hexToRgba(stroke.color, alpha)
    ctx.lineWidth = stroke.width
    ctx.stroke()
  }

  raf = requestAnimationFrame(step)
}

function onPointerMove(event: PointerEvent): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  if (pointerActive) {
    pointerVX = (x - prevPointerX) * 0.55
    pointerVY = (y - prevPointerY) * 0.55
  }

  prevPointerX = x
  prevPointerY = y
  pointerX = x
  pointerY = y
  pointerActive = true
}

function onPointerLeave(): void {
  pointerActive = false
  pointerVX = 0
  pointerVY = 0
  pointerX = -9999
  pointerY = -9999
}

function onResize(): void {
  resize()
}

watch(
  () => props.theme,
  () => {
    if (width > 0 && height > 0) rebuildStrokes()
  },
)

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resize()
  raf = requestAnimationFrame(step)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="ink-landscape"
    aria-hidden="true"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @pointerdown="onPointerMove"
  />
</template>

<style scoped>
.ink-landscape {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  /* Allow page scroll; pointer events still drive ink interaction */
  touch-action: pan-y;
  cursor: crosshair;
}
</style>
