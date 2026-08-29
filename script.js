const DURATIONS = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 90;

const state = {
  mode: "focus",
  secondsLeft: DURATIONS.focus,
  running: false,
  timerId: null,
  activeTaskId: null,
};

const timeDisplay = document.getElementById("timeDisplay");
const ring = document.getElementById("ring");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const modeButtons = document.querySelectorAll(".mode-btn");
const countDisplay = document.getElementById("count");
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");

ring.style.strokeDasharray = RING_CIRCUMFERENCE;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadCount() {
  const stored = JSON.parse(localStorage.getItem("pomodoroCount") || "{}");
  return stored.date === todayKey() ? stored.count : 0;
}

function saveCount(count) {
  localStorage.setItem("pomodoroCount", JSON.stringify({ date: todayKey(), count }));
}

function loadTasks() {
  return JSON.parse(localStorage.getItem("pomodoroTasks") || "[]");
}

function saveTasks(tasks) {
  localStorage.setItem("pomodoroTasks", JSON.stringify(tasks));
}

let tasks = loadTasks();
let pomodoroCount = loadCount();
countDisplay.textContent = pomodoroCount;

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateRing() {
  const total = DURATIONS[state.mode];
  const fraction = state.secondsLeft / total;
  ring.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - fraction);
}

function render() {
  timeDisplay.textContent = formatTime(state.secondsLeft);
  updateRing();
}

function setMode(mode, resetTime = true) {
  state.mode = mode;
  document.body.classList.remove("mode-focus", "mode-short", "mode-long");
  document.body.classList.add(`mode-${mode}`);
  modeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
  if (resetTime) {
    state.secondsLeft = DURATIONS[mode];
  }
  render();
}

function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [0, 0.18, 0.36].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = i === 2 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  } catch (e) {
    /* audio not available */
  }
}

function tick() {
  state.secondsLeft -= 1;
  render();
  if (state.secondsLeft <= 0) {
    completeSession();
  }
}

function completeSession() {
  stopTimer();
  playDing();
  document.querySelector(".timer-ring").classList.add("pulse");
  setTimeout(() => document.querySelector(".timer-ring").classList.remove("pulse"), 600);

  if (state.mode === "focus") {
    pomodoroCount += 1;
    countDisplay.textContent = pomodoroCount;
    saveCount(pomodoroCount);

    if (state.activeTaskId) {
      const task = tasks.find((t) => t.id === state.activeTaskId);
      if (task) {
        task.pomodoros += 1;
        saveTasks(tasks);
        renderTasks();
      }
    }
    const nextMode = pomodoroCount % 4 === 0 ? "long" : "short";
    setMode(nextMode);
  } else {
    setMode("focus");
  }
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  startBtn.textContent = "Pausar";
  startBtn.classList.add("running");
  state.timerId = setInterval(tick, 1000);
}

function stopTimer() {
  state.running = false;
  startBtn.textContent = "Iniciar";
  startBtn.classList.remove("running");
  clearInterval(state.timerId);
  state.timerId = null;
}

function toggleTimer() {
  if (state.running) {
    stopTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  stopTimer();
  state.secondsLeft = DURATIONS[state.mode];
  render();
}

startBtn.addEventListener("click", toggleTimer);
resetBtn.addEventListener("click", resetTimer);

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    stopTimer();
    setMode(btn.dataset.mode);
  });
});

function renderTasks() {
  taskList.innerHTML = "";
  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = task.done ? "done" : "";
    if (task.id === state.activeTaskId) li.style.outline = "1px solid var(--accent)";

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = task.text;
    text.title = "Clic para marcar como tarea activa";
    text.style.cursor = "pointer";
    text.addEventListener("click", () => {
      state.activeTaskId = task.id;
      renderTasks();
    });

    const pomoCount = document.createElement("span");
    pomoCount.className = "pomo-count";
    pomoCount.textContent = task.pomodoros > 0 ? `🍅${task.pomodoros}` : "";

    const doneBtn = document.createElement("button");
    doneBtn.className = "remove";
    doneBtn.textContent = task.done ? "↺" : "✓";
    doneBtn.title = task.done ? "Marcar como pendiente" : "Marcar como hecha";
    doneBtn.addEventListener("click", () => {
      task.done = !task.done;
      saveTasks(tasks);
      renderTasks();
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove";
    removeBtn.textContent = "✕";
    removeBtn.title = "Eliminar tarea";
    removeBtn.addEventListener("click", () => {
      tasks = tasks.filter((t) => t.id !== task.id);
      if (state.activeTaskId === task.id) state.activeTaskId = null;
      saveTasks(tasks);
      renderTasks();
    });

    li.append(text, pomoCount, doneBtn, removeBtn);
    taskList.appendChild(li);
  });
}

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  tasks.push({ id: Date.now(), text, done: false, pomodoros: 0 });
  saveTasks(tasks);
  taskInput.value = "";
  renderTasks();
});

setMode("focus");
renderTasks();
