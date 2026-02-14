import type { WheelEvent } from 'react';

/**
 * Wheel event handler that blocks regular scroll from reaching React Flow
 * (so the node content scrolls normally) but allows pinch-to-zoom through
 * (so the canvas still zooms).
 *
 * Browsers report trackpad pinch as wheel events with ctrlKey === true.
 */
export function handleWheelPassthroughPinch(e: WheelEvent) {
  if (!e.ctrlKey) {
    e.stopPropagation();
  }
}
