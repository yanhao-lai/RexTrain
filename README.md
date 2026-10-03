# RexTrain 注音方塊冒險

適合國小一年級的手機優先注音練習網站，使用 GitHub Pages 發佈，不需要 Firebase 或其他後端。孩子可免登入練習看字選注音、注音排序及聽音選注音，也可從首頁直接選「多字練習」練習 2～4 字詞。聽音題可切換選擇或手寫作答；手寫會顯示標準答案供孩子自行核對。排序題會混入額外的干擾注音。內建 66 道起始題；每回合最多 10 題，依成績獲得星星並解鎖下一關。闖關進度只儲存在孩子使用的瀏覽器。

## 本機開發

需 Node.js 22 以上。

```bash
npm ci
npm run dev
npm test
npm run build
npm run build:pages
```

## 發佈網站到 GitHub Pages

倉庫已有 `.github/workflows/pages.yml`。在 GitHub 開啟 **Settings → Pages → Build and deployment → Source**，選 **GitHub Actions**。接著在 **Actions → Publish GitHub Pages → Run workflow** 執行一次；之後推送到 `main` 會自動重新發佈。成功後網址為 `https://yanhao-lai.github.io/RexTrain/`。

## 新增與匯入題目

1. 開啟網站的「題庫管理」。可新增、編輯、停用題目，也可下載 CSV 範本並批次匯入。匯入前會預覽錯誤列與重複題。
2. 題目先存在**目前瀏覽器的本機草稿**，不會立即改變公開網站。完成後按「下載發佈檔」，得到 `questions.json`。
3. 以擁有倉庫寫入權限的 GitHub 帳號，將該檔放到倉庫的 `public/questions.json`，提交到 `main`。可在本地取代檔案後執行 `git add public/questions.json`、`git commit`、`git push`；也可以使用 GitHub 網站的檔案編輯或上傳功能。
4. GitHub Pages 工作流程通過後，新題目才會對所有孩子生效。確認公開題庫更新後，可在管理頁清除這台裝置的本機草稿，重新載入 GitHub 上的版本。

公開網站的管理頁是**本機出題工具**：任何人都可在自己的瀏覽器試編輯，但只有 GitHub 倉庫的寫入者能發佈給所有人。請不要將個人資料或秘密放入題庫檔，因為公開題目會隨網站提供給訪客。

### CSV 格式

欄位順序：

```text
id,type,level,prompt,answer,options,speechText,enabled
```

- `id` 新增時可留空，由系統產生。
- `type` 為 `choice`、`order` 或 `audio`；`level` 為 `1`、`2` 或 `3`。
- `answer` 填注音，多音節以空格隔開，例如 `ㄅㄞˊ ㄩㄣˊ`。
- 選擇及聽音題的 `options` 為四個以 `|` 分隔、互不重複的注音，且必須包含答案。排序題可填最多六個以 `|` 分隔、答案中沒有的單一干擾注音，例如 `ㄆ|ㄠ|ㄤ`；留空時會自動產生三個。
- 聽音題的 `speechText` 必填，建議填中文字詞。`enabled` 為 `true` 或 `false`。

匯入時若有錯誤列，需修正後才可提交。管理頁也可匯出 CSV 備份；**實際發佈使用 `questions.json`**。

## 語音與素材

聽音題使用裝置瀏覽器的 `zh-TW` 語音。缺少繁體中文語音時，該次練習會略過聽音題。正式教學前，請在要使用的手機與平板試聽，並由注音教學者核對內建題庫。畫面使用原創方塊遊戲風格，沒有 Minecraft 官方素材。

手寫題使用觸控或滑鼠畫布，不做自動辨識。孩子看見正確答案後自行選擇「我寫對了」或「再練一次」，這項自評會計入當回合成績。
