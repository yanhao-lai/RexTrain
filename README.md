# RexTrain 注音方塊冒險

適合國小一年級的手機優先注音練習網站。孩子可免登入遊玩看字選注音、注音排序及聽音選注音三種題型；每回合最多 10 題，依成績取得星星並解鎖下一關。進度只存在同一瀏覽器。題庫內建 54 道起始題，管理者可新增、修改、停用、匯入與匯出題目。

## 本機試玩

需 Node.js 22 以上。

```bash
npm install
npm run dev
```

開啟終端顯示的本機網址。未設定 Firebase 時，開發模式的「題庫管理」可用來試填；變更只會留在該瀏覽器。正式建置若未設定 Firebase，練習仍能使用內建題庫，但題庫管理不會開放。

```bash
npm test
npm run build
```

## 建立 Firebase 專案

1. 建立 Firebase 專案並加入 Web App。啟用 **Authentication → Google**、**Cloud Firestore** 及 **Hosting**。本專案使用一般 Firebase Hosting，無需 App Hosting 或 Cloud Storage。
2. 複製 `.env.example` 為 `.env.local`，填入 Web App 設定。這些 `VITE_` 值會進入前端程式；Firebase 安全性由 Firestore 規則管理，請勿把服務帳號私鑰放在此檔。
3. 安裝 Firebase CLI，登入並將專案與本地目錄連結：`npx firebase-tools login`、`npx firebase-tools use --add`。部署 Firestore 規則：`npx firebase-tools deploy --only firestore:rules`。
4. 在本機用您的 Google 帳號登入題庫管理頁，畫面會顯示 UID。到 Firestore 主控台建立 `admins/{該 UID}` 文件，內容可為 `{ "name": "owner" }`。重新登入後即可編輯。這個文件只能由 Firebase 主控台或具管理權限的服務帳號建立，前端不能自行授權管理者。
5. `npm run build` 後執行 `npx firebase-tools deploy --only hosting`。正式發佈前請在 Firebase Hosting 預覽頻道檢查手機畫面，例如 `npx firebase-tools hosting:channel:deploy preview`。

Firestore 規則讓訪客讀取公開題目，只允許 `admins/{uid}` 中已授權的登入者修改題目。請先部署規則，再開放網站。管理員文件及資料庫位置需在 Firebase 專案中設定。本專案沒有建立兒童帳號，也不會將孩子的成績送到 Firebase。

## GitHub 自動部署

工作流程位於 `.github/workflows/deploy.yml`。在 GitHub 專案中設定以下 Actions **Variables**：`VITE_FIREBASE_API_KEY`、`VITE_FIREBASE_AUTH_DOMAIN`、`VITE_FIREBASE_PROJECT_ID`、`VITE_FIREBASE_APP_ID`；設定 **Secret**：`FIREBASE_SERVICE_ACCOUNT`（Firebase 專案的部署服務帳號 JSON）。Pull request 會執行測試、建置並發佈預覽；推送至 `main` 才會發佈正式 Hosting。首次啟用前，請確認主分支為 `main` 並已部署 Firestore 規則。

如果還沒設定部署 Secret，工作流程只會測試及建置，不會發佈。網站可先使用 Firebase 提供的 `web.app` 網址，稍後再連自有網域。

## CSV 題庫格式

在管理頁下載 CSV 範本，以 UTF-8 儲存。欄位順序：

```text
id,type,level,prompt,answer,options,speechText,enabled
```

- `id` 新增時可空白，由系統產生；既有 ID 不會被批次覆寫。
- `type` 為 `choice`、`order` 或 `audio`；`level` 為 `1`、`2` 或 `3`。
- `answer` 使用注音，詞語內每個音節以空格隔開，例如 `ㄅㄞˊ ㄩㄣˊ`。
- 選擇及聽音題的 `options` 為四個以 `|` 分隔且互不重複的注音，必須包含答案；排序題留空。
- 聽音題的 `speechText` 必填，建議填中文字詞。`enabled` 為 `true` 或 `false`。

匯入前會顯示錯誤列與重複題。若檔案有錯誤列，需修正後才能提交。匯入中斷後可重新上傳同檔，已新增的重複題會被跳過。題庫可匯出為 CSV 備份。

## 語音及內容說明

聽音題使用裝置瀏覽器的 `zh-TW` 語音。語音是否存在、聲音品質及發音會隨作業系統而異；缺少繁體中文語音時，聽音題會從該次練習略過。正式公開前，請用預計使用的 iPad、Android 平板及手機試聽。

視覺為原創的方塊遊戲風格，沒有使用 Minecraft 商標或官方圖像。內建題庫用於第一版體驗；公開教學前請由注音教學者再核對詞語與聲調。
