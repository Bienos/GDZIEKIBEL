import { buildMarkerLabel } from './marker-label';
import type { NearbyToiletResult } from './nearby-response';

/**
 * Builds the DOM element for one toilet marker.
 *
 * Only the "uncertain" visual variant from `DESIGN.md` section 8 exists:
 * the nearby API always returns `openingStatus: "UNKNOWN"` and only active
 * toilets, so the "recommended" and "known closed" variants have no data
 * that could ever select them yet. A plain "WC" badge is legible at small
 * size without needing a custom pictogram asset.
 *
 * Not a React component: MapLibre's `Marker` takes a plain DOM element, and
 * markers are created and removed imperatively by the reconciliation effect
 * in `MapShell`, not rendered by React.
 */
export function createToiletMarkerElement(
  toilet: NearbyToiletResult,
  markerClassName: string,
  selectedClassName: string,
  onSelect: () => void,
): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = markerClassName;
  element.setAttribute('aria-label', buildMarkerLabel(toilet));
  element.textContent = 'WC';
  element.addEventListener('click', onSelect);

  setMarkerSelected(element, false, selectedClassName);
  return element;
}

export function setMarkerSelected(
  element: HTMLElement,
  selected: boolean,
  selectedClassName: string,
): void {
  element.classList.toggle(selectedClassName, selected);
  element.setAttribute('aria-pressed', String(selected));
}
