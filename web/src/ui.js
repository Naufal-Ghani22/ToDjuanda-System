const FLOOR_LABELS = { GF: 'Ground Floor', FF: 'First Floor' };

export function formatContinuation(segment) {
  return `Lanjut ke ${FLOOR_LABELS[segment.nextFloor]} via ${segment.connectorId} →`;
}

export function createUi(root) {
  const floorButtons = [...root.querySelectorAll('[data-floor]')];
  const modeButtons = [...root.querySelectorAll('[data-mode]')];
  const continuation = root.querySelector('#continue-floor');
  const status = root.querySelector('#map-status');
  const routeStatus = root.querySelector('#route-status');
  const reset = root.querySelector('#reset-view');
  const clear = root.querySelector('#clear-route');

  function setActive(collection, activeValue, attribute) {
    for (const button of collection) {
      const active = button.dataset[attribute] === activeValue;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  return {
    bind({ onFloor, onMode, onReset, onClear, onContinue }) {
      for (const button of floorButtons) button.addEventListener('click', () => onFloor(button.dataset.floor));
      for (const button of modeButtons) button.addEventListener('click', () => onMode(button.dataset.mode));
      reset.addEventListener('click', onReset);
      clear.addEventListener('click', onClear);
      continuation.addEventListener('click', onContinue);
    },
    setFloor(floorId) {
      setActive(floorButtons, floorId, 'floor');
    },
    setMode(mode) {
      setActive(modeButtons, mode, 'mode');
    },
    setStatus(message) {
      status.textContent = message;
    },
    setRouteStatus(message) {
      routeStatus.textContent = message;
    },
    setContinuation(segment, mode) {
      const visible = Boolean(segment?.connectorId) && mode === 'map';
      continuation.hidden = !visible;
      if (visible) continuation.textContent = formatContinuation(segment);
    },
  };
}
