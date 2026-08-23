const PUZZLES = {
  basics: '004100003820500009003200008000072030697300000001680000759000006000030420002000017',
  hiddenSingle: '006805000500370000000042000024180050058600420000050300080000092000000608400000130',
  lockedPointing: '000000072600890000000100000000004000004057000010000900000600800002000004005000000',
  pairs: '090010070000002004003000100500070000001500060000003800100030008002004300070600090',
  xWing: '070500030006000100800002007009300600040008000700050004200070500050000010003900000',
  mixed: '080001090700400200003060008030000080000050004200006500060008000400700006009000010',
  hiddenTriple: '300900040600000720000045000068700090002000060504008200000013000000800010200000650',
  quadFish: '000000076000060900070904802080640000000000014000030200400000001720090000050702000',
  jellyfish: '300000000000006572000904000600007400000500000000300651000000020100070003906005000',
  hiddenQuad: '020500000801900000000017003300070000092300007680009000700203608000000000235000109'
};

const drill = (technique, difficulty, puzzleKey, prompt) => Object.freeze({
  id: `drill-${technique}`,
  lessonId: technique,
  technique,
  difficulty,
  puzzle: PUZZLES[puzzleKey],
  prompt
});

export const TECHNIQUE_DRILLS = Object.freeze([
  drill('fullHouse', 'easy', 'basics', '先掃描接近填滿的行、列、宮，找出缺少的最後一數。'),
  drill('nakedSingle', 'easy', 'basics', '逐格整理候選數，尋找只剩一個候選的空格。'),
  drill('hiddenSingle', 'medium', 'hiddenSingle', '固定追蹤一個數字，找它在某個單位唯一能落下的位置。'),
  drill('lockedPointing', 'hard', 'lockedPointing', '先看九宮；若某數只落在同一行或列，就向宮外排除。'),
  drill('lockedClaiming', 'hard', 'mixed', '先看行或列；若某數只落在同一宮，就在該宮內排除。'),
  drill('nakedPair', 'hard', 'pairs', '找出同一單位內兩格共享的兩個候選，再排除其他格。'),
  drill('hiddenPair', 'hard', 'pairs', '追蹤兩個數的落點；若都只存在同兩格，就精簡那兩格。'),
  drill('nakedTriple', 'hard', 'mixed', '找三格候選聯集恰為三個數的結構。'),
  drill('hiddenTriple', 'hard', 'hiddenTriple', '追蹤三個數，確認它們在單位內只分布於三格。'),
  drill('nakedQuad', 'hard', 'quadFish', '找四格候選聯集恰為四個數，再排除同單位其他候選。'),
  drill('hiddenQuad', 'hard', 'hiddenQuad', '追蹤四個數是否只存在同一單位的四格。'),
  drill('xWing', 'expert', 'xWing', '選一個數字，尋找兩條基底線落在相同兩條覆蓋線。'),
  drill('swordfish', 'expert', 'quadFish', '選一個數字，尋找三條基底線的候選聯集是否落在三條覆蓋線。'),
  drill('jellyfish', 'expert', 'jellyfish', '選一個數字，追蹤四條基底線是否鎖定四條覆蓋線。'),
  drill('xyWing', 'expert', 'mixed', '找一個雙候選樞紐與兩翼，確認三格形成 XY、XZ、YZ。')
]);

export const DRILL_BY_TECHNIQUE = new Map(TECHNIQUE_DRILLS.map((item) => [item.technique, item]));
