# Google／LINE 登入與雲端同步設定

網站在沒有任何憑證時會安全維持訪客模式。Firebase Web 設定是公開識別資料，可以寫入前端；LINE Client Secret 則只能留在 Google Cloud／LINE 後台，絕不可提交到 Git。

## 1. Firebase 與 Firestore

1. 建立 Firebase 專案與 Web App，啟用 Authentication、Cloud Firestore。
2. Authentication 啟用 Google provider，並把 `orsinobbb.github.io` 加入 Authorized domains。
3. 將專案根目錄的 `firestore.rules` 發佈到 Firestore。規則只允許使用者讀寫自己的 `users/{uid}/private/*`。
4. 把 Web App 的 `apiKey`、`authDomain`、`projectId`、`appId` 填入 `src/cloud/cloud-config.js`。這四項不是伺服器密鑰。

## 2. LINE Login（OIDC）

1. 在 LINE Developers 建立 LINE Login channel，取得 Channel ID 與 Channel secret。
2. 在 Google Cloud Identity Platform 啟用 OpenID Connect provider，Provider ID 設為 `oidc.line`，Issuer 使用 `https://access.line.me`，填入 LINE 的 Channel ID／secret。
3. Identity Platform 會顯示 Firebase OAuth handler URL，格式通常是 `https://<project-id>.firebaseapp.com/__/auth/handler`；把它加入 LINE Login 的 Callback URL。
4. 使用 `openid profile` scope；若要讀取 email，必須另外符合 LINE 的 email permission 要求。本站同步不依賴 email。

LINE Login 只負責登入，不代表使用者已加入 LINE 官方帳號，也不能直接傳播訊息。官方帳號通知需要另一套 Messaging API 與獨立同意。

## 3. 上線檢查

- Google popup 能登入、登出，再登入後進度仍在。
- LINE callback 回到正式 Pages 網址且 Firebase user 的 provider 是 `oidc.line`。
- 兩台裝置各自完成不同關卡後登入，完成項目為聯集，最佳時間取較短值。
- 未登入時 Network 不應載入 Firebase SDK，Firestore 不應產生文件。
- 登入同意與活動通知同意可分別勾選、分別撤回。
- 公開隱私網址使用 `https://orsinobbb.github.io/sudoku-learning-studio/privacy.html`。
