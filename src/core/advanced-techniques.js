const ROWS = Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => row * 9 + col));
const COLS = Array.from({ length: 9 }, (_, col) => Array.from({ length: 9 }, (_, row) => row * 9 + col));
const BOXES = Array.from({ length: 9 }, (_, box) => {
  const startRow = Math.floor(box / 3) * 3;
  const startCol = (box % 3) * 3;
  return Array.from({ length: 9 }, (_, offset) => (startRow + Math.floor(offset / 3)) * 9 + startCol + offset % 3);
});
const UNITS = [...ROWS, ...COLS, ...BOXES];
const PEERS = Array.from({ length: 81 }, (_, index) => new Set(UNITS.filter((unit) => unit.includes(index)).flat().filter((cell) => cell !== index)));

export const ADVANCED_TECHNIQUE_ORDER = [
  'skyscraper', 'kite', 'emptyRectangle', 'xyzWing', 'wWing', 'simpleColoring', 'xChain',
  'xyChain', 'aic', 'finnedFish', 'als', 'sueDeCoq', 'uniqueRectangle', 'bugPlusOne', 'forcingChain'
];

const rowOf = (index) => Math.floor(index / 9);
const colOf = (index) => index % 9;
const boxOf = (index) => Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3);
const sees = (left, right) => PEERS[left].has(right);
const cellName = (index) => `第 ${rowOf(index) + 1} 列第 ${colOf(index) + 1} 格`;
const sameValues = (left, right) => left.length === right.length && left.every((value) => right.includes(value));
let activeTargetIndex = null;

function combinations(values, size, start = 0, chosen = [], output = []) {
  if (chosen.length === size) {
    output.push([...chosen]);
    return output;
  }
  for (let index = start; index <= values.length - (size - chosen.length); index += 1) {
    chosen.push(values[index]);
    combinations(values, size, index + 1, chosen, output);
    chosen.pop();
  }
  return output;
}

function commonPeers(cells, candidates, digit) {
  return candidates
    .map((values, index) => values.includes(digit) && !cells.includes(index) && cells.every((cell) => sees(index, cell)) ? index : -1)
    .filter((index) => index >= 0);
}

function elimination(strategy, targets, digit, related, explanation) {
  const eliminations = [...new Set(targets)].sort((a, b) => a - b).map((index) => ({ index, digit }));
  if (!eliminations.length || (activeTargetIndex != null && !eliminations.some(({ index }) => index === activeTargetIndex))) return null;
  return {
    kind: 'elimination', strategy, indices: eliminations.map(({ index }) => index), digit, eliminations,
    related: [...new Set(related)], explanation,
    actionKey: `elimination:${eliminations.map(({ index, digit: value }) => `${index}:${value}`).join('|')}`
  };
}

function eliminateMany(strategy, items, related, explanation) {
  const eliminations = [...new Map(items.map((item) => [`${item.index}:${item.digit}`, item])).values()]
    .sort((left, right) => left.index - right.index || left.digit - right.digit);
  if (!eliminations.length || (activeTargetIndex != null && !eliminations.some(({ index }) => index === activeTargetIndex))) return null;
  return {
    kind: 'elimination', strategy, indices: [...new Set(eliminations.map(({ index }) => index))], eliminations,
    related: [...new Set(related)], explanation,
    actionKey: `elimination:${eliminations.map(({ index, digit }) => `${index}:${digit}`).join('|')}`
  };
}

function placement(strategy, index, digit, related, explanation) {
  if (activeTargetIndex != null && index !== activeTargetIndex) return null;
  return { kind: 'placement', strategy, index, digit, related: [...new Set(related)], explanation, actionKey: `placement:${index}:${digit}` };
}

function strongLinks(candidates, digit) {
  const links = [];
  for (const unit of UNITS) {
    const cells = unit.filter((index) => candidates[index].includes(digit));
    if (cells.length === 2 && !links.some(([left, right]) => (left === cells[0] && right === cells[1]) || (left === cells[1] && right === cells[0]))) links.push(cells);
  }
  return links;
}

function findSkyscraper(candidates) {
  for (const [lines, cross] of [[ROWS, colOf], [COLS, rowOf]]) {
    for (let digit = 1; digit <= 9; digit += 1) {
      const links = lines.map((unit) => unit.filter((cell) => candidates[cell].includes(digit))).filter((cells) => cells.length === 2);
      for (const [first, second] of combinations(links, 2)) {
        for (const flipFirst of [false, true]) for (const flipSecond of [false, true]) {
          const baseA = first[flipFirst ? 1 : 0];
          const roofA = first[flipFirst ? 0 : 1];
          const baseB = second[flipSecond ? 1 : 0];
          const roofB = second[flipSecond ? 0 : 1];
          if (cross(baseA) !== cross(baseB) || cross(roofA) === cross(roofB)) continue;
          const targets = commonPeers([roofA, roofB], candidates, digit);
          const move = elimination('skyscraper', targets, digit, [baseA, roofA, baseB, roofB], `Skyscraper：兩條 ${digit} 的強連結以同一基準線相接，因此 ${cellName(roofA)}、${cellName(roofB)} 至少一格為真；同時看見兩個屋頂的格可排除 ${digit}。`);
          if (move) return move;
        }
      }
    }
  }
  return null;
}

function findKite(candidates) {
  for (let digit = 1; digit <= 9; digit += 1) {
    const rowLinks = ROWS.map((unit) => unit.filter((cell) => candidates[cell].includes(digit))).filter((cells) => cells.length === 2);
    const colLinks = COLS.map((unit) => unit.filter((cell) => candidates[cell].includes(digit))).filter((cells) => cells.length === 2);
    for (const rowLink of rowLinks) for (const colLink of colLinks) {
      for (const rowJoin of rowLink) for (const colJoin of colLink) {
        if (rowJoin === colJoin || boxOf(rowJoin) !== boxOf(colJoin)) continue;
        const rowEnd = rowLink.find((cell) => cell !== rowJoin);
        const colEnd = colLink.find((cell) => cell !== colJoin);
        const targets = commonPeers([rowEnd, colEnd], candidates, digit);
        const move = elimination('kite', targets, digit, [...rowLink, ...colLink], `2-String Kite：${digit} 的橫列與直行強連結在同一宮銜接，兩個外端至少一格為真；共同可見格可排除 ${digit}。`);
        if (move) return move;
      }
    }
  }
  return null;
}

function findEmptyRectangle(candidates) {
  for (let digit = 1; digit <= 9; digit += 1) for (const box of BOXES) {
    const cells = box.filter((cell) => candidates[cell].includes(digit));
    if (cells.length < 2) continue;
    for (const row of [...new Set(cells.map(rowOf))]) for (const col of [...new Set(cells.map(colOf))]) {
      const corner = row * 9 + col;
      const rowArm = cells.filter((cell) => rowOf(cell) === row && colOf(cell) !== col);
      const colArm = cells.filter((cell) => colOf(cell) === col && rowOf(cell) !== row);
      if (candidates[corner].includes(digit) || !rowArm.length || !colArm.length || cells.some((cell) => rowOf(cell) !== row && colOf(cell) !== col)) continue;
      for (const link of strongLinks(candidates, digit)) {
        for (const aligned of link) {
          const other = link.find((cell) => cell !== aligned);
          if (rowOf(aligned) === row && !box.includes(aligned)) {
            const target = rowOf(other) * 9 + col;
            if (candidates[target].includes(digit) && !box.includes(target)) {
              const move = elimination('emptyRectangle', [target], digit, [...cells, ...link], `Empty Rectangle：第 ${boxOf(cells[0]) + 1} 宮內的 ${digit} 只分布在交叉橫列與直行，交點為空；外部強連結迫使 ${cellName(target)} 不能為 ${digit}。`);
              if (move) return move;
            }
          }
          if (colOf(aligned) === col && !box.includes(aligned)) {
            const target = row * 9 + colOf(other);
            if (candidates[target].includes(digit) && !box.includes(target)) {
              const move = elimination('emptyRectangle', [target], digit, [...cells, ...link], `Empty Rectangle：第 ${boxOf(cells[0]) + 1} 宮內的 ${digit} 形成空矩形交叉，配合外部強連結後，${cellName(target)} 可排除 ${digit}。`);
              if (move) return move;
            }
          }
        }
      }
    }
  }
  return null;
}

function findXYZWing(candidates) {
  for (let pivot = 0; pivot < 81; pivot += 1) {
    if (candidates[pivot].length !== 3) continue;
    const wings = [...PEERS[pivot]].filter((cell) => candidates[cell].length === 2 && candidates[cell].every((digit) => candidates[pivot].includes(digit)));
    for (const [left, right] of combinations(wings, 2)) {
      const common = candidates[left].filter((digit) => candidates[right].includes(digit));
      if (common.length !== 1 || new Set([...candidates[left], ...candidates[right]]).size !== 3) continue;
      const digit = common[0];
      const targets = commonPeers([pivot, left, right], candidates, digit);
      const move = elimination('xyzWing', targets, digit, [pivot, left, right], `XYZ-Wing：樞紐 ${cellName(pivot)} 與兩翼共享 ${digit}；三格中至少一格必為 ${digit}，所以三者共同可見格可排除 ${digit}。`);
      if (move) return move;
    }
  }
  return null;
}

function findWWing(candidates) {
  const bivalue = candidates.map((values, index) => values.length === 2 ? index : -1).filter((index) => index >= 0);
  for (const [left, right] of combinations(bivalue, 2)) {
    if (!sameValues(candidates[left], candidates[right])) continue;
    for (const bridge of candidates[left]) {
      const other = candidates[left].find((digit) => digit !== bridge);
      for (const link of strongLinks(candidates, bridge)) {
        const connected = (sees(left, link[0]) && sees(right, link[1])) || (sees(left, link[1]) && sees(right, link[0]));
        if (!connected) continue;
        const targets = commonPeers([left, right], candidates, other);
        const move = elimination('wWing', targets, other, [left, right, ...link], `W-Wing：兩個 ${candidates[left].join('/')} 雙候選格透過 ${bridge} 的強連結相接，因此兩翼至少一格為 ${other}；共同可見格可排除 ${other}。`);
        if (move) return move;
      }
    }
  }
  return null;
}

function coloringComponents(candidates, digit) {
  const graph = new Map();
  for (const [left, right] of strongLinks(candidates, digit)) {
    if (!graph.has(left)) graph.set(left, new Set());
    if (!graph.has(right)) graph.set(right, new Set());
    graph.get(left).add(right);
    graph.get(right).add(left);
  }
  const components = [];
  const visited = new Set();
  for (const start of graph.keys()) {
    if (visited.has(start)) continue;
    const colors = new Map([[start, 0]]);
    const queue = [start];
    visited.add(start);
    while (queue.length) {
      const cell = queue.shift();
      for (const next of graph.get(cell) || []) {
        if (!colors.has(next)) colors.set(next, 1 - colors.get(cell));
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    if (colors.size >= 3) components.push(colors);
  }
  return components;
}

function findSimpleColoring(candidates) {
  for (let digit = 1; digit <= 9; digit += 1) for (const colors of coloringComponents(candidates, digit)) {
    const nodes = [...colors.keys()];
    for (const color of [0, 1]) {
      const group = nodes.filter((cell) => colors.get(cell) === color);
      if (group.some((cell, index) => group.slice(index + 1).some((other) => sees(cell, other)))) {
        return elimination('simpleColoring', group, digit, nodes, `簡單著色矛盾：同色的兩個 ${digit} 候選互相可見，因此這個顏色不可能為真，所有同色候選都可排除。`);
      }
    }
    const targets = candidates.map((values, index) => values.includes(digit) && !colors.has(index) && [0, 1].every((color) => nodes.some((cell) => colors.get(cell) === color && sees(index, cell))) ? index : -1).filter((index) => index >= 0);
    const move = elimination('simpleColoring', targets, digit, nodes, `簡單著色陷阱：目標格同時看見 ${digit} 鏈的兩種顏色；無論哪一色為真，該格都不能保留 ${digit}。`);
    if (move) return move;
  }
  return null;
}

function findXChain(candidates) {
  for (let digit = 1; digit <= 9; digit += 1) {
    const strong = strongLinks(candidates, digit);
    const strongMap = new Map();
    for (const [left, right] of strong) {
      if (!strongMap.has(left)) strongMap.set(left, new Set());
      if (!strongMap.has(right)) strongMap.set(right, new Set());
      strongMap.get(left).add(right);
      strongMap.get(right).add(left);
    }
    for (const start of strongMap.keys()) {
      const walk = (cell, expectStrong, path) => {
        if (path.length >= 4 && !expectStrong) {
          const targets = commonPeers([start, cell], candidates, digit).filter((target) => !path.includes(target));
          const move = elimination('xChain', targets, digit, path, `X-Chain：${digit} 的強、弱連結交替，兩端至少一端為真；同時看見兩端的格可排除 ${digit}。`);
          if (move) return move;
        }
        if (path.length >= 9) return null;
        const nextCells = expectStrong
          ? [...(strongMap.get(cell) || [])]
          : candidates.map((values, index) => values.includes(digit) && index !== cell && sees(cell, index) ? index : -1).filter((index) => index >= 0);
        for (const next of nextCells) {
          if (path.includes(next)) continue;
          const move = walk(next, !expectStrong, [...path, next]);
          if (move) return move;
        }
        return null;
      };
      const move = walk(start, true, [start]);
      if (move) return move;
    }
  }
  return null;
}

function findXYChain(candidates) {
  const bivalue = candidates.map((values, index) => values.length === 2 ? index : -1).filter((index) => index >= 0);
  for (const start of bivalue) for (const endDigit of candidates[start]) {
    const linkDigit = candidates[start].find((digit) => digit !== endDigit);
    const walk = (cell, required, path) => {
      if (path.length >= 3 && candidates[cell].includes(endDigit) && required === endDigit) {
        const targets = commonPeers([start, cell], candidates, endDigit).filter((target) => !path.includes(target));
        const move = elimination('xyChain', targets, endDigit, path, `XY-Chain：雙候選格依序承接候選，鏈首與鏈尾共同的 ${endDigit} 至少一端為真；共同可見格可排除 ${endDigit}。`);
        if (move) return move;
      }
      if (path.length >= 9) return null;
      for (const next of bivalue) {
        if (path.includes(next) || !sees(cell, next) || !candidates[next].includes(required)) continue;
        const outgoing = candidates[next].find((digit) => digit !== required);
        const move = walk(next, outgoing, [...path, next]);
        if (move) return move;
      }
      return null;
    };
    const move = walk(start, linkDigit, [start]);
    if (move) return move;
  }
  return null;
}

function findAIC(candidates) {
  const nodes = candidates.flatMap((values, cell) => values.map((digit) => ({ cell, digit, id: `${cell}:${digit}` })));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const strong = new Map();
  const addStrong = (left, right, type) => {
    if (!strong.has(left)) strong.set(left, []);
    if (!strong.has(right)) strong.set(right, []);
    strong.get(left).push({ id: right, type });
    strong.get(right).push({ id: left, type });
  };
  for (let cell = 0; cell < 81; cell += 1) if (candidates[cell].length === 2) addStrong(`${cell}:${candidates[cell][0]}`, `${cell}:${candidates[cell][1]}`, 'cell');
  for (let digit = 1; digit <= 9; digit += 1) for (const [left, right] of strongLinks(candidates, digit)) addStrong(`${left}:${digit}`, `${right}:${digit}`, 'unit');
  const weakNeighbors = (node) => nodes.filter((other) => other.id !== node.id && ((other.cell === node.cell && other.digit !== node.digit) || (other.digit === node.digit && sees(other.cell, node.cell))));
  for (const start of nodes) {
    const walk = (node, expectStrong, path, linkTypes) => {
      if (path.length >= 4 && !expectStrong && node.digit === start.digit && node.cell !== start.cell && linkTypes.includes('cell') && linkTypes.includes('unit')) {
        const pathCells = path.map((id) => byId.get(id).cell);
        const targets = commonPeers([start.cell, node.cell], candidates, start.digit).filter((cell) => !pathCells.includes(cell));
        const move = elimination('aic', targets, start.digit, pathCells, `AIC：候選節點沿強、弱連結交替，兩端的 ${start.digit} 至少一端為真；同時看見兩端的格可排除 ${start.digit}。`);
        if (move) return move;
      }
      if (path.length >= 9) return null;
      const nextEdges = expectStrong ? (strong.get(node.id) || []) : weakNeighbors(node).map((other) => ({ id: other.id, type: 'weak' }));
      for (const edge of nextEdges) {
        if (path.includes(edge.id)) continue;
        const move = walk(byId.get(edge.id), !expectStrong, [...path, edge.id], edge.type === 'weak' ? linkTypes : [...linkTypes, edge.type]);
        if (move) return move;
      }
      return null;
    };
    const move = walk(start, true, [start.id], []);
    if (move) return move;
  }
  return null;
}

function almostLockedSets(candidates) {
  const found = new Map();
  for (const unit of UNITS) {
    const cells = unit.filter((cell) => candidates[cell].length >= 2);
    for (let size = 1; size <= Math.min(4, cells.length); size += 1) for (const group of combinations(cells, size)) {
      const digits = [...new Set(group.flatMap((cell) => candidates[cell]))].sort((a, b) => a - b);
      if (digits.length !== size + 1) continue;
      const key = group.join(',');
      if (!found.has(key)) found.set(key, { cells: group, digits });
    }
  }
  return [...found.values()];
}

function findALS(candidates) {
  const sets = almostLockedSets(candidates);
  for (const [left, right] of combinations(sets, 2)) {
    if (left.cells.some((cell) => right.cells.includes(cell))) continue;
    const shared = left.digits.filter((digit) => right.digits.includes(digit));
    if (shared.length < 2) continue;
    for (const restricted of shared) {
      const leftX = left.cells.filter((cell) => candidates[cell].includes(restricted));
      const rightX = right.cells.filter((cell) => candidates[cell].includes(restricted));
      if (!leftX.length || !rightX.length || !leftX.every((a) => rightX.every((b) => sees(a, b)))) continue;
      for (const digit of shared.filter((value) => value !== restricted)) {
        const zCells = [...left.cells, ...right.cells].filter((cell) => candidates[cell].includes(digit));
        const targets = commonPeers(zCells, candidates, digit).filter((cell) => !left.cells.includes(cell) && !right.cells.includes(cell));
        const move = elimination('als', targets, digit, [...left.cells, ...right.cells], `ALS-XZ：兩組「n 格含 n+1 候選」集合以受限共同候選 ${restricted} 相連，因此共同候選 ${digit} 至少在一組成立；看見所有 ${digit} 落點的格可排除 ${digit}。`);
        if (move) return move;
      }
    }
  }
  return null;
}

function findSueDeCoq(candidates) {
  for (const [lines, label] of [[ROWS, '橫列'], [COLS, '直行']]) for (let lineIndex = 0; lineIndex < 9; lineIndex += 1) for (let boxIndex = 0; boxIndex < 9; boxIndex += 1) {
    const intersection = lines[lineIndex].filter((cell) => BOXES[boxIndex].includes(cell) && candidates[cell].length);
    if (intersection.length < 2) continue;
    for (const anchors of combinations(intersection, 2)) {
      const union = [...new Set(anchors.flatMap((cell) => candidates[cell]))];
      if (union.length !== 4) continue;
      const lineWings = lines[lineIndex].filter((cell) => !BOXES[boxIndex].includes(cell) && candidates[cell].length === 2 && candidates[cell].every((digit) => union.includes(digit)));
      const boxWings = BOXES[boxIndex].filter((cell) => !lines[lineIndex].includes(cell) && candidates[cell].length === 2 && candidates[cell].every((digit) => union.includes(digit)));
      for (const lineWing of lineWings) for (const boxWing of boxWings) {
        if (candidates[lineWing].some((digit) => candidates[boxWing].includes(digit)) || new Set([...candidates[lineWing], ...candidates[boxWing]]).size !== 4) continue;
        const items = [];
        for (const cell of lines[lineIndex]) if (!anchors.includes(cell) && cell !== lineWing) for (const digit of candidates[lineWing]) if (candidates[cell].includes(digit)) items.push({ index: cell, digit });
        for (const cell of BOXES[boxIndex]) if (!anchors.includes(cell) && cell !== boxWing) for (const digit of candidates[boxWing]) if (candidates[cell].includes(digit)) items.push({ index: cell, digit });
        const move = eliminateMany('sueDeCoq', items, [...anchors, lineWing, boxWing], `Sue de Coq：第 ${boxIndex + 1} 宮與第 ${lineIndex + 1} ${label}交界的四個候選，被行列側與宮側兩組互斥數字完整拆分；兩側其他格可排除各自鎖定的候選。`);
        if (move) return move;
      }
    }
  }
  return null;
}

function findFinnedFish(candidates) {
  for (const [bases, covers, baseLabel] of [[ROWS, COLS, '橫列'], [COLS, ROWS, '直行']]) for (let digit = 1; digit <= 9; digit += 1) {
    const positions = bases.map((unit) => unit.filter((cell) => candidates[cell].includes(digit)));
    for (let first = 0; first < 9; first += 1) {
      if (positions[first].length !== 2) continue;
      const coverIds = positions[first].map((cell) => bases === ROWS ? colOf(cell) : rowOf(cell));
      for (let second = 0; second < 9; second += 1) {
        if (second === first || positions[second].length < 3) continue;
        const body = positions[second].filter((cell) => coverIds.includes(bases === ROWS ? colOf(cell) : rowOf(cell)));
        const fins = positions[second].filter((cell) => !body.includes(cell));
        if (body.length !== 2 || !fins.length) continue;
        for (const coverId of coverIds) {
          const bodyCell = body.find((cell) => (bases === ROWS ? colOf(cell) : rowOf(cell)) === coverId);
          const relevantFins = fins.filter((cell) => boxOf(cell) === boxOf(bodyCell));
          if (!relevantFins.length || !fins.every((cell) => boxOf(cell) === boxOf(bodyCell))) continue;
          const targets = covers[coverId].filter((cell) => !bases[first].includes(cell) && !bases[second].includes(cell) && boxOf(cell) === boxOf(bodyCell) && candidates[cell].includes(digit));
          const move = elimination('finnedFish', targets, digit, [...positions[first], ...body, ...fins], `Finned X-Wing：兩個${baseLabel}形成基本魚形，額外的鰭都位於第 ${boxOf(bodyCell) + 1} 宮；該宮內對應覆蓋線上的格可排除 ${digit}。`);
          if (move) return move;
        }
      }
    }
  }
  return null;
}

function findUniqueRectangle(candidates, allowUniqueness) {
  if (!allowUniqueness) return null;
  for (const [rowA, rowB] of combinations([...Array(9).keys()], 2)) for (const [colA, colB] of combinations([...Array(9).keys()], 2)) {
    const corners = [rowA * 9 + colA, rowA * 9 + colB, rowB * 9 + colA, rowB * 9 + colB];
    if (new Set(corners.map(boxOf)).size !== 2) continue;
    for (const target of corners) {
      const fixed = corners.filter((cell) => cell !== target);
      if (!fixed.every((cell) => candidates[cell].length === 2) || !sameValues(candidates[fixed[0]], candidates[fixed[1]]) || !sameValues(candidates[fixed[0]], candidates[fixed[2]])) continue;
      const pair = candidates[fixed[0]];
      if (candidates[target].length <= 2 || !pair.every((digit) => candidates[target].includes(digit))) continue;
      return eliminateMany('uniqueRectangle', pair.map((digit) => ({ index: target, digit })), corners, `唯一矩形 Type 1：三個角只剩 ${pair.join('/')}，若第四角也保留這兩數會容許互換雙解；在題目已確認唯一解的前提下，${cellName(target)} 可排除 ${pair.join('、')}。`);
    }
  }
  return null;
}

function findBugPlusOne(candidates, allowUniqueness) {
  if (!allowUniqueness) return null;
  const open = candidates.map((values, index) => values.length ? index : -1).filter((index) => index >= 0);
  const targets = open.filter((cell) => candidates[cell].length === 3);
  if (targets.length !== 1 || open.some((cell) => cell !== targets[0] && candidates[cell].length !== 2)) return null;
  const target = targets[0];
  const units = [ROWS[rowOf(target)], COLS[colOf(target)], BOXES[boxOf(target)]];
  const digit = candidates[target].find((value) => units.every((unit) => unit.filter((cell) => candidates[cell].includes(value)).length % 2 === 1));
  if (!digit) return null;
  return placement('bugPlusOne', target, digit, open, `BUG+1：除 ${cellName(target)} 外所有未解格皆為雙候選；${digit} 是其行、列、宮中多出的候選。依唯一解前提，此格必須填 ${digit}。`);
}

function findForcingChain(candidates) {
  const pivots = candidates.map((values, index) => values.length === 2 ? index : -1).filter((index) => index >= 0);
  for (const pivot of pivots) {
    const [leftDigit, rightDigit] = candidates[pivot];
    const leftBranches = [...PEERS[pivot]].filter((cell) => candidates[cell].length === 2 && candidates[cell].includes(leftDigit));
    const rightBranches = [...PEERS[pivot]].filter((cell) => candidates[cell].length === 2 && candidates[cell].includes(rightDigit));
    for (const left of leftBranches) for (const right of rightBranches) {
      const consequence = candidates[left].find((digit) => digit !== leftDigit);
      if (!consequence || !candidates[right].includes(consequence) || candidates[right].find((digit) => digit !== consequence) !== rightDigit) continue;
      const targets = commonPeers([left, right], candidates, consequence).filter((cell) => cell !== pivot);
      const move = elimination('forcingChain', targets, consequence, [pivot, left, right], `強制鏈：若 ${cellName(pivot)} 為 ${leftDigit}，一側會迫使 ${cellName(left)} 為 ${consequence}；若為 ${rightDigit}，另一側會迫使 ${cellName(right)} 為 ${consequence}。兩分支共同使目標格排除 ${consequence}。`);
      if (move) return move;
    }
  }
  return null;
}

const DETECTORS = {
  skyscraper: findSkyscraper,
  kite: findKite,
  emptyRectangle: findEmptyRectangle,
  xyzWing: findXYZWing,
  wWing: findWWing,
  simpleColoring: findSimpleColoring,
  xChain: findXChain,
  xyChain: findXYChain,
  aic: findAIC,
  finnedFish: findFinnedFish,
  als: findALS,
  sueDeCoq: findSueDeCoq,
  uniqueRectangle: findUniqueRectangle,
  bugPlusOne: findBugPlusOne,
  forcingChain: findForcingChain
};

export function findAdvancedMoves(grid, candidateLists, { techniques = ADVANCED_TECHNIQUE_ORDER, limit = 1, allowUniqueness = false, excludedActions = [], targetIndex = null } = {}) {
  if (!Array.isArray(grid) || grid.length !== 81 || !Array.isArray(candidateLists) || candidateLists.length !== 81) throw new TypeError('進階分析需要 81 格盤面與候選陣列。');
  const candidates = candidateLists.map((values, index) => grid[index] ? [] : [...new Set(values)].sort((a, b) => a - b));
  const excluded = new Set(excludedActions);
  const moves = [];
  try {
    for (const technique of techniques) {
      const requestedTarget = Number.isInteger(targetIndex);
      const targets = requestedTarget ? [targetIndex] : [null];
      for (const target of targets) {
        activeTargetIndex = target;
        const move = DETECTORS[technique]?.(candidates, allowUniqueness);
        if (!move || excluded.has(move.actionKey) || moves.some((item) => item.actionKey === move.actionKey)) continue;
        moves.push(move);
        if (moves.length >= Math.max(1, limit)) return moves;
      }
      if (requestedTarget) continue;
      activeTargetIndex = null;
      const primary = DETECTORS[technique]?.(candidates, allowUniqueness);
      if (!primary || (!excluded.has(primary.actionKey) && moves.some((item) => item.actionKey === primary.actionKey) && moves.length >= Math.max(1, limit))) continue;
      for (let target = 0; target < 81; target += 1) {
        if (!candidates[target].length) continue;
        activeTargetIndex = target;
        const move = DETECTORS[technique]?.(candidates, allowUniqueness);
        if (!move || excluded.has(move.actionKey) || moves.some((item) => item.actionKey === move.actionKey)) continue;
        moves.push(move);
        if (moves.length >= Math.max(1, limit)) return moves;
      }
    }
  } finally {
    activeTargetIndex = null;
  }
  return moves;
}
