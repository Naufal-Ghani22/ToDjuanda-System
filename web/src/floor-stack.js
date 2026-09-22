export function createFloorStack(floors) {
  const byId = new Map(floors.map((floor) => [floor.id, floor]));
  let selectedFloor = 'GF';
  let mode = 'map';

  function applyLod(level) {
    for (const floor of floors) {
      for (const [name, group] of Object.entries(floor.lodGroups)) group.visible = name === level;
    }
  }

  function updateVisibility() {
    for (const floor of floors) floor.group.visible = mode === 'explore' || floor.id === selectedFloor;
  }

  return {
    applyLod,
    showOnly(floorId) {
      if (!byId.has(floorId)) return;
      selectedFloor = floorId;
      mode = 'map';
      updateVisibility();
    },
    showAll() {
      mode = 'explore';
      updateVisibility();
    },
    get selectedFloor() {
      return selectedFloor;
    },
    get mode() {
      return mode;
    },
  };
}
