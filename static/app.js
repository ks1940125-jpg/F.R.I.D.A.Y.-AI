const hud = document.querySelector(".hud");
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const messagesElement = document.querySelector("#messages");
const sendButton = document.querySelector("#send-button");
const micButton = document.querySelector("#mic-button");
const voiceToggle = document.querySelector("#voice-toggle");
const voiceToggleState = document.querySelector("#voice-toggle-state");
const statusText = document.querySelector("#assistant-status");
const connectionText = document.querySelector("#connection-text");
const voiceInputStatus = document.querySelector("#voice-input-status");
const voiceOutputStatus = document.querySelector("#voice-output-status");

const HISTORY_KEY = "friday-chat-history";
const MAX_HISTORY = 20;
let history = loadHistory();
let busy = false;
let recognition = null;
let awaitingWakeCommand = false;
let voiceEnabled = true;
let stateBeforeListening = "idle";

function loadHistory() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string").slice(-MAX_HISTORY)
      : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
}

function setState(state, label) {
  hud.dataset.state = state;
  statusText.textContent = label;
}

function appendMessage(role, content, options = {}) {
  const article = document.createElement("article");
  article.className = `message ${role === "user" ? "user-message" : "assistant-message"}${options.pending ? " pending" : ""}`;
  if (options.pending) article.id = "pending-message";
  const tag = document.createElement("span");
  tag.className = "message-tag";
  tag.textContent = role === "user" ? "BOSS // INPUT" : "F.R.I.D.A.Y. // RESPONSE";
  const text = document.createElement("p");
  text.textContent = content;
  article.append(tag, text);
  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
  return article;
}

function renderHistory() {
  for (const message of history) appendMessage(message.role, message.content);
}

function setBusy(value) {
  busy = value;
  sendButton.disabled = value;
  input.disabled = value;
}

function cleanWakeWord(text) {
  return text.replace(/^\s*(?:フライデー|Friday)\s*[、,。:\-]?\s*/i, "").trim();
}

function speak(text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 1.03;
  utterance.onstart = () => {
    voiceOutputStatus.textContent = "SPEAKING";
    setState("speaking", "応答を読み上げています、ボス。");
  };
  utterance.onend = () => {
    voiceOutputStatus.textContent = "READY";
    setState("idle", "オンラインです、ボス。");
  };
  utterance.onerror = () => {
    voiceOutputStatus.textContent = "READY";
    setState("idle", "応答を表示しました、ボス。");
  };
  window.speechSynthesis.speak(utterance);
}

async function submitMessage(rawText) {
  const content = rawText.trim();
  if (!content || busy) return;

  history.push({ role: "user", content });
  history = history.slice(-MAX_HISTORY);
  saveHistory();
  appendMessage("user", content);
  input.value = "";
  setBusy(true);
  setState("thinking", "内容を確認しています、ボス。");
  const pending = appendMessage("assistant", "応答を生成中…", { pending: true });

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `通信エラー (${response.status})`);
    if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("空の応答が返されました。");

    history.push({ role: "assistant", content: data.reply });
    history = history.slice(-MAX_HISTORY);
    saveHistory();
    pending.querySelector("p").textContent = data.reply;
    pending.classList.remove("pending");
    pending.removeAttribute("id");
    setState("idle", "応答しました、ボス。");
    speak(data.reply);
  } catch (error) {
    pending.remove();
    history.pop();
    saveHistory();
    appendMessage("assistant", `接続に問題が発生しました。${error.message}`);
    setState("error", "接続を確認してください、ボス。");
    connectionText.textContent = "UPLINK INTERRUPTED";
    window.setTimeout(() => {
      connectionText.textContent = "SYSTEM ONLINE";
      setState("idle", "オンラインです、ボス。");
    }, 3500);
  } finally {
    setBusy(false);
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitMessage(input.value);
});

voiceToggle.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  voiceToggle.setAttribute("aria-pressed", String(voiceEnabled));
  voiceToggleState.textContent = voiceEnabled ? "ON" : "OFF";
  if (!voiceEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    stateBeforeListening = busy ? "thinking" : "idle";
    micButton.classList.add("is-listening");
    voiceInputStatus.textContent = "LISTENING";
    setState("listening", "お聞きしています、ボス。");
  };
  recognition.onresult = (event) => {
    const spoken = event.results[event.results.length - 1][0].transcript;
    const command = cleanWakeWord(spoken);
    if (command) submitMessage(command);
    else if (/^\s*(?:フライデー|Friday)\s*[、,。:\-]?\s*$/i.test(spoken)) {
      awaitingWakeCommand = true;
      setState("listening", "はい、ボス。ご指示をどうぞ。");
    } else {
      setState(stateBeforeListening, "音声を認識できませんでした。もう一度お試しください。");
    }
  };
  recognition.onerror = (event) => {
    voiceInputStatus.textContent = event.error === "not-allowed" ? "PERMISSION DENIED" : "VOICE ERROR";
    setState("error", event.error === "not-allowed" ? "マイクの使用を許可してください、ボス。" : "音声入力を利用できません。");
  };
  recognition.onend = () => {
    if (awaitingWakeCommand && !busy) {
      awaitingWakeCommand = false;
      try {
        recognition.start();
        return;
      } catch (error) {
        if (error.name !== "InvalidStateError") {
          setState("error", "音声入力を再開できませんでした。");
        }
      }
    }
    micButton.classList.remove("is-listening");
    voiceInputStatus.textContent = "STANDBY";
    if (!busy && hud.dataset.state === "listening") setState("idle", "オンラインです、ボス。");
  };
  micButton.addEventListener("click", () => {
    if (busy) return;
    try {
      recognition.start();
    } catch (error) {
      if (error.name !== "InvalidStateError") {
        setState("error", "マイクを開始できませんでした。");
      }
    }
  });
} else {
  micButton.disabled = true;
  micButton.title = "このブラウザーは音声認識に対応していません";
  voiceInputStatus.textContent = "UNAVAILABLE";
}

if (!("speechSynthesis" in window)) {
  voiceEnabled = false;
  voiceToggle.disabled = true;
  voiceToggleState.textContent = "N/A";
  voiceOutputStatus.textContent = "UNAVAILABLE";
}

renderHistory();

function updateClock() {
  document.querySelector("#clock").textContent = new Date().toLocaleTimeString("en-GB", { hour12: false });
}
updateClock();
window.setInterval(updateClock, 1000);

window.setInterval(() => {
  const load = Math.floor(12 + Math.random() * 18);
  document.querySelector("#cpu-load").textContent = `${load}%`;
  document.querySelector("#cpu-meter").style.width = `${load}%`;
}, 4200);
