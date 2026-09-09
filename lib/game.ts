export const GRID_SIZE = 5;
export const TOKENS = ['1C', '55', '7A', 'BD', 'E9', 'FF', 'A7', 'K2'] as const;

export type Coord = { row: number; col: number };
export type Target = { id: string; codes: string[]; reward: number };
export type Puzzle = {
  id: number;
  name: string;
  tier: string;
  size: number;
  grid: string[][];
  targets: Target[];
  bufferSize: number;
  timeLimit: number;
  solution: Coord[];
  blocked: Coord[];
  instantTrace: boolean;
  selectionCost: number;
  difficultyTags: string[];
};

const LEVEL_NAMES = [
  'Handshake', 'Open Channel', 'Soft Entry', 'Glass Lobby', 'Side Door', 'Ghost Port',
  'Quiet Relay', 'Packet Drift', 'False Credential', 'Mirror Cache', 'Dead Letter', 'Blue Room',
  'Cipher Rain', 'Watchtower', 'Cold Storage', 'Signal Vault', 'Null Authority', 'Blind Sector',
  'Midnight Switch', 'Red Ledger', 'Deep Transit', 'Black Archive', 'Silent Citadel', 'Zero Witness',
  'Machine Choir', 'Crown Process', 'Last Firewall', 'Dream Kernel', 'Sovereign Ghost', 'The Core',
];

export const TIERS = [
  'TRAINING NODES', 'COMMERCIAL SYSTEMS', 'SECURITY NETWORKS', 'BLACK-SITE INFRASTRUCTURE', 'AUTONOMOUS CORE',
];

const BUFFER_SIZES = [6, 8, 10, 11, 12];
const BASE_TIMES = [32, 28, 24, 20, 18];
const BLOCKED_COUNTS = [0, 0, 3, 7, 12];

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, values: T[]): T {
  return values[Math.floor(rng() * values.length)];
}

function sameCell(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

function makeRoute(rng: () => number, length: number, size: number): Coord[] {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const route: Coord[] = [{ row: 0, col: Math.floor(rng() * size) }];
    while (route.length < length) {
      const last = route[route.length - 1];
      const chooseColumn = route.length % 2 === 1;
      const candidates: Coord[] = [];
      for (let i = 0; i < size; i += 1) {
        const candidate = chooseColumn ? { row: i, col: last.col } : { row: last.row, col: i };
        if (!route.some((cell) => sameCell(cell, candidate))) candidates.push(candidate);
      }
      if (!candidates.length) break;
      route.push(pick(rng, candidates));
    }
    if (route.length === length) return route;
  }
  throw new Error('Unable to generate route');
}

export function containsSequence(buffer: string[], sequence: string[]): boolean {
  if (sequence.length > buffer.length) return false;
  return buffer.some((_, start) => sequence.every((code, offset) => buffer[start + offset] === code));
}

export function completedTargets(buffer: string[], targets: Target[]): string[] {
  return targets.filter((target) => containsSequence(buffer, target.codes)).map((target) => target.id);
}

export function activeCells(selected: Coord[], size = GRID_SIZE, blocked: Coord[] = []): Coord[] {
  const line = !selected.length
    ? Array.from({ length: size }, (_, col) => ({ row: 0, col }))
    : (() => {
        const last = selected[selected.length - 1];
        const chooseColumn = selected.length % 2 === 1;
        return Array.from({ length: size }, (_, i) => chooseColumn ? { row: i, col: last.col } : { row: last.row, col: i });
      })();
  return line.filter((cell) =>
    !selected.some((used) => sameCell(used, cell)) &&
    !blocked.some((locked) => sameCell(locked, cell)),
  );
}

function targetSlices(routeCodes: string[], count: number): string[][] {
  return Array.from({ length: count }, (_, index) => routeCodes.slice(index * 3, Math.min(index * 3 + 4, routeCodes.length)));
}

function makeBlockedCells(rng: () => number, size: number, count: number, solution: Coord[]): Coord[] {
  const candidates = Array.from({ length: size * size }, (_, index) => ({ row: Math.floor(index / size), col: index % size }))
    .filter((cell) => !solution.some((routeCell) => sameCell(routeCell, cell)));
  const blocked: Coord[] = [];
  while (blocked.length < count && candidates.length) {
    const index = Math.floor(rng() * candidates.length);
    blocked.push(candidates.splice(index, 1)[0]);
  }
  return blocked;
}

export function generatePuzzle(level: number, endlessSeed?: number): Puzzle {
  const safeLevel = Math.max(1, Math.min(30, level));
  const tierIndex = Math.floor((safeLevel - 1) / 6);
  const tierProgress = (safeLevel - 1) % 6;
  const seed = endlessSeed ?? safeLevel * 7919 + 417;
  const rng = mulberry32(seed);
  const size = GRID_SIZE + tierIndex;
  const targetCount = safeLevel <= 3 ? 1 : safeLevel <= 12 ? 2 : safeLevel <= 24 ? 3 : 4;
  const bufferSize = BUFFER_SIZES[tierIndex];
  const solution = makeRoute(rng, bufferSize, size);
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => pick(rng, [...TOKENS])));
  const routeCodes = solution.map(() => pick(rng, [...TOKENS].slice(0, tierIndex > 2 ? 8 : 6)));
  solution.forEach((cell, index) => { grid[cell.row][cell.col] = routeCodes[index]; });
  const targets = targetSlices(routeCodes, targetCount).map((codes, index) => ({
    id: `R${String(index + 1).padStart(2, '0')}`,
    codes,
    reward: 120 + index * 80 + tierIndex * 60,
  }));
  const blocked = makeBlockedCells(rng, size, BLOCKED_COUNTS[tierIndex], solution);
  const instantTrace = tierIndex >= 3;
  const selectionCost = tierIndex === 4 ? 0.6 : tierIndex === 3 ? 0.25 : 0;
  const timeLimit = BASE_TIMES[tierIndex] - tierProgress;
  const difficultyTags = [
    `${size}×${size} MATRIX`,
    `${targetCount} ROUTINE${targetCount === 1 ? '' : 'S'}`,
    ...(blocked.length ? [`${blocked.length} ICE LOCKS`] : []),
    ...(instantTrace ? ['LIVE TRACE'] : []),
    ...(selectionCost ? [`−${selectionCost.toFixed(2)}s / INPUT`] : []),
  ];
  const puzzle: Puzzle = {
    id: endlessSeed ?? safeLevel,
    name: endlessSeed ? `Fracture ${String(endlessSeed).slice(-4)}` : LEVEL_NAMES[safeLevel - 1],
    tier: endlessSeed ? 'ENDLESS FRACTURE' : TIERS[tierIndex],
    size,
    grid,
    targets,
    bufferSize,
    timeLimit,
    solution,
    blocked,
    instantTrace,
    selectionCost,
    difficultyTags,
  };
  if (!validatePuzzle(puzzle)) throw new Error('Generated puzzle failed validation');
  return puzzle;
}

export function solvePuzzle(puzzle: Puzzle, selected: Coord[] = [], buffer: string[] = []): Coord[] | null {
  let explored = 0;
  const visit = (path: Coord[], codes: string[]): Coord[] | null => {
    explored += 1;
    if (explored > 150_000) return null;
    if (completedTargets(codes, puzzle.targets).length === puzzle.targets.length) return path;
    if (path.length >= puzzle.bufferSize) return null;
    const candidates = activeCells(path, puzzle.size, puzzle.blocked);
    const needed = new Set(puzzle.targets.flatMap((target) => target.codes));
    const preferred = puzzle.solution[path.length];
    candidates.sort((a, b) => {
      const preferredA = preferred && sameCell(a, preferred) ? 1 : 0;
      const preferredB = preferred && sameCell(b, preferred) ? 1 : 0;
      return preferredB - preferredA || Number(needed.has(puzzle.grid[b.row][b.col])) - Number(needed.has(puzzle.grid[a.row][a.col]));
    });
    for (const cell of candidates) {
      const result = visit([...path, cell], [...codes, puzzle.grid[cell.row][cell.col]]);
      if (result) return result;
    }
    return null;
  };
  return visit([...selected], [...buffer]);
}

export function validatePuzzle(puzzle: Puzzle): boolean {
  if (puzzle.size < GRID_SIZE || puzzle.grid.length !== puzzle.size || puzzle.grid.some((row) => row.length !== puzzle.size)) return false;
  if (puzzle.solution.length > puzzle.bufferSize || puzzle.solution[0]?.row !== 0) return false;
  const blockedKeys = puzzle.blocked.map((cell) => `${cell.row}:${cell.col}`);
  if (new Set(blockedKeys).size !== blockedKeys.length) return false;
  if (puzzle.blocked.some((cell) => cell.row < 0 || cell.col < 0 || cell.row >= puzzle.size || cell.col >= puzzle.size || puzzle.solution.some((routeCell) => sameCell(routeCell, cell)))) return false;
  const legal = puzzle.solution.every((cell, index) => index === 0 || activeCells(puzzle.solution.slice(0, index), puzzle.size, puzzle.blocked).some((candidate) => sameCell(candidate, cell)));
  const codes = puzzle.solution.map((cell) => puzzle.grid[cell.row][cell.col]);
  return legal && puzzle.targets.every((target) => target.codes.length > 0 && containsSequence(codes, target.codes)) && solvePuzzle(puzzle) !== null;
}

export function scoreAttempt(completed: number, total: number, timeLeft: number, unusedSlots: number, usedHint: boolean, streak: number): number {
  if (!completed) return 0;
  const base = completed * 500;
  const perfect = completed === total ? 750 : 0;
  const speed = Math.round(Math.max(0, timeLeft) * 20);
  const efficiency = unusedSlots * 100;
  const streakBonus = Math.min(streak, 10) * 50;
  return Math.round((base + perfect + speed + efficiency + streakBonus) * (usedHint ? 0.75 : 1));
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `00:${safe.toFixed(1).padStart(4, '0')}`;
}
