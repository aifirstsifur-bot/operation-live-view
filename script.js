const refreshButton = document.querySelector("#refreshButton");
const statusText = document.querySelector("#status");
const logList = document.querySelector("#logList");
const instrumentText = document.querySelector("#instrument");
const strategyText = document.querySelector("#strategy");
const lastCloseText = document.querySelector("#lastClose");
const modeText = document.querySelector("#mode");
const updatedAtText = document.querySelector("#updatedAt");

const fallbackRows = [
  ["--", "等待自動交易 runner 發布第一筆資料"],
];

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatPrice(value) {
  if (value === null || value === undefined) return "--";
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function setRows(rows) {
  logList.replaceChildren();
  for (const [time, message] of rows) {
    const item = document.createElement("li");
    item.className = "log-item";
    item.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-message">${message}</span>
    `;
    logList.append(item);
  }
}

function renderSnapshot(snapshot) {
  const payload = snapshot.payload || {};
  const signal = payload.signal || payload.action || "unknown";
  const action = payload.action || "unknown";
  const reason = payload.reason || payload.decision?.reason || "no reason";
  const execute = payload.execute === true ? "execute=true" : "execute=false";

  statusText.textContent = `${action.toUpperCase()} / ${signal.toUpperCase()}`;
  instrumentText.textContent = payload.instId || payload.position?.inst_id || "--";
  strategyText.textContent = payload.strategy || "--";
  lastCloseText.textContent = formatPrice(payload.last_close || payload.order?.price);
  modeText.textContent = `${snapshot.mode || "--"} / ${execute}`;
  updatedAtText.textContent = `更新 ${formatDate(snapshot.published_at)}`;

  const rows = [
    [formatDate(snapshot.published_at), `決策：${action}`],
    ["signal", `訊號：${signal}`],
    ["reason", `原因：${reason}`],
  ];

  if (payload.stop_price) rows.push(["stop", `停損：${formatPrice(payload.stop_price)}`]);
  if (payload.take_profit_price) rows.push(["take", `停利：${formatPrice(payload.take_profit_price)}`]);
  if (payload.state_path) rows.push(["state", `狀態檔：${payload.state_path}`]);

  setRows(rows);
}

async function loadDashboard() {
  refreshButton.disabled = true;
  refreshButton.textContent = "讀取中";

  try {
    const response = await fetch(`./data/latest.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const snapshot = await response.json();
    renderSnapshot(snapshot);
  } catch (error) {
    statusText.textContent = "尚無資料";
    updatedAtText.textContent = "讀取失敗";
    setRows([["error", `讀取 data/latest.json 失敗：${error.message}`], ...fallbackRows]);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "刷新";
  }
}

refreshButton.addEventListener("click", loadDashboard);
loadDashboard();
window.setInterval(loadDashboard, 60_000);
