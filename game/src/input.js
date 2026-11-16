// Keyboard and mouse, read as a held state each frame plus one-shot actions the loop
// takes once. WASD or arrows move, the mouse aims, hold the left button to fire, Shift
// or Space dashes, P pauses, M mutes, Enter or Space confirms on menus.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_DASH = 8;

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseInside = false;

  function keyDown(event) {
    if (event.repeat) {
      if (MOVE_KEYS[event.code]) event.preventDefault();
      return;
    }
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      actions |= ACTION_DASH;
    }
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
  }

  function keyUp(event) {
    held.delete(event.code);
  }

  function mouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseInside = true;
  }

  function mouseDownHandler(event) {
    if (event.button === 0) {
      mouseDown = true;
      actions |= ACTION_CONFIRM;
      mouseMove(event);
    }
  }

  function mouseUpHandler(event) {
    if (event.button === 0) mouseDown = false;
  }

  function blur() {
    held.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDownHandler);
  window.addEventListener('mouseup', mouseUpHandler);

  return {
    /** Normalised move vector from the held keys, length at most 1. */
    direction() {
      let x = 0;
      let y = 0;
      held.forEach((code) => {
        const move = MOVE_KEYS[code];
        if (move) {
          x += move[0];
          y += move[1];
        }
      });
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** The aim point in canvas CSS pixels, or null when the mouse never moved. */
    aimPoint() {
      if (!mouseInside) return null;
      return { x: mouseX, y: mouseY };
    },
    get firing() {
      return mouseDown || held.has('KeyJ') || held.has('KeyZ');
    },
    get dashHeld() {
      return held.has('Space');
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
