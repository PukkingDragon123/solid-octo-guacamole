// The display: one small canvas scaled up by a whole number, plus the camera.

import { VIEW_W, VIEW_H } from '../config.js';

export const screen = {
  canvas: null,
  ctx: null,
  scale: 3,
  w: VIEW_W,
  h: VIEW_H,
};

export function initScreen(canvas) {
  screen.canvas = canvas;
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  screen.ctx = canvas.getContext('2d', { alpha: false });
  screen.ctx.imageSmoothingEnabled = false;
  resize();
  window.addEventListener('resize', resize);
  return screen.ctx;
}

export function resize() {
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const pad = touch ? 0 : 8;
  // A host page can reserve room for its own chrome around the game - the
  // single-file build embeds the canvas under a title bar and a key legend.
  const fit = window.__DAMIT_FIT || {};
  const padY = fit.padY || 0;
  const padX = fit.padX || 0;
  const exact = Math.min((window.innerWidth - pad - padX) / VIEW_W,
                         (window.innerHeight - pad - padY) / VIEW_H);
  // Whole-number scaling keeps pixels square, but a phone screen is rarely a
  // whole multiple of 480x270 — there, filling the glass matters more.
  const scale = exact >= 2 ? Math.floor(exact) : Math.max(0.5, exact);
  screen.scale = scale;
  if (screen.canvas) {
    screen.canvas.style.width = `${VIEW_W * scale}px`;
    screen.canvas.style.height = `${VIEW_H * scale}px`;
  }
}

/** Camera in world pixels; `x,y` is the top-left corner of what you can see. */
export const cam = {
  x: 0, y: 0,
  shake: 0,
  ox: 0, oy: 0,

  centreOn(wx, wy, bounds) {
    this.x = wx - VIEW_W / 2;
    this.y = wy - VIEW_H / 2;
    this.clamp(bounds);
  },

  follow(wx, wy, dt, bounds, ease = 6) {
    const tx = wx - VIEW_W / 2;
    const ty = wy - VIEW_H / 2;
    const k = 1 - Math.exp(-ease * dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.clamp(bounds);
  },

  clamp(bounds) {
    if (!bounds) return;
    const maxX = Math.max(0, bounds.w - VIEW_W);
    const maxY = Math.max(0, bounds.h - VIEW_H);
    this.x = Math.min(Math.max(0, this.x), maxX);
    this.y = Math.min(Math.max(0, this.y), maxY);
  },

  update(dt) {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      this.ox = Math.round((Math.random() - 0.5) * this.shake * 6);
      this.oy = Math.round((Math.random() - 0.5) * this.shake * 6);
    } else { this.ox = 0; this.oy = 0; }
  },

  kick(amount = 1) { this.shake = Math.min(2, this.shake + amount); },

  // world -> screen, always landing on whole pixels
  sx(wx) { return Math.round(wx - this.x) + this.ox; },
  sy(wy) { return Math.round(wy - this.y) + this.oy; },
};
