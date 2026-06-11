const refreshButton = document.querySelector("#refreshButton");
const signalPanel = document.querySelector("#signalPanel");
const signalValue = document.querySelector("#signalValue");
const actionValue = document.querySelector("#actionValue");
const reasonText = document.querySelector("#reasonText");
const logList = document.querySelector("#logList");
const flowList = document.querySelector("#flowList");
const instrumentText = document.querySelector("#instrument");
const strategyText = document.querySelector("#strategy");
const lastCloseText = document.querySelector("#lastClose");
const modeText = document.querySelector("#mode");
const updatedAtText = document.querySelector("#updatedAt");
const sourceText = document.querySelector("#sourceText");

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

function setFlow(payload, snapshot, reason, signal) {
  const flow = [
    ["取得市場資料", `${payload.instId || "--"} 1H candle`, "done"],
    ["套用策略", payload.strategy || "--", "done"],
    ["安全閘", `${snapshot.mode || "--"} mode, ${payload.execute ? "execute=true" : "execute=false"}`, "safe"],
    ["決策", `${signal}: ${reason}`, signal === "hold" ? "idle" : signal],
  ];

  flowList.replaceChildren();
  for (const [title, detail, state] of flow) {
    const item = document.createElement("li");
    item.className = `flow-step ${state}`;
    item.innerHTML = `
      <span class="flow-dot"></span>
      <div>
        <strong>${title}</strong>
        <p>${detail}</p>
      </div>
    `;
    flowList.append(item);
  }
}

function renderSnapshot(snapshot) {
  const payload = snapshot.payload || {};
  const signal = (payload.signal || payload.action || "unknown").toLowerCase();
  const action = (payload.action || "unknown").toLowerCase();
  const reason = payload.reason || payload.decision?.reason || "no reason";
  const execute = payload.execute === true ? "execute=true" : "execute=false";

  signalPanel.className = `panel signal-panel signal-${signal}`;
  signalValue.textContent = signal.toUpperCase();
  actionValue.textContent = `action: ${action}`;
  reasonText.textContent = reason;
  instrumentText.textContent = payload.instId || payload.position?.inst_id || "--";
  strategyText.textContent = payload.strategy || "--";
  lastCloseText.textContent = formatPrice(payload.last_close || payload.order?.price);
  modeText.textContent = `${snapshot.mode || "--"} / ${execute}`;
  updatedAtText.textContent = formatDate(snapshot.published_at);
  sourceText.textContent = snapshot.source || "--";

  setFlow(payload, snapshot, reason, signal);

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
    signalValue.textContent = "WAIT";
    actionValue.textContent = "data pending";
    reasonText.textContent = `讀取 data/latest.json 失敗：${error.message}`;
    updatedAtText.textContent = "讀取失敗";
    setRows([["error", error.message]]);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "刷新";
  }
}

refreshButton.addEventListener("click", loadDashboard);
loadDashboard();
window.setInterval(loadDashboard, 60_000);
