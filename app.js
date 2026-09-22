/**
 * STASIS Episode 0 — PWA UI shell
 */
import { createGame } from "./engine.js";

const SAVE_KEY = "stasis-ep0-save";

const logEl = document.getElementById("log");
const statusEl = document.getElementById("status");
const formEl = document.getElementById("cmd-form");
const inputEl = document.getElementById("cmd");
const newBtn = document.getElementById("btn-new");

let content = null;
let game = null;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persist() {
  if (!game) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(game.save.toJSON()));
}

function wipeSave() {
  localStorage.removeItem(SAVE_KEY);
}

function updateStatus() {
  statusEl.textContent = game.statusLine();
}

function appendLines(lines) {
  for (const line of lines) {
    const div = document.createElement("div");
    div.className = `line line-${line.kind}`;
    if (line.kind === "say" && line.speaker) {
      const sp = document.createElement("div");
      sp.className = "speaker";
      sp.textContent = line.speaker;
      div.appendChild(sp);
    }
    if (line.kind === "rule") {
      div.textContent = `— ${line.text} —`;
    } else {
      const body = document.createElement("div");
      body.className = "body";
      body.textContent = line.text;
      div.appendChild(body);
    }
    logEl.appendChild(div);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

function focusInput() {
  // delay so iOS keyboard / layout settle
  requestAnimationFrame(() => {
    inputEl.focus({ preventScroll: true });
  });
}

function boot(fresh = false) {
  logEl.innerHTML = "";
  if (fresh) wipeSave();
  const saved = fresh ? null : loadSave();
  game = createGame(content, saved);
  const lines = game.openingText();
  appendLines(lines);
  updateStatus();
  if (saved) persist(); // touch
  focusInput();
}

function runCommand(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return;

  const echo = document.createElement("div");
  echo.className = "line line-cmd";
  echo.textContent = `› ${trimmed}`;
  logEl.appendChild(echo);

  // new / --new handled in engine; also wipe storage
  const low = trimmed.toLowerCase();
  if (low === "new" || low === "--new") {
    wipeSave();
  }

  const lines = game.handle(trimmed);

  if (low === "save" || low === "quit" || low === "q" || game.quitRequested) {
    persist();
  } else if (low !== "new" && low !== "--new") {
    persist();
  } else {
    persist();
  }

  appendLines(lines);
  updateStatus();
  inputEl.value = "";
  focusInput();
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  runCommand(inputEl.value);
});

newBtn.addEventListener("click", () => {
  if (confirm("Wipe save and restart Episode 0?")) {
    boot(true);
    persist();
  }
});

async function main() {
  const res = await fetch("./content.json");
  content = await res.json();
  boot(false);

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (err) {
      console.warn("SW register failed", err);
    }
  }
}

main();
