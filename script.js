const steps = [
  "建立任務，準備開始掃描",
  "連線資料來源",
  "取得最新市場資料",
  "清理與排序候選清單",
  "計算成交量、漲跌幅與趨勢訊號",
  "篩選符合條件的標的",
  "整理結果並更新畫面",
  "任務完成，等待下一次執行",
];

const runButton = document.querySelector("#runButton");
const clearButton = document.querySelector("#clearButton");
const logList = document.querySelector("#logList");
const statusText = document.querySelector("#status");
const progressBar = document.querySelector("#progress");

let isRunning = false;

function timeLabel() {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function addLog(message) {
  const item = document.createElement("li");
  item.className = "log-item";
  item.innerHTML = `
    <span class="log-time">${timeLabel()}</span>
    <span class="log-message">${message}</span>
  `;
  logList.prepend(item);
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function runDemo() {
  if (isRunning) return;

  isRunning = true;
  runButton.disabled = true;
  runButton.textContent = "執行中";
  progressBar.style.width = "0%";

  for (const [index, step] of steps.entries()) {
    statusText.textContent = step;
    addLog(step);
    progressBar.style.width = `${Math.round(((index + 1) / steps.length) * 100)}%`;
    await wait(720);
  }

  runButton.disabled = false;
  runButton.textContent = "再跑一次";
  isRunning = false;
}

function clearLogs() {
  logList.replaceChildren();
  statusText.textContent = "等待開始";
  progressBar.style.width = "0%";
}

runButton.addEventListener("click", runDemo);
clearButton.addEventListener("click", clearLogs);

addLog("網頁已載入，等待操作");
