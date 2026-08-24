export const TECHNIQUE_NAMES = {
  fullHouse: '末格／缺數',
  nakedSingle: '唯一候選數',
  hiddenSingle: '隱性單數',
  lockedPointing: '指向型區塊排除',
  lockedClaiming: '宣告型區塊排除',
  nakedPair: '顯性數對',
  hiddenPair: '隱性數對',
  nakedTriple: '顯性三數組',
  hiddenTriple: '隱性三數組',
  nakedQuad: '顯性四數組',
  hiddenQuad: '隱性四數組',
  xWing: 'X-Wing',
  xyWing: 'XY-Wing',
  swordfish: 'Swordfish',
  jellyfish: 'Jellyfish',
  skyscraper: 'Skyscraper',
  kite: '2-String Kite',
  emptyRectangle: 'Empty Rectangle',
  xyzWing: 'XYZ-Wing',
  wWing: 'W-Wing',
  simpleColoring: '簡單著色',
  xChain: 'X-Chain',
  xyChain: 'XY-Chain',
  aic: 'AIC 交替推理鏈',
  als: 'ALS／ALS-XZ',
  sueDeCoq: 'Sue de Coq',
  finnedFish: 'Finned／Sashimi Fish',
  uniqueRectangle: '唯一矩形',
  bugPlusOne: 'BUG+1',
  forcingChain: '強制鏈與強制網',
  search: '搜尋驗證（非邏輯技巧）'
};

export const JOURNEY_STAGES = [
  {
    id: 'foundation', number: '00', title: '盤面語言與觀察', level: '起步', difficulty: 'easy',
    description: '先建立行、列、宮、同儕與候選數的共同語言，之後每一步才說得清楚。',
    gate: '能正確寫出候選數，並用排除理由說明一個落點。',
    lessons: [
      { id: 'rules', name: '規則、單位與同儕', summary: '每個行、列、九宮都必須恰好包含 1–9。', cue: '先問：這格看見哪些已知數？' },
      { id: 'candidates', name: '候選數與筆記', summary: '候選數是仍符合三個單位限制的可能值。', cue: '候選數不是猜測，而是排除後的集合。' },
      { id: 'scanning', name: '掃描與交叉定位', summary: '固定一個數，跨行、列與宮追蹤它還能出現的位置。', cue: '一次只追一個數，降低視覺負擔。' },
      { id: 'fullHouse', name: '末格／缺數', analyzer: 'fullHouse', summary: '一個單位只剩一格時，填入缺少的數。', cue: '先看接近填滿的行、列、宮。' }
    ]
  },
  {
    id: 'singles', number: '01', title: '單數：最可靠的推進', level: '入門', difficulty: 'easy',
    description: '分清楚「格子只剩一個數」與「數字只剩一個家」，避免混用理由。',
    gate: '連續三題能在不猜的情況下指出單數類型。',
    lessons: [
      { id: 'nakedSingle', name: '唯一候選數', analyzer: 'nakedSingle', summary: '一格的候選集合只剩一個數。', cue: '看格子：這一格還剩什麼？' },
      { id: 'hiddenSingle', name: '隱性單數', analyzer: 'hiddenSingle', summary: '某數在一個單位中只剩一個落點。', cue: '看數字：它在這個單位還能住哪裡？' }
    ]
  },
  {
    id: 'intersections', number: '02', title: '交叉排除與子集', level: '進階', difficulty: 'hard',
    description: '從一格擴大到一組候選位置，利用「占位」關係批次排除。',
    gate: '能畫出錨點與被排除格，並說明排除不影響真正落點。',
    lessons: [
      { id: 'lockedPointing', name: '指向型區塊排除', analyzer: 'lockedPointing', summary: '宮內某數都在同一行或列，可排除該行列的宮外候選。', cue: '從宮往外看。' },
      { id: 'lockedClaiming', name: '宣告型區塊排除', analyzer: 'lockedClaiming', summary: '行列中某數都在同一宮，可排除該宮的行列外候選。', cue: '從行列往宮內看。' },
      { id: 'nakedPair', name: '顯性數對', analyzer: 'nakedPair', summary: '兩格合計只占兩個數，其他格不能再用。', cue: '先圈格，再看候選聯集。' },
      { id: 'hiddenPair', name: '隱性數對', analyzer: 'hiddenPair', summary: '兩個數只落在兩格，可刪除兩格中的其他候選。', cue: '先圈數，再找共同落點。' },
      { id: 'nakedTriple', name: '顯性三數組', analyzer: 'nakedTriple', summary: '三格的候選聯集恰為三個數。', cue: '格數等於候選聯集大小。' },
      { id: 'hiddenTriple', name: '隱性三數組', analyzer: 'hiddenTriple', summary: '三個數只分布在三格。', cue: '追蹤數字出現的位置集合。' },
      { id: 'nakedQuad', name: '顯性四數組', analyzer: 'nakedQuad', summary: '四格鎖定四個數，清除單位其他格。', cue: '候選很多時仍要檢查聯集。' },
      { id: 'hiddenQuad', name: '隱性四數組', analyzer: 'hiddenQuad', summary: '四個數只存在四格，可精簡這四格。', cue: '通常比顯性四數組更難看見。' }
    ]
  },
  {
    id: 'fish', number: '03', title: '單一數字的跨線圖形', level: '高階', difficulty: 'expert',
    description: '只追一個數，觀察它在多條行列中的強制落點。',
    gate: '能先標示基底線與覆蓋線，再做排除。',
    lessons: [
      { id: 'xWing', name: 'X-Wing', analyzer: 'xWing', summary: '兩條基底線的候選落在相同兩條覆蓋線。', cue: '2 條線 × 2 個位置。' },
      { id: 'swordfish', name: 'Swordfish', analyzer: 'swordfish', summary: '三條基底線的候選聯集落在三條覆蓋線。', cue: '不是每條都必須剛好兩個候選。' },
      { id: 'jellyfish', name: 'Jellyfish', analyzer: 'jellyfish', summary: '四條基底線鎖定四條覆蓋線。', cue: '先熟練 X-Wing 再擴張。' },
      { id: 'skyscraper', name: 'Skyscraper', analyzer: 'skyscraper', assessment: 'skyscraper', summary: '兩組強連結共享一端方向，另一端共同可見處可排除。', cue: '找同一數字的兩條雙候選線。' },
      { id: 'kite', name: '2-String Kite', analyzer: 'kite', assessment: 'kite', summary: '一個行強連結與一個列強連結透過同宮相接。', cue: '行、列各一條強連結。' },
      { id: 'emptyRectangle', name: 'Empty Rectangle', analyzer: 'emptyRectangle', assessment: 'emptyRectangle', summary: '利用宮內候選的特殊分布串接行列強連結。', cue: '先辨認宮內的 L 形候選。' }
    ]
  },
  {
    id: 'wingsChains', number: '04', title: '翼、著色與鏈', level: '專家', difficulty: 'expert',
    description: '把雙候選、強連結與弱連結串成可驗證的推理鏈。',
    gate: '每個鏈結都能標明「至少一真」或「不能同真」。',
    lessons: [
      { id: 'xyWing', name: 'XY-Wing', analyzer: 'xyWing', summary: '一個 XY 樞紐連接 XZ、YZ 兩翼，排除共同可見的 Z。', cue: '三格、三數、每格雙候選。' },
      { id: 'xyzWing', name: 'XYZ-Wing', analyzer: 'xyzWing', assessment: 'xyzWing', summary: 'XYZ 樞紐連接 XZ、YZ 兩翼，排除三格共同可見的 Z。', cue: '樞紐是三候選格。' },
      { id: 'wWing', name: 'W-Wing', analyzer: 'wWing', assessment: 'wWing', summary: '兩個相同雙候選格，透過其中一數的強連結排除另一數。', cue: '兩翼不必互相看見。' },
      { id: 'simpleColoring', name: '簡單著色', analyzer: 'simpleColoring', assessment: 'simpleColoring', summary: '沿同一數字的強連結交替著色，利用矛盾或陷阱排除。', cue: '全程只追一個數。' },
      { id: 'xChain', name: 'X-Chain', analyzer: 'xChain', assessment: 'xChain', summary: '同一數字的強弱連結交替構成推理。', cue: '先寫清楚每條連結類型。' },
      { id: 'xyChain', name: 'XY-Chain', analyzer: 'xyChain', assessment: 'xyChain', summary: '雙候選格串鏈，兩端共同可見處排除共同數。', cue: '每一格承接前一格的一個候選。' },
      { id: 'aic', name: 'AIC 交替推理鏈', analyzer: 'aic', assessment: 'aic', summary: '以強弱連結交替表達更一般的鏈與環。', cue: '翼、著色與多種鏈可統一到 AIC。' }
    ]
  },
  {
    id: 'expertSystems', number: '05', title: '高階結構與最後手段', level: '研究', difficulty: 'expert',
    description: '處理近鎖定集合、唯一性假設與分支推理；重點是清楚寫出假設邊界。',
    gate: '能區分純邏輯、唯一解假設與搜尋驗證。',
    lessons: [
      { id: 'als', name: 'ALS／ALS-XZ', analyzer: 'als', assessment: 'als', summary: 'n 格含 n+1 個候選，透過受限共同候選連接集合。', cue: '先辨認「差一個就鎖定」的集合。' },
      { id: 'sueDeCoq', name: 'Sue de Coq', analyzer: 'sueDeCoq', assessment: 'sueDeCoq', summary: '結合宮與行列交界的多個候選集合進行排除。', cue: '先拆成交界與兩側集合。' },
      { id: 'finnedFish', name: 'Finned／Sashimi Fish', analyzer: 'finnedFish', assessment: 'finnedFish', summary: '基本魚形多出鰭候選後，在受限制區域排除。', cue: '先確認對應的基本魚形。' },
      { id: 'uniqueRectangle', name: '唯一矩形', analyzer: 'uniqueRectangle', assessment: 'uniqueRectangle', summary: '利用題目唯一解假設避免形成雙解矩形。', cue: '這不是只靠數獨基本規則的推論。', caution: true },
      { id: 'bugPlusOne', name: 'BUG+1', analyzer: 'bugPlusOne', assessment: 'bugPlusOne', summary: '接近所有格皆雙候選時，以唯一性條件處理多出的候選。', cue: '必須先確認 BUG 結構。', caution: true },
      { id: 'forcingChain', name: '強制鏈與強制網', analyzer: 'forcingChain', assessment: 'forcingChain', summary: '分別檢查候選真假分支，找出所有分支共同結論。', cue: '保留分支證據，不把試填包裝成直覺。' },
      { id: 'search', name: '搜尋驗證與回溯', analyzer: 'search', assessment: 'search', summary: '當已實作邏輯不足時驗證解；它是求解保底，不是學習技巧。', cue: '分析報告會明確標示，不混入技巧統計。', caution: true }
    ]
  }
];

export const ALL_LESSONS = JOURNEY_STAGES.flatMap((stage) => stage.lessons.map((lesson) => ({ ...lesson, stageId: stage.id, stageTitle: stage.title })));
export const DETECTABLE_LESSONS = ALL_LESSONS.filter((lesson) => lesson.analyzer && lesson.analyzer !== 'search');
export const TARGETED_LESSONS = ALL_LESSONS.filter((lesson) => (lesson.analyzer && lesson.analyzer !== 'search') || lesson.assessment);
