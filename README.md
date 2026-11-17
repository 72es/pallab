# PalLab

幻猻家珈琲 吧台工具：成本試算、食材單價、巧克力採購清單。

- `index.html`：整個網頁（GitHub Pages 直接發布）
- `apps-script/Code.gs`：Google 試算表「PalLab 資料庫」的 Apps Script，負責存取全店標準食譜

## 資料怎麼流

1. 網頁打開時，先用手機上次存的標準，再向 Apps Script 抓最新標準。
2. 夥伴按「更新」並輸入店內 PIN，Apps Script 比對 PIN 後寫進試算表：
   - `標準`：A1 是目前標準（JSON）
   - `紀錄`：每次更新一列，要退回舊版就把該列 JSON 貼回 `標準`!A1
   - `成本摘要`：每次更新後重寫的各飲品成本

PIN 只存在 Apps Script 裡，不在這個 repo。
