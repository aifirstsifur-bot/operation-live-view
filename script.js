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
const refreshStatus = document.querySelector("#refreshStatus");
const autoRefreshText = document.querySelector("#autoRefreshText");
const chartMeta = document.querySelector("#chartMeta");
const gridLayer = document.querySelector("#gridLayer");
const axisLayer = document.querySelector("#axisLayer");
const priceLine = document.querySelector("#priceLine");
const markerLayer = document.querySelector("#markerLayer");
const priceLabelLayer = document.querySelector("#priceLabelLayer");
const emptyMarkers = document.querySelector("#emptyMarkers");
const REFRESH_SECONDS = 30;
const DATA_BASE_URL = "https://raw.githubusercontent.com/aifirstsifur-bot/operation-live-view/main/data";
let nextRefreshAt = Date.now() + REFRESH_SECONDS * 1000;
let loading = false;

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

function scale(value, fromMin, fromMax, toMin, toMax) {
  if (fromMax === fromMin) return (toMin + toMax) / 2;
  return toMin + ((value - fromMin) / (fromMax - fromMin)) * (toMax - toMin);
}

function drawGrid(width, height, pad, minPrice, maxPrice) {
  gridLayer.replaceChildren();
  axisLayer.replaceChildren();
  for (let index = 0; index <= 4; index += 1) {
    const y = pad + ((height - pad * 2) / 4) * index;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "grid-line");
    line.setAttribute("x1", pad);
    line.setAttribute("x2", width - pad);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    gridLayer.append(line);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const price = maxPrice - ((maxPrice - minPrice) / 4) * index;
    label.setAttribute("class", "axis-label");
    label.setAttribute("x", width - 8);
    label.setAttribute("y", y + 4);
    label.setAttribute("text-anchor", "end");
    label.textContent = formatPrice(price);
    axisLayer.append(label);
  }
}

function drawLatestPrice(point, price, width) {
  priceLabelLayer.replaceChildren();
  const label = formatPrice(price);
  const labelWidth = Math.max(76, label.length * 8 + 18);
  const x = Math.min(point.x + 10, width - labelWidth - 8);
  const y = Math.max(12, point.y - 18);

  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("class", "latest-price-pill");
  rect.setAttribute("x", x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", labelWidth);
  rect.setAttribute("height", 24);
  rect.setAttribute("rx", 8);
  priceLabelLayer.append(rect);

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("class", "latest-price-text");
  text.setAttribute("x", x + 9);
  text.setAttribute("y", y + 16);
  text.textContent = label;
  priceLabelLayer.append(text);
}

function renderChart(chart) {
  const candles = chart.candles || [];
  const markers = chart.markers || [];
  const width = 720;
  const height = 280;
  const pad = 32;

  chartMeta.textContent = `${chart.instId || "--"} ${chart.bar || ""}`;
  markerLayer.replaceChildren();
  priceLabelLayer.replaceChildren();

  if (candles.length < 2) {
    priceLine.setAttribute("d", "");
    emptyMarkers.textContent = "等待價格資料";
    return;
  }

  const tsValues = candles.map((item) => item.ts);
  const prices = candles.flatMap((item) => [item.high || item.close, item.low || item.close]);
  const minTs = Math.min(...tsValues);
  const maxTs = Math.max(...tsValues);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const pricePad = (maxPrice - minPrice) * 0.08 || 1;
  const axisMin = minPrice - pricePad;
  const axisMax = maxPrice + pricePad;

  drawGrid(width, height, pad, axisMin, axisMax);

  const pointFor = (ts, price) => ({
    x: scale(ts, minTs, maxTs, pad, width - pad),
    y: scale(price, axisMin, axisMax, height - pad, pad),
  });

  const path = candles
    .map((item, index) => {
      const point = pointFor(item.ts, item.close);
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
  priceLine.setAttribute("d", path);
  const latest = candles[candles.length - 1];
  drawLatestPrice(pointFor(latest.ts, latest.close), latest.close, width);

  let visibleMarkers = 0;
  for (const marker of markers) {
    if (!marker.ts || !marker.price || marker.ts < minTs || marker.ts > maxTs) continue;
    const point = pointFor(marker.ts, marker.price);
    const side = marker.side === "sell" ? "sell" : "buy";

    const source = marker.source === "backtest" ? "backtest" : "live";
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", `marker ${side} ${source}`);
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", 7);
    markerLayer.append(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "marker-label");
    label.setAttribute("x", point.x + 10);
    label.setAttribute("y", point.y - 9);
    const prefix = source === "backtest" ? "BT " : "";
    label.textContent = `${prefix}${side === "sell" ? "SELL" : "BUY"} ${formatPrice(marker.price)}`;
    markerLayer.append(label);
    visibleMarkers += 1;
  }

  emptyMarkers.textContent = visibleMarkers ? `${visibleMarkers} 個買賣點` : "尚無買賣點";
}

async function loadDashboard() {
  if (loading) return;
  loading = true;
  refreshButton.disabled = true;
  refreshButton.textContent = "讀取中";
  refreshStatus.textContent = "同步資料中...";
  const cacheKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const response = await fetch(`${DATA_BASE_URL}/latest.json?t=${cacheKey}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const snapshot = await response.json();
    renderSnapshot(snapshot);

    const chartResponse = await fetch(`${DATA_BASE_URL}/chart.json?t=${cacheKey}`, {
      cache: "no-store",
    });
    if (chartResponse.ok) {
      renderChart(await chartResponse.json());
    }
    const currentTime = formatDate(new Date().toISOString());
    refreshStatus.textContent = `已同步 ${currentTime}`;
  } catch (error) {
    signalValue.textContent = "WAIT";
    actionValue.textContent = "data pending";
    reasonText.textContent = `讀取最新交易資料失敗：${error.message}`;
    updatedAtText.textContent = "讀取失敗";
    setRows([["error", error.message]]);
    refreshStatus.textContent = "同步失敗，30 秒後重試";
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "立即刷新";
    nextRefreshAt = Date.now() + REFRESH_SECONDS * 1000;
    loading = false;
  }
}

function updateRefreshCountdown() {
  const remaining = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
  autoRefreshText.textContent = `auto refresh ${remaining}s`;
  if (remaining === 0) loadDashboard();
}

refreshButton.addEventListener("click", () => {
  nextRefreshAt = Date.now();
  loadDashboard();
});
loadDashboard();
window.setInterval(updateRefreshCountdown, 1000);
