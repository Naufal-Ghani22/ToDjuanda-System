const scene = document.querySelector("#map-scene");
const canvas = document.querySelector(".map-canvas");
const card = document.querySelector("#space-card");
const search = document.querySelector("#space-search");
const detailTemplate = document.querySelector("#space-detail-template");

const state = {
  zoom: 1.8,
  yaw: -2,
  pitch: 36,
  panX: 0,
  panY: 0,
  selected: null,
};

let spaces = [];
let isDragging = false;
let dragStart = null;

function renderView() {
  scene.style.transform = [
    `translate(calc(-50% + ${state.panX}px), calc(-50% + ${state.panY}px))`,
    `scale(${state.zoom})`,
    `rotateZ(${state.yaw}deg)`,
    `rotateX(${state.pitch}deg)`,
  ].join(" ");
}

function normalise(value) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, "-");
}

function updateCard(space) {
  if (!space) {
    card.innerHTML = `
      <p class="eyebrow">Peta siap dieksplorasi</p>
      <h2>Pilih sebuah zona</h2>
      <p>Klik area berwarna pada peta atau cari referensi zona. Data tenant dan rute belum ditampilkan pada prototipe visual ini.</p>`;
    return;
  }

  const fragment = detailTemplate.content.cloneNode(true);
  fragment.querySelector("h2").textContent = space.dataset.label;
  fragment.querySelector(".space-card__copy").textContent =
    "Area ini berasal langsung dari denah SVG. Hubungkan zona ini ke Space ID, data POI, tenant, dan routing anchor pada tahap berikutnya.";
  fragment.querySelector(".focus-button").addEventListener("click", () => focusSpace(space));
  card.replaceChildren(fragment);
}

function selectSpace(space) {
  if (state.selected) state.selected.classList.remove("is-selected");
  state.selected = space;
  space.classList.add("is-selected");
  updateCard(space);
}

function focusSpace(space) {
  selectSpace(space);
  const box = space.getBoundingClientRect();
  const targetX = window.innerWidth / 2;
  const targetY = window.innerHeight * 0.43;
  state.panX += targetX - (box.left + box.width / 2);
  state.panY += targetY - (box.top + box.height / 2);
  state.zoom = Math.min(2.2, Math.max(state.zoom, 1.45));
  renderView();
}

function findSpace(query) {
  const term = normalise(query);
  if (!term) return null;
  return spaces.find((space) => normalise(space.dataset.label).includes(term)) ?? null;
}

function setSearchResult() {
  const found = findSpace(search.value);
  spaces.forEach((space) => space.classList.toggle("is-dimmed", Boolean(search.value) && space !== found));
  if (found && search.value.length > 2) focusSpace(found);
}

async function loadMap() {
  try {
    const response = await fetch("./assets/T1-GF-Area.svg");
    if (!response.ok) throw new Error("SVG tidak dapat dimuat.");
    const source = await response.text();
    const svg = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("aria-label", "Denah interaktif Terminal 1 lantai dasar");
    svg.setAttribute("role", "img");

    const depth = svg.cloneNode(true);
    depth.classList.add("map-depth");
    depth.setAttribute("aria-hidden", "true");

    const face = svg.cloneNode(true);
    face.classList.add("map-face");

    face.querySelectorAll("[id]").forEach((element) => {
      const id = element.id;
      // Keep original Figma IDs when available. The current source SVG has
      // been flattened, so filled zones receive temporary visual references.
      if (/^T1-GF-[A-Za-z0-9_-]+$/i.test(id)) {
        element.dataset.space = "true";
        element.dataset.label = id;
        element.setAttribute("tabindex", "0");
        element.setAttribute("role", "button");
        element.setAttribute("aria-label", `Pilih ${id}`);
        spaces.push(element);
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          selectSpace(element);
        });
        element.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectSpace(element);
          }
        });
      }
    });

    if (spaces.length === 0) {
      face.querySelectorAll("path[fill], rect[fill], polygon[fill]").forEach((element, index) => {
        const label = `Zona SVG ${String(index + 1).padStart(3, "0")}`;
        element.dataset.space = "true";
        element.dataset.label = label;
        element.setAttribute("tabindex", "0");
        element.setAttribute("role", "button");
        element.setAttribute("aria-label", `Pilih ${label}`);
        spaces.push(element);
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          selectSpace(element);
        });
        element.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectSpace(element);
          }
        });
      });
    }

    scene.replaceChildren(depth, face);
    renderView();
  } catch (error) {
    scene.innerHTML = `<p class="map-loading">Denah tidak dapat dimuat. Jalankan website melalui server lokal.</p>`;
    console.error(error);
  }
}

document.querySelector("#zoom-in").addEventListener("click", () => {
  state.zoom = Math.min(3, state.zoom + 0.18);
  renderView();
});

document.querySelector("#zoom-out").addEventListener("click", () => {
  state.zoom = Math.max(0.65, state.zoom - 0.18);
  renderView();
});

document.querySelector("#turn-left").addEventListener("click", () => {
  state.yaw -= 15;
  renderView();
});

document.querySelector("#turn-right").addEventListener("click", () => {
  state.yaw += 15;
  renderView();
});

document.querySelector("#reset-view").addEventListener("click", () => {
  Object.assign(state, { zoom: 1.8, yaw: -2, pitch: 36, panX: 0, panY: 0 });
  renderView();
});

search.addEventListener("input", setSearchResult);
search.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const found = findSpace(search.value);
    if (found) focusSpace(found);
  }
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button, input, [data-space]")) return;
  isDragging = true;
  dragStart = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!isDragging || !dragStart) return;
  state.panX = dragStart.panX + event.clientX - dragStart.x;
  state.panY = dragStart.panY + event.clientY - dragStart.y;
  renderView();
});

canvas.addEventListener("pointerup", () => {
  isDragging = false;
  dragStart = null;
});

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  state.zoom = Math.min(3, Math.max(0.65, state.zoom - event.deltaY * 0.001));
  renderView();
}, { passive: false });

loadMap();
