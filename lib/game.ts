export const GRID_SIZE = 5;
export const TOKENS = ['1C', '55', '7A', 'BD', 'E9', 'FF', 'A7', 'K2'] as const;

export type Coord = { row: number; col: number };
export type Target = { id: string; codes: string[]; reward: number };
export type Puzzle = {
  id: number;
  name: string;
  tier: string;
  grid: string[][];
  targets: Target[];
  bufferSize: number;
  timeLimit: number;
  solution: Coord[];
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

function makeRoute(rng: () => number, length: number): Coord[] {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const route: Coord[] = [{ row: 0, col: Math.floor(rng() * GRID_SIZE) }];
    while (route.length < length) {
      const last = route[route.length - 1];
      const chooseColumn = route.length % 2 === 1;
      const candidates: Coord[] = [];
      for (let i = 0; i < GRID_SIZE; i += 1) {
        const candidate = chooseColumn ? { row: i, col: last.col } : { row: last.row, col: i };
        if (!route.some((cell) => cell.row === candidate.row && cell.col === candidate.col)) candidates.push(candidate);
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

export function activeCells(selected: Coord[]): Coord[] {
  if (!selected.length) return Array.from({ length: GRID_SIZE }, (_, col) => ({ row: 0, col }));
  const last = selected[selected.length - 1];
  const chooseColumn = selected.length % 2 === 1;
  return Array.from({ length: GRID_SIZE }, (_, i) => chooseColumn ? { row: i, col: last.col } : { row: last.row, col: i })
    .filter((cell) => !selected.some((used) => used.row === cell.row && used.col === cell.col));
}

function targetSlices(routeCodes: string[], count: number): string[][] {
  if (count === 1) return [routeCodes.slice(0, Math.min(4, routeCodes.length))];
  if (count === 2) return [routeCodes.slice(0, 4), routeCodes.slice(3, 7)];
  return [routeCodes.slice(0, 4), routeCodes.slice(3, 7), routeCodes.slice(6, 9)];
}

export function generatePuzzle(level: number, endlessSeed?: number): Puzzle {
  const safeLevel = Math.max(1, Math.min(30, level));
  const tierIndex = Math.floor((safeLevel - 1) / 6);
  const seed = endlessSeed ?? safeLevel * 7919 + 417;
  const rng = mulberry32(seed);
  const targetCount = safeLevel <= 3 ? 1 : safeLevel <= 12 ? 2 : 3;
  const bufferSize = targetCount === 1 ? 6 : targetCount === 2 ? 7 : 9;
  const solution = makeRoute(rng, bufferSize);
  const grid = Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => pick(rng, [...TOKENS])));
  const routeCodes = solution.map((_, index) => pick(rng, [...TOKENS].slice(0, tierIndex > 2 ? 8 : 6)));
  solution.forEach((cell, index) => { grid[cell.row][cell.col] = routeCodes[index]; });
  const targets = targetSlices(routeCodes, targetCount).map((codes, index) => ({
    id: `R${String(index + 1).padStart(2, '0')}`,
    codes,
    reward: 120 + index * 80 + tierIndex * 40,
  }));
  const puzzle: Puzzle = {
    id: endlessSeed ? endlessSeed : safeLevel,
    name: endlessSeed ? `Fracture ${String(endlessSeed).slice(-4)}` : LEVEL_NAMES[safeLevel - 1],
    tier: endlessSeed ? 'ENDLESS FRACTURE' : TIERS[tierIndex],
    grid,
    targets,
    bufferSize,
    timeLimit: Math.max(17, 32 - tierIndex * 3 - Math.floor((safeLevel - 1) / 10)),
    solution,
  };
  if (!validatePuzzle(puzzle)) throw new Error('Generated puzzle failed validation');
  return puzzle;
}

export function solvePuzzle(puzzle: Puzzle, selected: Coord[] = [], buffer: string[] = []): Coord[] | null {
  const visit = (path: Coord[], codes: string[]): Coord[] | null => {
    if (completedTargets(codes, puzzle.targets).length === puzzle.targets.length) return path;
    if (path.length >= puzzle.bufferSize) return null;
    const candidates = activeCells(path);
    const needed = new Set(puzzle.targets.flatMap((target) => target.codes));
    const preferred = puzzle.solution[path.length];
    candidates.sort((a, b) => {
      const preferredA = preferred && a.row === preferred.row && a.col === preferred.col ? 1 : 0;
      const preferredB = preferred && b.row === preferred.row && b.col === preferred.col ? 1 : 0;
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
  if (puzzle.grid.length !== GRID_SIZE || puzzle.grid.some((row) => row.length !== GRID_SIZE)) return false;
  if (puzzle.solution.length > puzzle.bufferSize || puzzle.solution[0]?.row !== 0) return false;
  const legal = puzzle.solution.every((cell, index) => index === 0 || activeCells(puzzle.solution.slice(0, index)).some((candidate) => candidate.row === cell.row && candidate.col === cell.col));
  const codes = puzzle.solution.map((cell) => puzzle.grid[cell.row][cell.col]);
  return legal && puzzle.targets.every((target) => containsSequence(codes, target.codes)) && solvePuzzle(puzzle) !== null;
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
