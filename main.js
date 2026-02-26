const storageKey = "timeboxingPlanner";

const byId = (id) => document.getElementById(id);

const state = {
  blocks: [],
  reviews: {},
  timer: {
    remaining: 50 * 60,
    interval: null,
  },
};

const formatTime = (seconds) => {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const sortBlocks = (blocks) =>
  [...blocks].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

const saveState = () => {
  localStorage.setItem(storageKey, JSON.stringify({
    blocks: state.blocks,
    reviews: state.reviews,
  }));
};

const loadState = () => {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.blocks = parsed.blocks || [];
    state.reviews = parsed.reviews || {};
  } catch {
    state.blocks = [];
    state.reviews = {};
  }
};

const renderBlocks = (date) => {
  const container = byId("blocks");
  container.innerHTML = "";
  const blocks = sortBlocks(state.blocks.filter((block) => block.date === date));

  if (blocks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "block-card";
    empty.textContent = "아직 추가된 블록이 없습니다. 위에서 블록을 추가해보세요.";
    container.appendChild(empty);
    return;
  }

  blocks.forEach((block) => {
    const card = document.createElement("div");
    card.className = "block-card";

    const meta = document.createElement("div");
    meta.className = "block-meta";

    const title = document.createElement("strong");
    title.textContent = `${block.start} - ${block.end} | ${block.title}`;

    const pill = document.createElement("span");
    pill.className = `tag ${block.priority}`;
    pill.textContent = block.priority.toUpperCase();

    meta.append(title, pill);

    const detail = document.createElement("div");
    detail.className = "block-notes";
    detail.textContent = `${block.notes || "설명 없음"} · 에너지: ${block.energy} · 결과: ${block.deliverable || "미정"}`;

    const actions = document.createElement("div");
    actions.className = "block-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn ghost";
    editBtn.textContent = "수정";
    editBtn.addEventListener("click", () => populateForm(block));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn ghost";
    deleteBtn.textContent = "삭제";
    deleteBtn.addEventListener("click", () => removeBlock(block.id));

    actions.append(editBtn, deleteBtn);

    card.append(meta, detail, actions);
    container.appendChild(card);
  });
};

const populateForm = (block) => {
  byId("plan-date").value = block.date;
  byId("start-time").value = block.start;
  byId("end-time").value = block.end;
  byId("task-title").value = block.title;
  byId("task-notes").value = block.notes;
  byId("priority").value = block.priority;
  byId("energy").value = block.energy;
  byId("deliverable").value = block.deliverable;
  byId("block-form").dataset.editing = block.id;
};

const removeBlock = (id) => {
  state.blocks = state.blocks.filter((block) => block.id !== id);
  saveState();
  renderBlocks(byId("plan-date").value);
};

const addOrUpdateBlock = (block) => {
  const editingId = byId("block-form").dataset.editing;
  if (editingId) {
    state.blocks = state.blocks.map((item) => (item.id === editingId ? block : item));
    delete byId("block-form").dataset.editing;
  } else {
    state.blocks.push(block);
  }
  saveState();
  renderBlocks(block.date);
};

const exportCsv = (date) => {
  const blocks = sortBlocks(state.blocks.filter((block) => block.date === date));
  if (!blocks.length) return;
  const header = ["date", "start", "end", "title", "notes", "priority", "energy", "deliverable"];
  const rows = blocks.map((block) => [
    block.date,
    block.start,
    block.end,
    block.title,
    block.notes || "",
    block.priority,
    block.energy,
    block.deliverable || "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `timeboxing-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const updateTimerDisplay = () => {
  byId("timer-display").textContent = formatTime(state.timer.remaining);
};

const startTimer = () => {
  if (state.timer.interval) return;
  state.timer.interval = setInterval(() => {
    if (state.timer.remaining <= 0) {
      clearInterval(state.timer.interval);
      state.timer.interval = null;
      return;
    }
    state.timer.remaining -= 1;
    updateTimerDisplay();
  }, 1000);
};

const pauseTimer = () => {
  if (!state.timer.interval) return;
  clearInterval(state.timer.interval);
  state.timer.interval = null;
};

const resetTimer = () => {
  pauseTimer();
  const minutes = Number(byId("timer-minutes").value) || 50;
  state.timer.remaining = minutes * 60;
  updateTimerDisplay();
};

const loadReview = (date) => {
  byId("daily-review").value = state.reviews[date] || "";
};

const saveReview = (date) => {
  state.reviews[date] = byId("daily-review").value;
  saveState();
};

const init = () => {
  loadState();

  const today = new Date().toISOString().slice(0, 10);
  byId("plan-date").value = today;
  renderBlocks(today);
  loadReview(today);

  byId("plan-date").addEventListener("change", (event) => {
    renderBlocks(event.target.value);
    loadReview(event.target.value);
  });

  byId("block-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const date = byId("plan-date").value;
    const block = {
      id: byId("block-form").dataset.editing || crypto.randomUUID(),
      date,
      start: byId("start-time").value,
      end: byId("end-time").value,
      title: byId("task-title").value.trim(),
      notes: byId("task-notes").value.trim(),
      priority: byId("priority").value,
      energy: byId("energy").value,
      deliverable: byId("deliverable").value.trim(),
    };

    if (!block.title) return;
    if (block.start >= block.end) {
      alert("종료 시간이 시작 시간보다 늦어야 합니다.");
      return;
    }

    addOrUpdateBlock(block);
    event.target.reset();
    byId("plan-date").value = date;
  });

  byId("export-csv").addEventListener("click", () => exportCsv(byId("plan-date").value));
  byId("clear-day").addEventListener("click", () => {
    const date = byId("plan-date").value;
    state.blocks = state.blocks.filter((block) => block.date !== date);
    saveState();
    renderBlocks(date);
  });

  byId("save-review").addEventListener("click", () => saveReview(byId("plan-date").value));

  byId("timer-minutes").addEventListener("change", resetTimer);
  byId("start-timer").addEventListener("click", startTimer);
  byId("pause-timer").addEventListener("click", pauseTimer);
  byId("reset-timer").addEventListener("click", resetTimer);

  resetTimer();
};

document.addEventListener("DOMContentLoaded", init);
