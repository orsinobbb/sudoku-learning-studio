# 數織學堂 Sudoku Learning Studio

以既有 Othello 教學專案的「純前端、規則核心分離、逐步教學、可驗證」模式，重新設計成數獨學習網站。

## 功能

- 解題教室：鍵盤／滑鼠輸入、候選筆記、衝突提示、復原、重來、完成度與本機學習紀錄。
- 智慧出題：四種經技巧分析校準的難度、可重現種子碼、盤面等價變形、唯一解驗證。
- 題目分析：盤面合法性、解的數量、難度分級、技巧統計與分步推理；搜尋驗證不會被冒充成邏輯技巧。
- 分析器：實際辨識 30 種技巧，涵蓋單數、區塊排除、子集、魚形、翼、著色、鏈、ALS、唯一矩形、BUG+1 與強制鏈。
- 完整學習旅程：六階段、34 個節點，從規則與候選數一路到魚形、翼、鏈、ALS、唯一性與強制鏈。
- 學習歷程：保存課程完成、提示、題目分析與解題事件，顯示階段進度與下一個學習節點。
- 分步教練：說明觀察範圍、候選數與下一步理由，可選擇是否套用。
- 分享與成長入口：每日挑戰、同盤好友挑戰、LINE／系統分享、熱門技巧入口與本機漏斗事件。
- 選擇性雲端備份：訪客可完整使用；設定 Firebase 後可啟用 Google 與 LINE 登入，並以聯集方式合併裝置進度。

## 執行與驗證

```powershell
npm.cmd test
npm.cmd start
```

開啟 `http://127.0.0.1:4175/`。核心課程不依賴框架或雲端服務；只有站方完成設定且使用者主動登入時，才會載入 Firebase SDK 進行同步。

正式站：[https://orsinobbb.github.io/sudoku-learning-studio/](https://orsinobbb.github.io/sudoku-learning-studio/)

Google／LINE 登入的供應商設定請依照 [`docs/auth-setup.md`](docs/auth-setup.md)。未填設定時登入按鈕會停用，訪客功能與本機紀錄不受影響。

## 設計原則

1. 先讓學生觀察，再提供足以繼續的最小提示。
2. 將「格子的唯一可能」與「數字的唯一位置」用不同語言解釋。
3. 出題、分析與教學共用同一套規則核心，避免答案與說明不一致。
4. 訪客學習紀錄只存在瀏覽器 `localStorage`；登入後才同步，且本機與雲端採不遺失進度的合併規則。
5. 「教材涵蓋」與「分析器可辨識」分開標示；搜尋驗證也不會被冒充成邏輯技巧。

## 教材分類來源

於 2026-08-22 交叉查證下列公開教材，再依先修關係重組為本站學習順序：

- [HoDoKu Solving Techniques](https://hodoku.sourceforge.net/en/techniques.php)：從 Singles、Intersections、Subsets、Fish、Wings、Coloring、Chains／Loops、ALS 到 Last Resort 的完整分類。
- [SudokuWiki Strategy Families](https://www.sudokuwiki.org/Strategy_Families)：依 Basic、Bent Sets、Chaining、Exotic、Uniqueness 等家族整理，並提醒難度排序帶有主觀性。
- [Conceptis Sudoku Techniques](https://www.conceptispuzzles.com/index.aspx?uri=puzzle/sudoku/techniques)：掃描、候選、顯性／隱性數對與 X-Wing 的入門說明。
