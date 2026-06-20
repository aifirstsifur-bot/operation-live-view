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
const performanceMeta = document.querySelector("#performanceMeta");
const performanceGrid = document.querySelector("#performanceGrid");
const validationMeta = document.querySelector("#validationMeta");
const validationGrid = document.querySelector("#validationGrid");
const paramsMeta = document.querySelector("#paramsMeta");
const paramsGrid = document.querySelector("#paramsGrid");
const optimizationMeta = document.querySelector("#optimizationMeta");
const optimizationList = document.querySelector("#optimizationList");
const gridLayer = document.querySelector("#gridLayer");
const axisLayer = document.querySelector("#axisLayer");
const priceLine = document.querySelector("#priceLine");
const markerLayer = document.querySelector("#markerLayer");
const priceLabelLayer = document.querySelector("#priceLabelLayer");
const emptyMarkers = document.querySelector("#emptyMarkers");
const markerList = document.querySelector("#markerList");
const REFRESH_SECONDS = 30;
const DATA_BASE_URL = new URL("./data", window.location.href).toString().replace(/\/$/, "");
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

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return `${Number(value).toFixed(2)}%`;
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
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

function flowStateForReadiness(verdict) {
  if (verdict === "paper_review") return "safe";
  if (verdict === "watchlist") return "idle";
  if (verdict === "blocked") return "blocked";
  return "idle";
}

function setFlow(payload, snapshot, reason, signal) {
  if (snapshot.payload_type === "api_readiness") {
    const checks = payload.checks || [];
    const checkMap = Object.fromEntries(checks.map((check) => [check.name, check]));
    const flow = [
      ["Env 檔案", checkMap.env_file?.detail || "--", checkMap.env_file?.status === "pass" ? "safe" : "blocked"],
      ["Credentials", checkMap.credentials?.detail || "--", checkMap.credentials?.status === "pass" ? "safe" : "blocked"],
      ["Paper / Live Gate", checkMap.live_order_gate?.detail || "--", checkMap.live_order_gate?.status === "pass" ? "safe" : "blocked"],
      ["Instrument", checkMap.instrument_mode?.detail || "--", checkMap.instrument_mode?.status === "pass" ? "safe" : "idle"],
      ["Public Endpoint", checkMap.public_instruments?.detail || "--", checkMap.public_instruments?.status === "pass" ? "safe" : "blocked"],
      ["Private Balance", checkMap.private_balance?.detail || "--", checkMap.private_balance?.status === "pass" ? "safe" : "idle"],
      ["API Gate", `${payload.status || "unknown"} · ${(payload.blockers || []).join(", ") || "no blockers"}`, payload.status === "blocked" ? "blocked" : "safe"],
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
    return;
  }

  const readiness = payload.trade_readiness || {};
  const decision = payload.decision || {};
  const risk = payload.risk_review || {};
  const hasRiskReview = Object.keys(risk).length > 0;
  const order = payload.order || {};
  const hasOrder = Boolean(order.side || order.size);
  const protection = payload.protection_result ? "OCO protection placed" : "waiting for executable entry";
  const ledger = payload.paper_record ? "ledger updated" : payload.state_path || "ledger pending";
  const verdict = readiness.verdict || (signal === "hold" ? "wait" : "manual_review");
  const readinessDetail = readiness.score !== undefined
    ? `${readiness.score}/${readiness.max_score} · ${verdict}`
    : verdict;
  const riskDetail = !hasRiskReview
    ? "auto-trade safety path"
    : risk.valid_size
    ? `size ${formatNumber(risk.adjusted_size, 6)}`
    : (readiness.blockers || risk.blockers || ["not evaluated"]).join(", ");

  const flow = [
    ["取得市場資料", `${payload.instId || "--"} ${payload.bar || "1H"} candle`, "done"],
    ["策略訊號", `${payload.strategy || "--"} · ${signal}: ${reason}`, signal === "hold" ? "idle" : signal],
    ["Readiness Gate", readinessDetail, flowStateForReadiness(verdict)],
    ["風控檢查", riskDetail, !hasRiskReview || risk.valid_size ? "safe" : "blocked"],
    ["Paper Review", verdict === "paper_review" ? "ready for manual paper review" : "not promoted", verdict === "paper_review" ? "safe" : "idle"],
    ["Demo Execute", hasOrder && payload.execute ? `${order.side} ${formatNumber(order.size, 6)}` : "execute=false / waiting", hasOrder && payload.execute ? signal : "idle"],
    ["TP/SL 保護", protection, payload.protection_result ? "safe" : "idle"],
    ["Ledger / State", ledger, payload.paper_record ? "safe" : "idle"],
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
  if (snapshot.payload_type === "api_readiness") {
    const status = (payload.status || "unknown").toLowerCase();
    const signal = status === "blocked" ? "sell" : status.includes("ready") ? "buy" : "hold";
    const checks = payload.checks || [];
    const failed = checks.filter((check) => check.status === "fail").length;
    const warned = checks.filter((check) => check.status === "warn").length;
    const passed = checks.filter((check) => check.status === "pass").length;

    signalPanel.className = `panel signal-panel signal-${signal}`;
    signalValue.textContent = status === "blocked" ? "BLOCK" : "API";
    actionValue.textContent = "api-readiness";
    reasonText.textContent = (payload.blockers || []).join(", ") || payload.status || "ready";
    instrumentText.textContent = payload.instId || "--";
    strategyText.textContent = "api-readiness";
    lastCloseText.textContent = `${passed}/${checks.length || 0} pass`;
    modeText.textContent = `${payload.mode || "--"} / ${payload.tdMode || "--"}`;
    updatedAtText.textContent = formatDate(snapshot.published_at);
    sourceText.textContent = snapshot.source || "--";

    setFlow(payload, snapshot, reasonText.textContent, signal);
    const rows = [
      [formatDate(snapshot.published_at), `API gate：${payload.status || "--"}`],
      ["checks", `pass ${passed}, warn ${warned}, fail ${failed}`],
      ["blockers", (payload.blockers || []).join(", ") || "none"],
      ["credentials", Object.entries(payload.credential_state || {}).map(([key, value]) => `${key}:${value}`).join(", ")],
    ];
    if (payload.instrument) {
      rows.push(["instrument", `${payload.instrument.instId} ${payload.instrument.instType} min ${payload.instrument.minSz}`]);
    }
    setRows(rows);
    return;
  }

  const decision = payload.decision || {};
  const signal = (payload.signal || decision.signal || payload.action || "unknown").toLowerCase();
  const action = (payload.action || decision.action || "unknown").toLowerCase();
  const reason = payload.reason || payload.decision?.reason || "no reason";
  const execute = payload.execute === true ? "execute=true" : "execute=false";
  const readiness = payload.trade_readiness || {};
  const publicStats = payload.okx_public_stats || {};
  const funding = publicStats.funding_rate || {};
  const openInterest = publicStats.open_interest || {};
  const longShort = publicStats.long_short_account_ratio || {};

  signalPanel.className = `panel signal-panel signal-${signal}`;
  signalValue.textContent = signal.toUpperCase();
  actionValue.textContent = `action: ${action}`;
  reasonText.textContent = reason;
  instrumentText.textContent = payload.instId || payload.position?.inst_id || "--";
  strategyText.textContent = payload.strategy || "--";
  lastCloseText.textContent = formatPrice(payload.last_close || payload.latest_candle?.close || payload.order?.price);
  modeText.textContent = readiness.score !== undefined ? `readiness ${readiness.score}/${readiness.max_score}` : `${snapshot.mode || "--"} / ${execute}`;
  updatedAtText.textContent = formatDate(snapshot.published_at);
  sourceText.textContent = snapshot.source || "--";

  setFlow(payload, snapshot, reason, signal);

  const rows = [
    [formatDate(snapshot.published_at), `決策：${action}`],
    ["signal", `訊號：${signal}`],
    ["reason", `原因：${reason}`],
  ];

  if (readiness.score !== undefined) rows.push(["gate", `readiness：${readiness.score}/${readiness.max_score} · ${readiness.verdict}`]);
  if (readiness.blockers?.length) rows.push(["blockers", readiness.blockers.join(", ")]);
  if (payload.stop_price) rows.push(["stop", `停損：${formatPrice(payload.stop_price)}`]);
  if (payload.take_profit_price) rows.push(["take", `停利：${formatPrice(payload.take_profit_price)}`]);
  if (decision.stop_price) rows.push(["stop", `停損：${formatPrice(decision.stop_price)}`]);
  if (decision.take_profit_price) rows.push(["take", `停利：${formatPrice(decision.take_profit_price)}`]);
  if (funding.current !== undefined) rows.push(["funding", `funding：${formatNumber(Number(funding.current) * 100, 5)}%`]);
  if (openInterest.oi_usd) rows.push(["OI", `open interest：$${formatNumber(openInterest.oi_usd, 0)}`]);
  if (longShort.ratio) rows.push(["L/S", `long-short：${formatNumber(longShort.ratio)}`]);
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

function markerShape(side, point) {
  if (side === "sell") {
    return `${point.x},${point.y + 12} ${point.x - 12},${point.y - 10} ${point.x + 12},${point.y - 10}`;
  }
  return `${point.x},${point.y - 12} ${point.x - 12},${point.y + 10} ${point.x + 12},${point.y + 10}`;
}

function renderChart(chart) {
  const candles = chart.candles || [];
  const markers = chart.markers || [];
  const width = 720;
  const height = 340;
  const pad = 40;

  chartMeta.textContent = `${chart.instId || "--"} ${chart.bar || ""}`;
  markerLayer.replaceChildren();
  priceLabelLayer.replaceChildren();
  markerList.replaceChildren();

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
  const markerRows = [];
  for (const marker of markers) {
    if (!marker.ts || !marker.price || marker.ts < minTs || marker.ts > maxTs) continue;
    const point = pointFor(marker.ts, marker.price);
    const side = marker.side === "sell" ? "sell" : "buy";

    const source = marker.source === "backtest" ? "backtest" : "live";
    const markerNumber = visibleMarkers + 1;
    const stem = document.createElementNS("http://www.w3.org/2000/svg", "line");
    stem.setAttribute("class", `marker-stem ${side}`);
    stem.setAttribute("x1", point.x);
    stem.setAttribute("x2", point.x);
    stem.setAttribute("y1", point.y);
    stem.setAttribute("y2", side === "sell" ? Math.max(18, point.y - 24) : Math.min(height - 18, point.y + 24));
    markerLayer.append(stem);

    const shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    shape.setAttribute("class", `marker ${side} ${source}`);
    shape.setAttribute("points", markerShape(side, point));
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${source.toUpperCase()} ${side.toUpperCase()} ${formatPrice(marker.price)} ${formatDate(marker.ts)}`;
    shape.append(title);
    markerLayer.append(shape);

    const number = document.createElementNS("http://www.w3.org/2000/svg", "text");
    number.setAttribute("class", "marker-number");
    number.setAttribute("x", point.x);
    number.setAttribute("y", side === "sell" ? point.y - 12 : point.y + 20);
    number.setAttribute("text-anchor", "middle");
    number.textContent = markerNumber;
    markerLayer.append(number);
    markerRows.push({ ...marker, side, source, markerNumber });
    visibleMarkers += 1;
  }

  emptyMarkers.textContent = visibleMarkers ? `${visibleMarkers} 個買賣點` : "尚無買賣點";
  for (const marker of markerRows.slice(-8).reverse()) {
    const item = document.createElement("div");
    item.className = `marker-row ${marker.side}`;
    item.innerHTML = `
      <strong>#${marker.markerNumber} ${marker.source === "backtest" ? "BT" : "LIVE"} ${marker.side.toUpperCase()}</strong>
      <span class="marker-price">${formatPrice(marker.price)}</span>
      <span>${formatDate(marker.ts)}</span>
      <span>${marker.reason || marker.action || ""}</span>
    `;
    markerList.append(item);
  }
}

function renderBacktest(chart) {
  const backtest = chart.backtest || {};
  const report = backtest.report || {};
  performanceMeta.textContent = `${backtest.strategy || "--"} / ${backtest.window_candles || 0} candles`;

  const rows = [
    ["總報酬", formatPercent(report.total_return_pct), report.total_return_pct],
    ["最大回撤", formatPercent(report.max_drawdown_pct), -report.max_drawdown_pct],
    ["交易數", formatNumber(report.trades, 0), null],
    ["勝率", formatPercent(report.win_rate_pct), report.win_rate_pct - 50],
    ["Profit Factor", formatNumber(report.profit_factor), report.profit_factor - 1],
    ["平均 PnL", formatNumber(report.avg_trade_pnl), report.avg_trade_pnl],
  ];

  performanceGrid.replaceChildren();
  for (const [label, value, score] of rows) {
    const item = document.createElement("div");
    const tone = score === null ? "neutral" : score >= 0 ? "positive" : "negative";
    item.className = `performance-card ${tone}`;
    item.innerHTML = `
      <p>${label}</p>
      <strong>${value}</strong>
    `;
    performanceGrid.append(item);
  }
}

function renderValidation(chart) {
  const validation = chart.validation || {};
  validationMeta.textContent = validation.error
    ? "validation unavailable"
    : `${validation.train_size || 0}/${validation.test_size || 0} candles, ${validation.source || "--"}`;

  const verdictReady = validation.verdict === "ready";
  const verdictText = validation.error ? "ERROR" : verdictReady ? "READY" : "NOT READY";
  const rows = [
    ["結論", verdictText, verdictReady ? 1 : -1],
    ["通過率", formatPercent(validation.pass_rate_pct), (validation.pass_rate_pct || 0) - 50],
    ["測試窗", `${validation.passed_windows || 0}/${validation.windows || 0}`, null],
    ["平均測試報酬", formatPercent(validation.avg_test_return_pct), validation.avg_test_return_pct],
    ["最差測試報酬", formatPercent(validation.worst_test_return_pct), validation.worst_test_return_pct],
    ["平均測試交易", formatNumber(validation.avg_test_trades), (validation.avg_test_trades || 0) - (validation.min_trades || 0)],
  ];

  validationGrid.replaceChildren();
  for (const [label, value, score] of rows) {
    const item = document.createElement("div");
    const tone = score === null ? "neutral" : score >= 0 ? "positive" : "negative";
    item.className = `performance-card ${tone}`;
    item.innerHTML = `
      <p>${label}</p>
      <strong>${value}</strong>
    `;
    validationGrid.append(item);
  }
}

function renderParams(chart) {
  const backtest = chart.backtest || {};
  const params = backtest.params || {};
  paramsMeta.textContent = backtest.strategy || "--";
  const rows = [
    ["fast", params.fast_period],
    ["slow", params.slow_period],
    ["trend", params.trend_period],
    ["ATR", `${formatNumber(params.min_atr_pct, 3)}-${formatNumber(params.max_atr_pct, 3)}`],
    ["slope", params.min_slope_pct],
    ["stop", `${formatNumber(params.stop_atr)} ATR`],
    ["take", `${formatNumber(params.take_profit_r)}R`],
    ["hold", `${params.min_hold_bars || "--"}-${params.max_hold_bars || "--"}`],
    ["cooldown", params.cooldown_bars],
  ];

  paramsGrid.replaceChildren();
  for (const [label, value] of rows) {
    const item = document.createElement("span");
    item.innerHTML = `<strong>${label}</strong>${value ?? "--"}`;
    paramsGrid.append(item);
  }
}

function shortParams(params) {
  return [
    `f/s ${params.fast_period || "--"}/${params.slow_period || "--"}`,
    `trend ${params.trend_period || "--"}`,
    `ATR ${formatNumber(params.min_atr_pct, 3)}-${formatNumber(params.max_atr_pct, 3)}`,
    `take ${formatNumber(params.take_profit_r)}R`,
    `hold ${params.min_hold_bars || "--"}-${params.max_hold_bars || "--"}`,
  ].join(" · ");
}

function renderOptimization(chart) {
  const optimization = chart.optimization || {};
  const candidates = optimization.top || [];
  optimizationMeta.textContent = `${optimization.candidates || 0} candidates / min trades ${optimization.min_trades || "--"}`;
  optimizationList.replaceChildren();

  if (!candidates.length) {
    const empty = document.createElement("div");
    empty.className = "candidate-card";
    empty.innerHTML = "<strong>等待最佳候選</strong><p>optimizer pending</p>";
    optimizationList.append(empty);
    return;
  }

  candidates.forEach((candidate, index) => {
    const full = candidate.full_report || {};
    const walk = candidate.walk_forward || {};
    const item = document.createElement("div");
    item.className = "candidate-card";
    item.innerHTML = `
      <strong>#${index + 1} ${formatPercent(full.total_return_pct)} / WF ${formatPercent(walk.pass_rate_pct)}</strong>
      <p>${shortParams(candidate.params || {})}</p>
      <div class="candidate-metrics">
        <span>DD ${formatPercent(full.max_drawdown_pct)}</span>
        <span>trades ${formatNumber(full.trades, 0)}</span>
        <span>PF ${formatNumber(full.profit_factor)}</span>
        <span>avg test ${formatPercent(walk.avg_test_return_pct)}</span>
      </div>
    `;
    optimizationList.append(item);
  });
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
      const chart = await chartResponse.json();
      renderChart(chart);
      renderBacktest(chart);
      renderValidation(chart);
      renderParams(chart);
      renderOptimization(chart);
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
