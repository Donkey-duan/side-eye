/**
 * 本機專用：在臺灣網路環境更新裁判資料，並自動把種子推上 GitHub Release、觸發部署。
 *
 * 為什麼要本機跑：司法院 API 只讓國內 IP 連，GitHub Actions 的機器（境外）一律連線逾時
 * （UND_ERR_CONNECT_TIMEOUT）。所以「抓 API＋處理」只能在你的機器做，做完把 judgments.json
 * 推到 GitHub Release 當種子，CI 再讀種子重算統計、部署。CI 永遠不碰 API。
 *
 * 用法（僅臺灣時間 00:00–06:00，API 才開放）：
 *   npm run sync:judicial
 *
 * 需要：本機 .env 內有 JUDICIAL_API_USER / JUDICIAL_API_PASSWORD；gh 已登入且在專案目錄。
 * 這支腳本不進 git、不碰你的其他資料，只做四件事：啟用工作流程 → 抓資料 → 更新 Release 種子 → 觸發部署。
 * 每晚由 Windows 工作排程「明鏡-裁判資料同步」自動執行。
 *
 * 為什麼觸發前要先 enable：GitHub 對 60 天沒有 commit 的公開 repo 會自動停用工作流程
 * （狀態 disabled_inactivity），停用後連 workflow_dispatch 也無法觸發。2026-10-17 的夜間
 * 同步就因此在 dispatch 這步收到 HTTP 422（Cannot trigger a workflow_dispatch on a disabled
 * workflow），種子其實已上傳成功。gh workflow enable 是冪等的，已啟用時也不會報錯，
 * 所以每次同步一開始就先跑一次，失敗只警告不中止。
 */
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const TAG = "judicial-seed";           // 存種子的 Release 標籤
const SEED_FILE = "public/data/judgments.json";
const WORKFLOW = "deploy.yml";         // 用檔名觸發，避免中文工作流程名的引號問題

// 用完整命令字串跑，避免 spawn 的 shell+args 觸發 DEP0190；命令都是固定常數、無注入疑慮。
function run(command, extraEnv = {}) {
  try {
    execSync(command, { stdio: "inherit", env: { ...process.env, ...extraEnv } });
  } catch (error) {
    console.error(`\n✗ 指令失敗：${command}`);
    process.exit(error.status ?? 1);
  }
}

function capture(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

const repo = capture("gh repo view --json nameWithOwner --jq .nameWithOwner");
if (!repo) {
  console.error("✗ 取不到 repo 資訊，請確認 gh 已登入（gh auth status）且在專案目錄下執行。");
  process.exit(1);
}
// 本機累加的起點＝CI 讀的同一份種子，兩邊一致
const seedUrl = `https://github.com/${repo}/releases/download/${TAG}/judgments.json`;

console.log("① 確保工作流程已啟用（GitHub 會自動停用閒置 60 天的 repo；就算後面抓資料失敗，先啟用也能讓夜間排程恢復）");
try {
  execSync(`gh workflow enable ${WORKFLOW}`, { stdio: "inherit" });
} catch {
  console.error("  警告：gh workflow enable 失敗，繼續同步；若工作流程仍是停用狀態，最後一步觸發會失敗，請手動 gh workflow enable deploy.yml。");
}
console.log("");

console.log("② 抓司法院 API 並處理（僅臺灣網路、開放時段可成功）");
console.log(`   累加起點：${seedUrl}`);
run("npm run data:judicial", { JUDICIAL_SOURCE_URL: seedUrl });

let count = "?";
try {
  const data = JSON.parse(readFileSync(SEED_FILE, "utf8"));
  count = Array.isArray(data) ? data.length : (data.records?.length ?? "?");
  const mb = (statSync(SEED_FILE).size / 1e6).toFixed(1);
  console.log(`\n③ 已產出 ${SEED_FILE}：${count} 筆、${mb} MB`);
} catch {
  console.error(`✗ 讀不到 ${SEED_FILE}，同步可能失敗（API 逾時？非開放時段？），未推送。`);
  process.exit(1);
}

// 裁判資料只增不減：司法院只會用「查無資料」通知下架，不會整批消失。
// --clobber 會直接覆蓋掉權威種子，上傳前先跟目前掛在 Release 上的筆數比一比，
// 新筆數比舊的少就中止，避免一次錯誤的本機執行把既有累積毀掉還沒人發現。
console.log("\n④ 上傳前比對筆數（裁判資料只增不減）");
let previousCount = 0;
try {
  const response = await fetch(seedUrl);
  if (response.ok) {
    const previous = await response.json();
    previousCount = Array.isArray(previous) ? previous.length : (previous.records?.length ?? 0);
  } else if (response.status !== 404) {
    console.error(`  警告：取得目前種子筆數時回應 ${response.status}，暫時視為 0 筆，比對可能不準確。`);
  }
} catch (error) {
  console.error(`  警告：取得目前種子筆數失敗（${error.message}），暫時視為 0 筆，比對可能不準確。`);
}
console.log(`  目前種子：${previousCount} 筆；本次產出：${count} 筆`);

const FORCE = process.env.SYNC_FORCE === "1";
if (typeof count === "number" && count < previousCount) {
  if (!FORCE) {
    console.error(`\n✗ 新產出 ${count} 筆，少於目前種子的 ${previousCount} 筆，中止上傳。`);
    console.error("  裁判資料只會累加，筆數變少多半代表這次同步有問題，而不是司法院真的下架了這麼多筆。");
    console.error("  確認無誤後設定環境變數 SYNC_FORCE=1 重新執行即可跳過本檢查。");
    process.exit(1);
  }
  console.error(`  已設定 SYNC_FORCE=1，略過筆數檢查（新 ${count} 筆 < 舊 ${previousCount} 筆），照常上傳。`);
}

console.log("\n⑤ 推上 Release 種子（--clobber 覆蓋舊的）");
run(`gh release upload ${TAG} ${SEED_FILE} --clobber`);

console.log("\n⑥ 觸發 CI 重建與部署");
run(`gh workflow run ${WORKFLOW} --ref main`);

console.log(`\n✓ 完成：種子已更新為 ${count} 筆，CI 已開始重建部署。`);
console.log("  到 GitHub 的 Actions 分頁看進度，幾分鐘後線上統計就會更新。");
