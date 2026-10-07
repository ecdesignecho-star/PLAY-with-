
# Henry 老師｜城市街景速寫報名頁

Mobile-first 靜態 Landing Page，以原生 HTML、CSS、JavaScript 製作，不需套件或編譯。網站包含課程介紹、價目、優惠碼、報名表、來源追蹤、班級容量提示與管理員統計面板。

## 本機預覽

在此資料夾執行：

```bash
python -m http.server 8000
```

瀏覽 <http://localhost:8000>。也可直接開啟 `index.html`，但使用本機 HTTP 伺服器測試 URL 來源參數較方便，例如 `http://localhost:8000/?source=henry_ig`。

## 部署

將 `index.html`、`style.css`、`script.js` 與 `README.md` 放在 GitHub repository 根目錄，推送後在 **Settings → Pages** 選 **Deploy from a branch**、`main`、`/(root)` 並儲存。這會發布靜態前端；**請先接好下方的安全資料服務，才用來正式收集報名者個資。**

## 目前資料儲存狀態

專案資料夾原先沒有網站或後端。現在使用 `MockEnrollmentStore`，報名資料只存在目前分頁的記憶體：

- 完成表單會即時顯示成功狀態並更新同一分頁的管理面板。
- 關閉或重新整理頁面後，報名資料與統計會清除。
- 姓名、Email、手機、Instagram 與付款資料不會傳送到任何伺服器。
- 所以目前「報名成功」只代表前端流程完成，EC 不會收到報名。不可把這個 mock 模式當成正式招生收件系統。

把資料接到後端之後，亦須在伺服器端原子檢查名額，不能只依賴前端的 16 人上限；管理員面板應使用有登入保護的後端權限，不可讓公開訪客讀取含個資的報名列。

## 資料介面與 Supabase

資料介面集中在 `script.js` 的 `MockEnrollmentStore`，需要提供：

```js
list()                 // 回傳可供管理面板統計的報名紀錄
getPublicCount()       // 回傳不含個資的已報名名額
save(record)           // 儲存單筆報名，滿班時拒絕正式報名
```

替換方式：在 `script.js` 執行前載入一段設定程式，先將 `window.ECWorkshopDataStore` 指向實作以上介面的 adapter；或直接替換 `MockEnrollmentStore`。正式 Supabase 架構建議：

1. 建立 `enrollments` table，欄位對應 `timestamp`, `name`, `email`, `phone`, `instagram`, `course_plan`, `class_selection`, `coupon_code`, `original_price`, `discount_amount`, `final_price`, `acquisition_source`, `source`, `previous_ec_customer`, `creative_experience`, `payment_method`, `payer_name`, `payment_last5`, `payment_status`, `enrollment_status`。
2. 前端只放 Supabase publishable/anon key，絕不可放 service-role key。
3. 開啟 RLS。建議透過 Edge Function 收件和檢查名額，並以 service role 在伺服器端寫入；不要讓匿名用戶能讀取個資列。`getPublicCount()` 只讀安全名額摘要；`list()` 僅在已驗證管理員工作階段回傳管理面板需要的報名紀錄。
4. `save(record)` 呼叫 Edge Function；函式須驗證欄位、重新計價／驗證優惠碼，並在同一交易中檢查尚有名額後寫入。
5. 若管理端尚未登入，`list()` 可以拒絕請求；公開頁會退回安全名額摘要，不阻斷報名表操作。

目前報名物件由 `collectRegistration()` 建立，包含使用者填寫資料及來源參數。優惠碼和金額只在前端試算；正式系統必須在伺服器重新計算金額，不能信任瀏覽器傳來的價格。

## 來源追蹤

頁面讀取 `?source=...`，沒有參數時保存 `direct`。可使用：

- `?source=henry_ig`
- `?source=ec_ig`
- `?source=threads`
- `?source=friend`

這個 query source 儲存在報名物件的 `source` 欄位。表單另有「你是怎麼知道這次工作坊的？」欄位，對應 `acquisition_source`。

## 價格與文案調整

- 價格、方案、堂次、優惠碼條件與成班人數：`script.js` 最上方 `COURSE_CONFIG`。
- 課程文字、欄位、表單問題、完成提示：`index.html`。
- 顏色、版面、手機斷點：`style.css`。
- 街景插畫為頁內 SVG 示意作品；有 Henry 老師授權作品後，可替換 `index.html` 的 `.hero-visual`。

優惠規則目前為：`HENRY20` 適用一般單堂／三堂系列，將單堂計為 NT$700、三堂計為 NT$2,100；`ECPLAY` 適用三堂系列 NT$2,100；`FRIEND10` 適用一般單堂／三堂系列 9 折。Henry 專屬方案本身是每堂 NT$700，三堂 NT$2,100；EC 學員方案為三堂 NT$2,100。優惠碼不能同時套用。
