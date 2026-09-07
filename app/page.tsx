'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Award, BarChart3, BookOpen, Check, ChevronRight, CircleHelp, Clock3,
  Eye, Gauge, Home, Infinity as InfinityIcon, Lightbulb, LockKeyhole,
  Pause, Play, RefreshCw, RotateCcw, Settings, ShieldCheck, Sparkles, Target,
  Trophy, Volume2, X, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  activeCells, completedTargets, formatTime, generatePuzzle, scoreAttempt, solvePuzzle,
  TIERS, type Coord, type Puzzle,
} from '@/lib/game';

type Screen = 'home' | 'campaign' | 'play' | 'achievements' | 'stats' | 'guide' | 'settings';
type PlayMode = 'campaign' | 'endless';
type Result = {
  outcome: 'perfect' | 'partial' | 'failed';
  completed: number;
  total: number;
  score: number;
  shards: number;
  timeLeft: number;
  unused: number;
  usedHint: boolean;
  mode: PlayMode;
  level: number;
};
type SettingsData = { sound: boolean; reducedMotion: boolean; highContrast: boolean; colorblind: boolean; untimed: boolean; theme: 'cyan' | 'violet' | 'amber' };
type SaveData = {
  version: 1;
  unlockedLevel: number;
  levelShards: Record<string, number>;
  totalScore: number;
  achievements: string[];
  settings: SettingsData;
  stats: { attempts: number; wins: number; perfects: number; streak: number; bestStreak: number; hintlessWins: number; endlessBest: number; routines: number };
};

const DEFAULT_SAVE: SaveData = {
  version: 1, unlockedLevel: 1, levelShards: {}, totalScore: 0, achievements: [],
  settings: { sound: true, reducedMotion: false, highContrast: false, colorblind: false, untimed: false, theme: 'cyan' },
  stats: { attempts: 0, wins: 0, perfects: 0, streak: 0, bestStreak: 0, hintlessWins: 0, endlessBest: 0, routines: 0 },
};

const ACHIEVEMENTS = [
  { id: 'first', icon: Zap, name: 'Signal Acquired', text: 'Complete your first breach.' },
  { id: 'perfect', icon: ShieldCheck, name: 'Clean Entry', text: 'Complete your first perfect breach.' },
  { id: 'hintless5', icon: Eye, name: 'Natural Language', text: 'Win five breaches without a hint.' },
  { id: 'lastSecond', icon: Clock3, name: 'Zero Hour', text: 'Succeed with one second or less remaining.' },
  { id: 'overlap', icon: Sparkles, name: 'Compression', text: 'Complete overlapping routines in one buffer.' },
  { id: 'exact', icon: Target, name: 'No Wasted Motion', text: 'Win with a completely full buffer.' },
  { id: 'streak10', icon: Gauge, name: 'Unbroken Link', text: 'Reach a ten-breach success streak.' },
  { id: 'campaign', icon: Trophy, name: 'Root Authority', text: 'Complete all thirty campaign nodes.' },
  { id: 'endless10k', icon: InfinityIcon, name: 'Into the Noise', text: 'Score 3,000 points in an endless fracture.' },
  { id: 'lore', icon: BookOpen, name: 'Ghost in the Ledger', text: 'Reach the Autonomous Core.' },
];

function tone(enabled: boolean, frequency = 520, duration = 0.055) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.025, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration);
  } catch { /* Audio is optional. */ }
}

function sameCell(a: Coord, b: Coord) { return a.row === b.row && a.col === b.col; }

function Header({ screen, setScreen, save }: { screen: Screen; setScreen: (screen: Screen) => void; save: SaveData }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => setScreen('home')} aria-label="Cipherline home"><span className="brand-mark">C//</span><span>CIPHERLINE</span></button>
      <nav className="desktop-nav" aria-label="Main navigation">
        <button className={screen === 'campaign' ? 'active' : ''} onClick={() => setScreen('campaign')}>NODES</button>
        <button className={screen === 'achievements' ? 'active' : ''} onClick={() => setScreen('achievements')}>ACHIEVEMENTS</button>
        <button className={screen === 'stats' ? 'active' : ''} onClick={() => setScreen('stats')}>STATISTICS</button>
      </nav>
      <div className="top-actions">
        <span className="score-chip"><Zap size={13} /> {save.totalScore.toLocaleString()}</span>
        <button className="icon-button" onClick={() => setScreen('settings')} aria-label="Settings"><Settings size={18} /></button>
      </div>
    </header>
  );
}

function HomeScreen({ save, startCampaign, startEndless, setScreen }: { save: SaveData; startCampaign: (level: number) => void; startEndless: () => void; setScreen: (screen: Screen) => void }) {
  const totalShards = Object.values(save.levelShards).reduce((sum, value) => sum + value, 0);
  return (
    <section className="home-screen">
      <div className="home-copy">
        <p className="eyebrow"><span className="live-dot" /> SECURE CHANNEL ESTABLISHED</p>
        <h1>Route the signal.<br /><em>Break the system.</em></h1>
        <p className="lede">A tactical code-routing game about seeing the path before the clock starts. Choose a node, alternate axes, and compress every routine into one perfect buffer.</p>
        <div className="home-actions">
          <Button className="primary-cta" onClick={() => startCampaign(save.unlockedLevel)}><Play fill="currentColor" /> {save.unlockedLevel > 1 ? `CONTINUE // NODE ${String(save.unlockedLevel).padStart(2, '0')}` : 'BEGIN TRANSMISSION'} <ChevronRight /></Button>
          <Button className="secondary-cta" variant="outline" onClick={startEndless}><InfinityIcon /> ENDLESS FRACTURE</Button>
        </div>
        <button className="text-link" onClick={() => setScreen('guide')}><CircleHelp size={15} /> HOW TO ROUTE A SIGNAL</button>
      </div>
      <div className="home-visual" aria-label="Animated code route preview">
        <div className="visual-label"><span>LIVE ROUTE</span><small>NODE PREVIEW // 5×5</small></div>
        <div className="demo-grid">
          {['7A','E9','1C','BD','55','FF','55','7A','1C','E9','BD','1C','FF','55','7A','55','BD','E9','7A','1C','1C','7A','55','FF','BD'].map((code, index) => <span key={index} className={[2,7,9,19].includes(index) ? 'route' : ''}>{code}</span>)}
        </div>
        <div className="signal-line"><span style={{width: `${Math.max(6, (save.unlockedLevel / 30) * 100)}%`}} /></div>
        <div className="visual-stats"><div><small>NETWORK TIER</small><b>{TIERS[Math.floor((save.unlockedLevel - 1) / 6)]}</b></div><div><small>SIGNAL SHARDS</small><b>{totalShards} / 90</b></div></div>
      </div>
      <div className="home-footer"><span>30 HANDCRAFTED SYSTEMS</span><span>LOCAL PROGRESS // NO ACCOUNT</span><span>KEYBOARD + TOUCH READY</span></div>
    </section>
  );
}

function CampaignScreen({ save, startCampaign }: { save: SaveData; startCampaign: (level: number) => void }) {
  return (
    <section className="content-screen">
      <div className="section-heading"><div><p className="eyebrow">CAMPAIGN // NETWORK MAP</p><h1>Choose a node</h1></div><div className="heading-stat"><small>ACCESS</small><b>{save.unlockedLevel} / 30</b></div></div>
      <div className="tier-list">
        {TIERS.map((tier, tierIndex) => <section className="tier" key={tier}><div className="tier-heading"><span>0{tierIndex + 1}</span><h2>{tier}</h2><i /></div><div className="level-grid">
          {Array.from({ length: 6 }, (_, offset) => tierIndex * 6 + offset + 1).map((level) => {
            const unlocked = level <= save.unlockedLevel; const shards = save.levelShards[level] ?? 0; const puzzle = generatePuzzle(level);
            return <button key={level} className={`level-card ${unlocked ? '' : 'locked'} ${level === save.unlockedLevel ? 'current' : ''}`} disabled={!unlocked} onClick={() => startCampaign(level)}>
              <span className="level-number">{String(level).padStart(2, '0')}</span>{unlocked ? <><strong>{puzzle.name}</strong><small>{puzzle.targets.length} ROUTINE{puzzle.targets.length > 1 ? 'S' : ''} · {puzzle.timeLimit} SEC</small><span className="shards" aria-label={`${shards} of 3 shards`}>{[1,2,3].map((shard) => <i key={shard} className={shard <= shards ? 'earned' : ''} />)}</span></> : <><LockKeyhole size={18} /><small>ENCRYPTED</small></>}
            </button>;
          })}
        </div></section>)}
      </div>
    </section>
  );
}

function SequenceDisplay({ codes, buffer, completed }: { codes: string[]; buffer: string[]; completed: boolean }) {
  let matched = 0;
  for (let length = Math.min(codes.length, buffer.length); length > 0; length -= 1) {
    if (codes.slice(0, length).every((code, index) => buffer[buffer.length - length + index] === code)) { matched = length; break; }
  }
  return <div className="sequence-codes">{codes.map((code, index) => <b key={index} className={completed ? 'done' : index < matched ? 'matched' : ''}>{completed && index === codes.length - 1 ? <Check size={13} /> : code}</b>)}</div>;
}

function GameScreen({ puzzle, mode, level, settings, streak, onExit, onNextEndless, onResolved }: { puzzle: Puzzle; mode: PlayMode; level: number; settings: SettingsData; streak: number; onExit: () => void; onNextEndless: () => void; onResolved: (result: Result) => void }) {
  const [selected, setSelected] = useState<Coord[]>([]);
  const [buffer, setBuffer] = useState<string[]>([]);
  const [focus, setFocus] = useState<Coord>({ row: 0, col: 0 });
  const [timeLeft, setTimeLeft] = useState(puzzle.timeLimit);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [hintCell, setHintCell] = useState<Coord | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [visibilityPaused, setVisibilityPaused] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const completedIds = useMemo(() => completedTargets(buffer, puzzle.targets), [buffer, puzzle.targets]);
  const validCells = useMemo(() => activeCells(selected), [selected]);

  const reset = useCallback(() => {
    setSelected([]); setBuffer([]); setFocus({ row: 0, col: 0 }); setTimeLeft(puzzle.timeLimit); setStarted(false); setPaused(false); setResult(null); setHintCell(null); setUsedHint(false);
    setTimeout(() => boardRef.current?.focus(), 0);
  }, [puzzle.timeLimit]);

  useEffect(() => reset(), [puzzle.id, reset]);
  useEffect(() => {
    const handler = () => setVisibilityPaused(document.hidden);
    document.addEventListener('visibilitychange', handler); return () => document.removeEventListener('visibilitychange', handler);
  }, []);
  useEffect(() => {
    if (!started || paused || visibilityPaused || result || settings.untimed) return;
    const timer = window.setInterval(() => setTimeLeft((time) => Math.max(0, time - 0.1)), 100);
    return () => window.clearInterval(timer);
  }, [started, paused, visibilityPaused, result, settings.untimed]);

  const conclude = useCallback((nextBuffer: string[], remaining: number, hintWasUsed: boolean) => {
    const count = completedTargets(nextBuffer, puzzle.targets).length;
    const outcome = count === puzzle.targets.length ? 'perfect' : count > 0 ? 'partial' : 'failed';
    const unused = puzzle.bufferSize - nextBuffer.length;
    const score = scoreAttempt(count, puzzle.targets.length, remaining, unused, hintWasUsed, streak);
    const shards = outcome === 'perfect' ? (hintWasUsed ? 2 : remaining > puzzle.timeLimit * 0.25 || settings.untimed ? 3 : 2) : outcome === 'partial' ? 1 : 0;
    const finalResult: Result = { outcome, completed: count, total: puzzle.targets.length, score, shards, timeLeft: remaining, unused, usedHint: hintWasUsed, mode, level };
    setResult(finalResult); onResolved(finalResult); tone(settings.sound, outcome === 'failed' ? 130 : 880, 0.18);
  }, [level, mode, onResolved, puzzle, settings.sound, settings.untimed, streak]);

  useEffect(() => { if (started && timeLeft <= 0 && !result && !settings.untimed) conclude(buffer, 0, usedHint); }, [buffer, conclude, result, settings.untimed, started, timeLeft, usedHint]);

  const selectCell = useCallback((cell: Coord) => {
    if (paused || result || !validCells.some((valid) => sameCell(valid, cell))) return;
    const code = puzzle.grid[cell.row][cell.col]; const nextSelected = [...selected, cell]; const nextBuffer = [...buffer, code];
    if (!started) setStarted(true);
    setSelected(nextSelected); setBuffer(nextBuffer); setHintCell(null); tone(settings.sound, 480 + nextBuffer.length * 55);
    const done = completedTargets(nextBuffer, puzzle.targets).length;
    if (done === puzzle.targets.length || nextBuffer.length >= puzzle.bufferSize) conclude(nextBuffer, timeLeft, usedHint);
    else {
      const nextValid = activeCells(nextSelected); if (nextValid.length) setFocus(nextValid[0]);
    }
  }, [buffer, conclude, paused, puzzle, result, selected, settings.sound, started, timeLeft, usedHint, validCells]);

  const moveFocus = useCallback((direction: number) => {
    if (!validCells.length) return;
    const currentIndex = validCells.findIndex((cell) => sameCell(cell, focus));
    const nextIndex = (currentIndex < 0 ? 0 : currentIndex + direction + validCells.length) % validCells.length;
    setFocus(validCells[nextIndex]); tone(settings.sound, 250, 0.025);
  }, [focus, settings.sound, validCells]);

  const showHint = useCallback(() => {
    if (result) return; const solution = solvePuzzle(puzzle, selected, buffer);
    if (solution && solution[selected.length]) { setHintCell(solution[selected.length]); setFocus(solution[selected.length]); setUsedHint(true); tone(settings.sound, 760, 0.1); }
  }, [buffer, puzzle, result, selected, settings.sound]);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (key === 'escape') { event.preventDefault(); setPaused((value) => !value); return; }
    if (key === 'r') { event.preventDefault(); reset(); return; }
    if (key === 'h') { event.preventDefault(); showHint(); return; }
    const columnTurn = selected.length > 0 && selected.length % 2 === 1;
    if ((!columnTurn && ['arrowleft','a'].includes(key)) || (columnTurn && ['arrowup','w'].includes(key))) { event.preventDefault(); moveFocus(-1); }
    if ((!columnTurn && ['arrowright','d'].includes(key)) || (columnTurn && ['arrowdown','s'].includes(key))) { event.preventDefault(); moveFocus(1); }
    if (key === 'enter' || key === ' ') { event.preventDefault(); selectCell(focus); }
  }, [focus, moveFocus, reset, selectCell, selected.length, showHint]);

  const axisText = !selected.length ? 'SELECT FROM TOP ROW' : selected.length % 2 === 1 ? `COLUMN ${selected[selected.length - 1].col + 1} ACTIVE` : `ROW ${selected[selected.length - 1].row + 1} ACTIVE`;
  const tutorial = !selected.length ? 'Study the routines first. The clock starts when you select a code from the top row.' : selected.length === 1 ? 'Good. Your next code must come from the highlighted column.' : selected.length === 2 ? 'Now switch axis and choose from the highlighted row.' : 'Keep alternating row and column. Overlap routines to fit more into the buffer.';

  return (
    <section className={`game-view ${timeLeft <= puzzle.timeLimit * .25 && started ? 'timer-danger' : ''}`} onKeyDown={onKeyDown} ref={boardRef} tabIndex={-1}>
      <div className="game-head"><button className="back-button" onClick={onExit}><ArrowLeft size={16} /> EXIT</button><div><p className="eyebrow">{puzzle.tier} // {mode === 'campaign' ? String(level).padStart(2, '0') : '∞'}</p><h1>{puzzle.name}</h1></div><div className="timer"><span>{settings.untimed ? 'ACCESSIBILITY MODE' : started ? 'BREACH TIME' : 'STANDBY'}</span><strong>{settings.untimed ? '∞' : formatTime(timeLeft)}</strong><i><span style={{width: `${settings.untimed ? 100 : (timeLeft / puzzle.timeLimit) * 100}%`}} /></i></div></div>
      <div className="game-controls"><button onClick={() => setPaused(true)}><Pause size={14} /> PAUSE</button><button onClick={reset}><RotateCcw size={14} /> RESTART</button><button onClick={showHint}><Lightbulb size={14} /> HINT</button></div>
      <section className="workspace">
        <article className="matrix-panel">
          <div className="panel-label"><span>CODE MATRIX</span><em>{axisText}</em></div>
          <div className="matrix" role="grid" aria-label="Code matrix. Use arrow keys or WASD to move and Space to select.">
            {puzzle.grid.flatMap((row, rowIndex) => row.map((code, colIndex) => {
              const cell = { row: rowIndex, col: colIndex }; const valid = validCells.some((item) => sameCell(item, cell)); const chosenIndex = selected.findIndex((item) => sameCell(item, cell)); const focused = sameCell(focus, cell); const hinted = hintCell && sameCell(hintCell, cell);
              return <button role="gridcell" aria-label={`${code}, row ${rowIndex + 1}, column ${colIndex + 1}${valid ? ', selectable' : ''}`} aria-selected={chosenIndex >= 0} tabIndex={-1} onClick={() => selectCell(cell)} className={`cell ${valid ? 'valid' : ''} ${chosenIndex >= 0 ? 'chosen' : ''} ${focused ? 'focused' : ''} ${hinted ? 'hinted' : ''}`} key={`${rowIndex}-${colIndex}`}><span>{chosenIndex >= 0 ? String(chosenIndex + 1).padStart(2, '0') : code}</span>{chosenIndex >= 0 && <small>{code}</small>}</button>;
            }))}
          </div>
          <div className="tutorial-strip"><Lightbulb size={16} /><p>{level === 1 ? tutorial : axisText}</p><span>{selected.length % 2 === 1 ? 'W/S' : 'A/D'} · SPACE</span></div>
        </article>
        <aside className="side-panel">
          <div className="panel-label"><span>UPLOAD QUEUE</span><em>{completedIds.length} / {puzzle.targets.length} COMPLETE</em></div>
          <div className="targets-list">{puzzle.targets.map((target) => { const complete = completedIds.includes(target.id); return <div className={`target ${complete ? 'complete' : ''}`} key={target.id}><small>{target.id} // ROUTINE</small><SequenceDisplay codes={target.codes} buffer={buffer} completed={complete} /><span>{complete ? <><Check size={13} /> INJECTED</> : `+${target.reward}`}</span></div>; })}</div>
          <div className="buffer-title"><span>INPUT BUFFER</span><small>{buffer.length} / {puzzle.bufferSize}</small></div>
          <div className="buffer" aria-label={`Buffer contains ${buffer.join(', ') || 'no codes'}`}>{Array.from({ length: puzzle.bufferSize }, (_, index) => <i key={index} className={buffer[index] ? 'filled' : ''}>{buffer[index] ?? ''}</i>)}</div>
          <div className="objective"><span><Target size={15} /> OBJECTIVE</span><p>Inject as many routines as possible before the buffer or timer expires.</p></div>
        </aside>
      </section>
      <p className="sr-live" aria-live="polite">{buffer.length ? `Selected ${buffer[buffer.length - 1]}. ${axisText}` : 'Select a code from the top row.'}</p>

      {paused && !result && <div className="modal-backdrop"><div className="modal"><span className="modal-icon"><Pause /></span><p className="eyebrow">LINK SUSPENDED</p><h2>Signal paused</h2><p>The clock is frozen. Resume when your route is clear.</p><div className="modal-actions"><Button className="primary-cta" onClick={() => { setPaused(false); boardRef.current?.focus(); }}><Play /> RESUME</Button><Button variant="outline" className="secondary-cta" onClick={onExit}><Home /> EXIT NODE</Button></div></div></div>}
      {result && <div className="modal-backdrop"><div className={`modal result-modal ${result.outcome}`}><span className="modal-icon">{result.outcome === 'failed' ? <X /> : result.outcome === 'perfect' ? <Trophy /> : <Check />}</span><p className="eyebrow">{result.outcome === 'perfect' ? 'ALL ROUTINES INJECTED' : result.outcome === 'partial' ? 'PARTIAL UPLINK' : 'CONNECTION SEVERED'}</p><h2>{result.outcome === 'perfect' ? 'Perfect breach' : result.outcome === 'partial' ? 'Signal recovered' : 'Route rejected'}</h2><div className="result-score"><small>SCORE</small><strong>{result.score.toLocaleString()}</strong></div><div className="result-row"><span>ROUTINES <b>{result.completed}/{result.total}</b></span><span>TIME <b>{settings.untimed ? '∞' : `${result.timeLeft.toFixed(1)}s`}</b></span><span>SHARDS <b>{'◆'.repeat(result.shards)}{'◇'.repeat(3-result.shards)}</b></span></div><div className="modal-actions"><Button className="primary-cta" onClick={result.outcome !== 'failed' && mode === 'endless' ? onNextEndless : result.outcome !== 'failed' && mode === 'campaign' && level < 30 ? () => onExit() : reset}>{result.outcome !== 'failed' && mode === 'endless' ? <>NEXT FRACTURE <ChevronRight /></> : result.outcome !== 'failed' && mode === 'campaign' && level < 30 ? <>NODE MAP <ChevronRight /></> : <><RefreshCw /> TRY AGAIN</>}</Button><Button variant="outline" className="secondary-cta" onClick={onExit}><Home /> EXIT</Button></div></div></div>}
    </section>
  );
}

function AchievementsScreen({ save }: { save: SaveData }) {
  return <section className="content-screen"><div className="section-heading"><div><p className="eyebrow">OPERATOR RECORD // AWARDS</p><h1>Achievements</h1></div><div className="heading-stat"><small>UNLOCKED</small><b>{save.achievements.length} / {ACHIEVEMENTS.length}</b></div></div><div className="achievement-grid">{ACHIEVEMENTS.map(({ id, icon: Icon, name, text }) => { const earned = save.achievements.includes(id); return <article className={`achievement-card ${earned ? 'earned' : ''}`} key={id}><span><Icon /></span><div><small>{earned ? 'UNLOCKED' : 'ENCRYPTED'}</small><h2>{name}</h2><p>{text}</p></div>{earned ? <Check className="award-check" /> : <LockKeyhole className="award-check" />}</article>; })}</div></section>;
}

function StatsScreen({ save }: { save: SaveData }) {
  const totalShards = Object.values(save.levelShards).reduce((sum, value) => sum + value, 0); const winRate = save.stats.attempts ? Math.round((save.stats.wins / save.stats.attempts) * 100) : 0;
  const stats = [['TOTAL SCORE', save.totalScore.toLocaleString()], ['SUCCESS RATE', `${winRate}%`], ['PERFECT BREACHES', save.stats.perfects], ['ROUTINES INJECTED', save.stats.routines], ['BEST STREAK', save.stats.bestStreak], ['ENDLESS BEST', save.stats.endlessBest.toLocaleString()], ['SIGNAL SHARDS', `${totalShards} / 90`]];
  return <section className="content-screen"><div className="section-heading"><div><p className="eyebrow">OPERATOR RECORD // TELEMETRY</p><h1>Statistics</h1></div></div><div className="stats-grid">{stats.map(([label, value], index) => <article key={String(label)}><small>{String(index + 1).padStart(2, '0')} // {label}</small><strong>{value}</strong><i><span style={{width: `${Math.min(100, index === 0 ? save.totalScore / 200 : index === 1 ? winRate : 40 + index * 8)}%`}} /></i></article>)}</div><div className="record-strip"><Award /><div><small>ACTIVE STREAK</small><strong>{save.stats.streak} successful breach{save.stats.streak === 1 ? '' : 'es'}</strong></div><span>PERSONAL BEST // {save.stats.bestStreak}</span></div></section>;
}

function GuideScreen({ start }: { start: () => void }) {
  const steps = [
    ['01', 'Begin on the top row', 'Your first code can come from anywhere along the matrix’s top edge. Plan the whole route before selecting it.'],
    ['02', 'Follow the column', 'Your first selection activates its column. Move vertically and choose the next code from that line.'],
    ['03', 'Switch to the row', 'The second selection activates its row. Continue alternating column, row, column, row.'],
    ['04', 'Compress the routines', 'Target routines may overlap. One shared code can finish one routine and begin another, saving buffer space.'],
  ];
  return <section className="content-screen guide-screen"><div className="section-heading"><div><p className="eyebrow">FIELD MANUAL // ROUTING BASICS</p><h1>See the path first</h1></div></div><div className="guide-layout"><div className="guide-steps">{steps.map(([number,title,text]) => <article key={number}><span>{number}</span><div><h2>{title}</h2><p>{text}</p></div></article>)}</div><aside className="keys-panel"><p className="panel-label"><span>CONTROL SCHEME</span></p><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>MOVE FOCUS</span></div><div><kbd>↕</kbd><kbd>↔</kbd><span>ARROW KEYS</span></div><div><kbd className="wide">SPACE</kbd><span>SELECT CODE</span></div><div><kbd>H</kbd><span>TRACE HINT</span></div><div><kbd>R</kbd><span>RESTART NODE</span></div><Button className="primary-cta" onClick={start}><Play /> START TRAINING NODE</Button></aside></div></section>;
}

function SettingsScreen({ save, setSave }: { save: SaveData; setSave: React.Dispatch<React.SetStateAction<SaveData>> }) {
  const update = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => setSave((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  const options: [keyof Omit<SettingsData,'theme'>, string, string, typeof Volume2][] = [
    ['sound','Interface audio','Navigation, selection, success, and warning tones.',Volume2], ['reducedMotion','Reduced motion','Disable sweeps, pulses, and transition movement.',Sparkles], ['highContrast','High contrast','Increase text, tile, and border contrast.',Eye], ['colorblind','Alternate palette','Use blue and gold status colors with shape cues.',Target], ['untimed','Untimed mode','Freeze the breach clock. Speed rankings are disabled.',Clock3],
  ];
  const totalShards = Object.values(save.levelShards).reduce((sum, value) => sum + value, 0);
  return <section className="content-screen settings-screen"><div className="section-heading"><div><p className="eyebrow">SYSTEM // PREFERENCES</p><h1>Settings</h1></div></div><div className="settings-layout"><div className="setting-list">{options.map(([key,title,text,Icon]) => <label key={key}><span className="setting-icon"><Icon /></span><div><strong>{title}</strong><small>{text}</small></div><Switch checked={save.settings[key]} onCheckedChange={(checked) => update(key, checked)} aria-label={title} /></label>)}</div><aside className="theme-panel"><p className="panel-label"><span>INTERFACE THEME</span></p>{(['cyan','violet','amber'] as const).map((theme, index) => { const cost = [0,20,45][index]; const locked = totalShards < cost; return <button disabled={locked} onClick={() => update('theme',theme)} className={`${theme} ${save.settings.theme === theme ? 'selected' : ''}`} key={theme}><i /><span><strong>{theme === 'cyan' ? 'Chrome Yellow' : theme === 'violet' ? 'Overdrive Magenta' : 'Netrunner Cyan'}</strong><small>{locked ? `${cost} SHARDS REQUIRED` : save.settings.theme === theme ? 'ACTIVE' : 'AVAILABLE'}</small></span>{locked ? <LockKeyhole /> : save.settings.theme === theme ? <Check /> : null}</button>; })}<p>Earn signal shards from campaign nodes to unlock cosmetic interface frequencies.</p></aside></div></section>;
}

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>('home');
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [loaded, setLoaded] = useState(false);
  const [play, setPlay] = useState<{ mode: PlayMode; level: number; seed?: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem('cipherline-save-v1'); if (raw) setSave({ ...DEFAULT_SAVE, ...JSON.parse(raw), settings: { ...DEFAULT_SAVE.settings, ...JSON.parse(raw).settings }, stats: { ...DEFAULT_SAVE.stats, ...JSON.parse(raw).stats } }); } catch { localStorage.removeItem('cipherline-save-v1'); }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem('cipherline-save-v1', JSON.stringify(save)); }, [loaded, save]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 3500); return () => window.clearTimeout(timer); }, [notice]);

  const startCampaign = (level: number) => { setPlay({ mode: 'campaign', level }); setScreen('play'); };
  const startEndless = () => { setPlay({ mode: 'endless', level: Math.min(30, Math.max(13, save.unlockedLevel)), seed: Date.now() % 1_000_000_000 }); setScreen('play'); };
  const puzzle = useMemo(() => play ? generatePuzzle(play.level, play.seed) : null, [play]);

  const handleResult = useCallback((result: Result) => {
    setSave((current) => {
      const success = result.completed > 0; const perfect = result.completed === result.total; const streak = success ? current.stats.streak + 1 : 0;
      const stats = { ...current.stats, attempts: current.stats.attempts + 1, wins: current.stats.wins + (success ? 1 : 0), perfects: current.stats.perfects + (perfect ? 1 : 0), streak, bestStreak: Math.max(current.stats.bestStreak, streak), hintlessWins: current.stats.hintlessWins + (success && !result.usedHint ? 1 : 0), routines: current.stats.routines + result.completed, endlessBest: result.mode === 'endless' ? Math.max(current.stats.endlessBest, result.score) : current.stats.endlessBest };
      const levelShards = result.mode === 'campaign' ? { ...current.levelShards, [result.level]: Math.max(current.levelShards[result.level] ?? 0, result.shards) } : current.levelShards;
      const unlockedLevel = result.mode === 'campaign' && success ? Math.min(30, Math.max(current.unlockedLevel, result.level + 1)) : current.unlockedLevel;
      const candidates = [success && 'first', perfect && 'perfect', stats.hintlessWins >= 5 && 'hintless5', success && result.timeLeft <= 1 && !current.settings.untimed && 'lastSecond', perfect && result.total > 1 && 'overlap', success && result.unused === 0 && 'exact', streak >= 10 && 'streak10', result.mode === 'campaign' && result.level === 30 && perfect && 'campaign', result.mode === 'endless' && result.score >= 3000 && 'endless10k', unlockedLevel >= 25 && 'lore'].filter(Boolean) as string[];
      const newlyUnlocked = candidates.filter((id) => !current.achievements.includes(id)); if (newlyUnlocked.length) setNotice(`ACHIEVEMENT // ${ACHIEVEMENTS.find((item) => item.id === newlyUnlocked[0])?.name}`);
      return { ...current, unlockedLevel, levelShards, totalScore: current.totalScore + result.score, achievements: [...current.achievements, ...newlyUnlocked], stats };
    });
  }, []);

  const rootClass = `app-root theme-${save.settings.theme} ${save.settings.reducedMotion ? 'reduced-motion' : ''} ${save.settings.highContrast ? 'high-contrast' : ''} ${save.settings.colorblind ? 'colorblind' : ''}`;
  return <main className={rootClass}><div className="scanline" aria-hidden="true" /><Header screen={screen} setScreen={setScreen} save={save} />
    {screen === 'home' && <HomeScreen save={save} startCampaign={startCampaign} startEndless={startEndless} setScreen={setScreen} />}
    {screen === 'campaign' && <CampaignScreen save={save} startCampaign={startCampaign} />}
    {screen === 'play' && puzzle && play && <GameScreen puzzle={puzzle} mode={play.mode} level={play.level} settings={save.settings} streak={save.stats.streak} onResolved={handleResult} onNextEndless={() => setPlay({ mode: 'endless', level: Math.min(30, play.level + 1), seed: Date.now() % 1_000_000_000 })} onExit={() => { setPlay(null); setScreen(play.mode === 'campaign' ? 'campaign' : 'home'); }} />}
    {screen === 'achievements' && <AchievementsScreen save={save} />}
    {screen === 'stats' && <StatsScreen save={save} />}
    {screen === 'guide' && <GuideScreen start={() => startCampaign(1)} />}
    {screen === 'settings' && <SettingsScreen save={save} setSave={setSave} />}
    {notice && <div className="achievement-toast" role="status"><Award /><div><small>NEW RECORD</small><strong>{notice.replace('ACHIEVEMENT // ', '')}</strong></div></div>}
    <nav className="mobile-nav" aria-label="Mobile navigation"><button onClick={() => setScreen('home')}><Home />HOME</button><button onClick={() => setScreen('campaign')}><Target />NODES</button><button onClick={() => setScreen('achievements')}><Trophy />AWARDS</button><button onClick={() => setScreen('settings')}><Settings />SETTINGS</button></nav>
  </main>;
}
