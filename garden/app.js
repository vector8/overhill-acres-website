(() => {
  const cfg = window.GARDEN_CONFIG || {};
  const app = document.getElementById("app");

  const STAGES = {
    seed:      { label: "Seed",       icon: "🫘", color: "#8a6a3f" },
    sprouted:  { label: "Sprouted",   icon: "🌱", color: "#9bc47e" },
    growing:   { label: "Growing",    icon: "🌿", color: "#6aa15a" },
    flowering: { label: "Flowering",  icon: "🌸", color: "#e98a9c" },
    fruiting:  { label: "Fruiting",   icon: "🍅", color: "#d96a4a" },
  };

  // Distinct colors for stacked allocation bar segments, cycled per plant.
  const PLANT_PALETTE = [
    "#6aa15a", "#e98a9c", "#d96a4a", "#f4c95d", "#7fb3a4",
    "#b07ab8", "#cfa15a", "#5d8aa8", "#a4c46f", "#d98c5f",
  ];

  // ---------- rendering ----------

  function render(beds, plantsByBed) {
    const grid = document.createElement("div");
    grid.className = "bed-grid";

    const hasPlacement = beds.some(b => b.row != null || b.col != null);
    if (hasPlacement) {
      const endOf = (start, span) => {
        if (start == null) return 0;
        if (span === "all" || span == null) return start;
        return start + span - 1;
      };
      const maxCol = Math.max(1, ...beds.map(b => endOf(b.col, b.colSpan)));
      const maxRow = Math.max(1, ...beds.map(b => endOf(b.row, b.rowSpan)));
      grid.classList.add("is-placed");
      grid.style.setProperty("--grid-cols", maxCol);
      grid.style.setProperty("--grid-rows", maxRow);
    }

    const tpl = document.getElementById("bed-card-template");

    for (const bed of beds) {
      const node = tpl.content.firstElementChild.cloneNode(true);

      if (bed.isGreenhouse) {
        node.classList.add("is-greenhouse");
        node.querySelector(".bed-badge").textContent = "Greenhouse";
      }

      if (hasPlacement) {
        node.style.gridColumn = buildGridTrack(bed.col, bed.colSpan);
        node.style.gridRow = buildGridTrack(bed.row, bed.rowSpan);
      }

      node.querySelector(".bed-name").textContent = bed.name || bed.id;

      renderPhotos(node.querySelector(".bed-photos"), bed.photos);

      const plants = plantsByBed.get(bed.id) || [];
      plants.forEach((p, i) => { p.color = PLANT_PALETTE[i % PLANT_PALETTE.length]; });

      if (bed.isGreenhouse) {
        node.querySelector(".bed-allocation").remove();
      } else {
        renderAllocation(node.querySelector(".bed-allocation"), plants);
      }
      renderPlantList(node.querySelector(".plant-list"), plants, { showPercent: !bed.isGreenhouse });

      node.querySelector(".bed-notes").textContent = bed.notes || "";
      node.querySelector(".bed-updated").textContent =
        bed.updated ? `Updated ${formatDate(bed.updated)}` : "";

      grid.appendChild(node);
    }

    app.replaceChildren(grid);
  }

  function renderPhotos(container, photos) {
    container.innerHTML = "";
    if (!photos || photos.length === 0) return;

    photos.forEach((url, i) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.loading = "lazy";
      if (i === 0) img.classList.add("is-active");
      img.addEventListener("error", () => { img.style.display = "none"; });
      container.appendChild(img);
    });

    if (photos.length > 1) {
      const dots = document.createElement("div");
      dots.className = "photo-dots";
      photos.forEach((_, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", `Photo ${i + 1}`);
        if (i === 0) b.classList.add("is-active");
        b.addEventListener("click", () => setActivePhoto(container, i));
        dots.appendChild(b);
      });
      container.appendChild(dots);

      let current = 0;
      setInterval(() => {
        current = (current + 1) % photos.length;
        setActivePhoto(container, current);
      }, 5000);
    }
  }

  function setActivePhoto(container, index) {
    container.querySelectorAll("img").forEach((img, i) =>
      img.classList.toggle("is-active", i === index));
    container.querySelectorAll(".photo-dots button").forEach((b, i) =>
      b.classList.toggle("is-active", i === index));
  }

  function renderAllocation(container, plants) {
    const bar = container.querySelector(".allocation-bar");
    const emptyLabel = container.querySelector(".allocation-empty-label");
    bar.innerHTML = "";

    const total = plants.reduce((sum, p) => sum + p.percent, 0);
    const capped = Math.min(total, 100);

    for (const p of plants) {
      if (p.percent <= 0) continue;
      const seg = document.createElement("div");
      seg.className = "allocation-segment";
      const widthPct = total > 100 ? (p.percent / total) * 100 : p.percent;
      seg.style.width = widthPct + "%";
      seg.style.background = p.color;
      seg.title = `${p.name} — ${p.percent}%`;
      bar.appendChild(seg);
    }

    const empty = Math.max(0, 100 - capped);
    if (empty >= 1 && plants.length > 0) {
      emptyLabel.textContent = `${Math.round(empty)}% open soil`;
    } else if (plants.length === 0) {
      emptyLabel.textContent = "Empty bed — ready for planting 🌾";
    } else {
      emptyLabel.textContent = "";
    }
  }

  function renderPlantList(list, plants, opts = {}) {
    const showPercent = opts.showPercent !== false;
    list.innerHTML = "";
    for (const p of plants) {
      const li = document.createElement("li");
      li.className = "plant-row";
      li.style.setProperty("--plant-color", p.color);

      const stage = STAGES[p.stageKey] || { label: p.stage || "—", icon: "🌱" };

      li.innerHTML = `
        <span class="plant-stage-icon" aria-hidden="true">${stage.icon}</span>
        <div class="plant-meta">
          <span class="plant-name"></span>
          <span class="plant-stage">${escapeHtml(stage.label)}</span>
          <span class="plant-notes"></span>
        </div>
        ${showPercent ? `<span class="plant-percent">${p.percent}%</span>` : ""}
      `;
      li.querySelector(".plant-name").textContent = p.name;
      const notesEl = li.querySelector(".plant-notes");
      if (p.notes) notesEl.textContent = p.notes; else notesEl.remove();

      list.appendChild(li);
    }
  }

  // ---------- data loading ----------

  async function load() {
    if (!cfg.SHEET_ID) {
      renderSetup();
      return;
    }

    try {
      const [beds, plants] = await Promise.all([
        fetchSheet(cfg.BEDS_SHEET || "Beds"),
        fetchSheet(cfg.PLANTS_SHEET || "Plants"),
      ]);

      const parsedBeds = beds.map(parseBedRow).filter(b => b.id);
      parsedBeds.forEach((b, i) => { b._row = i; });
      parsedBeds.sort((a, b) => {
        const ao = a.order, bo = b.order;
        if (ao != null && bo != null) return ao - bo;
        if (ao != null) return -1;
        if (bo != null) return 1;
        return a._row - b._row;
      });
      const parsedPlants = plants.map(parsePlantRow).filter(p => p.bedId && p.name);

      const plantsByBed = new Map();
      for (const p of parsedPlants) {
        if (!plantsByBed.has(p.bedId)) plantsByBed.set(p.bedId, []);
        plantsByBed.get(p.bedId).push(p);
      }
      for (const arr of plantsByBed.values()) {
        arr.sort((a, b) => b.percent - a.percent);
      }

      render(parsedBeds, plantsByBed);
      document.getElementById("last-fetched").textContent =
        `Last refreshed ${formatDate(new Date(), true)}`;
    } catch (err) {
      console.error(err);
      renderError(err);
    }
  }

  async function fetchSheet(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(cfg.SHEET_ID)}` +
                `/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load sheet "${sheetName}" (HTTP ${res.status}). Is the sheet shared "Anyone with the link"?`);
    const text = await res.text();
    // gviz wraps JSON in /*O_o*/\ngoogle.visualization.Query.setResponse(...);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error(`Unexpected response for sheet "${sheetName}".`);
    const data = JSON.parse(text.slice(start, end + 1));
    if (data.status === "error") {
      const msg = (data.errors && data.errors[0] && data.errors[0].detailed_message) || "Sheet error.";
      throw new Error(`Sheet "${sheetName}": ${stripHtml(msg)}`);
    }
    return gvizToRows(data.table);
  }

  function gvizToRows(table) {
    const headers = table.cols.map(c => normalizeKey(c.label || c.id));
    return table.rows.map(r => {
      const obj = {};
      r.c.forEach((cell, i) => {
        const key = headers[i];
        if (!key) return;
        obj[key] = cell == null ? "" : (cell.f != null ? cell.f : cell.v);
      });
      return obj;
    });
  }

  function parseBedRow(row) {
    const orderRaw = row.order;
    const orderNum = Number(orderRaw);
    return {
      id: String(row.id || "").trim(),
      name: String(row.name || "").trim(),
      isGreenhouse: parseBool(row.is_greenhouse),
      photos: parsePhotos(row.photos),
      notes: String(row.notes || "").trim(),
      updated: row.updated || "",
      order: orderRaw !== "" && orderRaw != null && Number.isFinite(orderNum) ? orderNum : null,
      row: parsePositiveInt(row.row),
      col: parsePositiveInt(row.col),
      rowSpan: parseSpan(row.row_span),
      colSpan: parseSpan(row.col_span),
    };
  }

  function parsePositiveInt(v) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  }

  // Returns a positive integer, the literal "all", or null.
  function parseSpan(v) {
    if (v == null) return null;
    const s = String(v).trim().toLowerCase();
    if (s === "") return null;
    if (s === "all" || s === "full" || s === "*") return "all";
    const n = Number(s);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  }

  // Build a grid-column/grid-row value from a start and span.
  // start may be null (auto-place); span may be null (1 cell),
  // a positive integer, or "all" (stretch to grid edge).
  function buildGridTrack(start, span) {
    if (start == null && span == null) return "";
    if (span === "all") return `${start || 1} / -1`;
    if (span != null && start != null) return `${start} / span ${span}`;
    if (span != null) return `span ${span}`;
    return String(start);
  }

  function parsePlantRow(row) {
    const stageRaw = String(row.stage || "").trim();
    return {
      bedId: String(row.bed_id || "").trim(),
      name: String(row.name || "").trim(),
      percent: clampPercent(row.percent),
      stage: stageRaw,
      stageKey: stageRaw.toLowerCase(),
      notes: String(row.notes || "").trim(),
      updated: row.updated || "",
    };
  }

  function parsePhotos(raw) {
    if (!raw) return [];
    return String(raw)
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(toDrivePreviewUrl);
  }

  // Convert various Google Drive share URLs to a thumbnail URL that
  // can be embedded without auth (file must be shared "Anyone with the link").
  function toDrivePreviewUrl(url) {
    const m =
      url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`;
    return url;
  }

  function parseBool(v) {
    if (v === true) return true;
    const s = String(v || "").trim().toLowerCase();
    return s === "true" || s === "yes" || s === "y" || s === "1";
  }

  function clampPercent(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function normalizeKey(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, "_");
  }

  function formatDate(value, includeTime) {
    let d;
    if (value instanceof Date) {
      d = value;
    } else if (typeof value === "string" && /^Date\(/.test(value)) {
      // gviz date format: Date(2026,4,15)  — months are 0-indexed
      const parts = value.match(/Date\(([^)]+)\)/)[1].split(",").map(Number);
      d = new Date(parts[0], parts[1] || 0, parts[2] || 1, parts[3] || 0, parts[4] || 0);
    } else if (typeof value === "string") {
      d = new Date(value);
    } else {
      return "";
    }
    if (isNaN(d.getTime())) return "";
    const opts = includeTime
      ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", year: "numeric" };
    return d.toLocaleDateString(undefined, opts);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function stripHtml(s) {
    const tmp = document.createElement("div");
    tmp.innerHTML = s;
    return tmp.textContent || tmp.innerText || "";
  }

  // ---------- placeholder states ----------

  function renderSetup() {
    app.innerHTML = `
      <div class="setup">
        <h2>🌻 Almost ready!</h2>
        <p>Open <code>config.js</code> and paste your Google Sheet ID into <code>SHEET_ID</code>.</p>
        <ol>
          <li>Create a Google Sheet with two tabs: <code>Beds</code> and <code>Plants</code>.</li>
          <li>In the sheet: <strong>Share → Anyone with the link → Viewer</strong>, then <strong>File → Share → Publish to web</strong>.</li>
          <li>Copy the sheet ID from the URL (between <code>/d/</code> and <code>/edit</code>) into <code>config.js</code>.</li>
          <li>See <code>config.js</code> for the exact column names expected in each tab.</li>
        </ol>
      </div>
    `;
  }

  function renderError(err) {
    app.innerHTML = `
      <div class="error">
        <h2>🥀 Couldn't reach the garden</h2>
        <p>${escapeHtml(err.message || String(err))}</p>
        <p>Double-check that the sheet is shared "Anyone with the link" and that the tab names in <code>config.js</code> match.</p>
      </div>
    `;
  }

  // ---------- tagline ----------

  const TAGLINES = [
    "Hey bud. How's it growing?",
    "The growing is good.",
    "I just wet my plants.",
    "Lettuce turnip the beet.",
    "Don't kale my vibe.",
    "Peas be with you.",
    "Thyme flies when you're having fun.",
    "Rooting for you.",
    "So far, soil good.",
    "Bean there, grown that.",
    "We've sprung a leek!",
    "Romaine calm and carrot on.",
    "Hoe, hoe, hoe.",
    "Mulch ado about nothing.",
    "Sage advice: water your plants.",
    "Compost makes the garden grow fronder.",
    "Some grow it hot.",
    "Weeds out, vibes in.",
    "Daisy me rollin', they hatin'",
    "A peony for your thoughts?",
    "What in carnation?",
    "Old gardeners never die, they simply spade away.",
    "Go ahead, make my hay.",
    "Cuke, I am your father.",
    "To peat, or not to peat.",
    "I think, therefore I yam.",
    "You shallot pass!",
    "Totally radicchio, dude.",
    "You say tomato, I say... tomato."
  ];

  function randomizeTagline() {
    const el = document.querySelector(".tagline");
    if (!el) return;
    el.textContent = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
  }

  // ---------- boot ----------

  randomizeTagline();
  load();
  if (cfg.SHEET_ID && cfg.REFRESH_MINUTES > 0) {
    setInterval(load, cfg.REFRESH_MINUTES * 60 * 1000);
  }
})();
