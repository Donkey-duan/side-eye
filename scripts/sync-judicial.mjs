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
 * 這支腳本不進 git、不碰你的其他資料，只做三件事：抓資料 → 更新 Release 種子 → 觸發部署。
 */
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const TAG = "judicial-seed";           // 存種子的 Release 標籤
const SEED_FILE = "public/data/judgments.json";
const WORKFLOW = "deploy.yml";         // 用檔名觸發，避免中文工作流程名的引號問題

function run(cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true, env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) {
    console.error(`\n✗ 指令失敗（離開碼 ${r.status}）：${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

function capture(cmd, args) {
  return (spawnSync(cmd, args, { encoding: "utf8", shell: true }).stdout ?? "").trim();
}

const repo = capture("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
if (!repo) {
  console.error("✗ 取不到 repo 資訊，請確認 gh 已登入（gh auth status）且在專案目錄下執行。");
  process.exit(1);
}
// 本機累加的起點＝CI 讀的同一份種子，兩邊一致
const seedUrl = `https://github.com/${repo}/releases/download/${TAG}/judgments.json`;

console.log("① 抓司法院 API 並處理（僅臺灣網路、開放時段可成功）");
console.log(`   累加起點：${seedUrl}`);
run("npm", ["run", "data:judicial"], { JUDICIAL_SOURCE_URL: seedUrl });

let count = "?";
try {
  const data = JSON.parse(readFileSync(SEED_FILE, "utf8"));
  count = Array.isArray(data) ? data.length : (data.records?.length ?? "?");
  const mb = (statSync(SEED_FILE).size / 1e6).toFixed(1);
  console.log(`\n② 已產出 ${SEED_FILE}：${count} 筆、${mb} MB`);
} catch {
  console.error(`✗ 讀不到 ${SEED_FILE}，同步可能失敗（API 逾時？非開放時段？），未推送。`);
  process.exit(1);
}

console.log("\n③ 推上 Release 種子（--clobber 覆蓋舊的）");
run("gh", ["release", "upload", TAG, SEED_FILE, "--clobber"]);

console.log("\n④ 觸發 CI 重建與部署");
run("gh", ["workflow", "run", WORKFLOW, "--ref", "main"]);

console.log(`\n✓ 完成：種子已更新為 ${count} 筆，CI 已開始重建部署。`);
console.log("  到 GitHub 的 Actions 分頁看進度，幾分鐘後線上統計就會更新。");
