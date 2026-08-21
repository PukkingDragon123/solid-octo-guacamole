// Keyboard and mouse, translated into the low-res view's coordinate space.

import { screen } from './gfx/screen.js';

export const input = {
  keys: new Set(),
  pressedKeys: new Set(),   // this frame only
  mx: 0, my: 0,
  down: false,
  clicked: false,
  rightClicked: false,
  dragging: false,
  overCanvas: false,
  wheel: 0,
};

const BLOCKED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export function initInput(canvas) {
  window.addEventListener('keydown', (ev) => {
    if (BLOCKED.has(ev.code)) ev.preventDefault();
    if (!ev.repeat) input.pressedKeys.add(ev.code);
    input.keys.add(ev.code);
  });
  window.addEventListener('keyup', (ev) => input.keys.delete(ev.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.down = false; input.dragging = false; });

  const toView = (ev) => {
    const rect = canvas.getBoundingClientRect();
    input.mx = Math.floor((ev.clientX - rect.left) / screen.scale);
    input.my = Math.floor((ev.clientY - rect.top) / screen.scale);
    input.overCanvas = input.mx >= 0 && input.my >= 0 && input.mx < screen.w && input.my < screen.h;
  };

  canvas.addEventListener('mousemove', toView);
  canvas.addEventListener('mousedown', (ev) => {
    toView(ev);
    if (ev.button === 0) { input.down = true; input.dragging = true; input.clicked = true; }
    else if (ev.button === 2) input.rightClicked = true;
  });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 0) { input.down = false; input.dragging = false; }
  });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  canvas.addEventListener('mouseleave', () => { input.overCanvas = false; });
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    input.wheel += Math.sign(ev.deltaY) * 12;
  }, { passive: false });
}

/** Swallow a keypress so a later system this frame does not also react to it. */
export function consume(...codes) {
  for (const c of codes) input.pressedKeys.delete(c);
}

/** True once, on the frame the key went down. */
export function pressed(...codes) {
  return codes.some((c) => input.pressedKeys.has(c));
}

export function held(...codes) {
  return codes.some((c) => input.keys.has(c));
}

/** Call at the very end of each frame. */
export function endFrame() {
  input.pressedKeys.clear();
  input.clicked = false;
  input.rightClicked = false;
  input.wheel = 0;
}
