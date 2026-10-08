"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAlgorithm,
  applyMove,
  cubeFacelets,
  initialCube,
  invertMove,
  isSolved,
  patterns,
  progressPercent,
  scramble as makeScramble,
  tokenizeMoves,
  validateFacelets,
  validateNotation,
  type Cubie,
} from "../lib/cube";

const Cube3D = dynamic(() => import("../components/Cube3D"), { ssr: false });

const SIZES = Array.from({ length: 14 }, (_, i) => i + 2);
const FACES = ["U", "R", "F", "D", "L", "B"] as const;
const PAINT_COLORS: Record<string, string> = {
  U: "#f8fafc",
  R: "#ff934d",
  F: "#36d399",
  D: "#ffd54a",
  L: "#ff5f73",
  B: "#5b8cff",
};

type Panel = "moves" | "solver" | "patterns" | "colors" | "learn" | "stats" | null;
type Mode = "simulator" | "challenge" | "solver";

export default function Home() {
  const [size, setSize] = useState(3);
  const [cube, setCube] = useState<Cubie[]>(() => initialCube(3));
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [scramble, setScramble] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("simulator");
  const [panel, setPanel] = useState<Panel>(null);
  const [sequence, setSequence] = useState("");
  const [message, setMessage] = useState("Ready");
  const [command, setCommand] = useState<{ id: number; move: string }>();
  const [commandId, setCommandId] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [solution, setSolution] = useState<string[]>([]);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [solving, setSolving] = useState(false);
  const [painted, setPainted] = useState<string[]>(() =>
    cubeFacelets(initialCube(3), 3).split("")
  );
  const [paintColor, setPaintColor] = useState("U");
  const autoRef = useRef<number | null>(null);

  const solved = isSolved(cube);
  const progress = progressPercent(cube);
  const recent = useMemo(() => history.slice(-24), [history]);
  const timeLabel = mode === "challenge"
    ? String(Math.max(0, 60 - elapsed)).padStart(2, "0") + "s"
    : elapsed + "s";

  useEffect(() => {
    const value = localStorage.getItem("cube-mind-best-" + size);
    setBest(value ? Number(value) : null);
  }, [size]);

  useEffect(() => {
    if (started === null) return;

    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setElapsed(seconds);

      if (mode === "challenge" && seconds >= 60) {
        setStarted(null);
        setMessage("Time up — review your attempt.");
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [started, mode]);

  useEffect(() => {
    if (!solved || history.length === 0 || started === null) return;

    const seconds = Math.floor((Date.now() - started) / 1000);
    setElapsed(seconds);
    setStarted(null);

    if (!best || seconds < best) {
      setBest(seconds);
      localStorage.setItem("cube-mind-best-" + size, String(seconds));
    }

    setMessage("Solved in " + seconds + "s");
  }, [solved, history.length, started, best, size]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (["u", "d", "l", "r", "f", "b"].includes(key)) {
        event.preventDefault();
        requestMove(event.key.toUpperCase() + (event.shiftKey ? "'" : ""));
      }

      if (event.key === " ") {
        event.preventDefault();
        scrambleCube();
      }

      if (event.ctrlKey && key === "z") {
        event.preventDefault();
        undo();
      }

      if (event.ctrlKey && key === "y") {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const commitMove = (move: string) => {
    if (mode === "challenge" && started === null && !solved) {
      setStarted(Date.now());
    }

    setCube((current) => applyMove(current, move, size));
    setHistory((current) => [...current, move]);
    setFuture([]);
    setMessage(move + " applied");
  };

  function requestMove(move: string) {
    if (!move) return;
    const nextId = commandId + 1;
    setCommandId(nextId);
    setCommand({ id: nextId, move });
  }

  function scrambleCube() {
    const length = size === 2 ? 10 : size === 3 ? 20 : Math.min(40, size * 5);
    const moves = makeScramble(length, size);

    setCube((current) => applyAlgorithm(current, moves.join(" "), size));
    setScramble(moves);
    setHistory([]);
    setFuture([]);
    setElapsed(0);
    setStarted(null);
    setSolution([]);
    setSolutionIndex(0);
    setMessage("Scrambled — your turn");
  }

  function resetCube() {
    setCube(initialCube(size));
    setHistory([]);
    setFuture([]);
    setScramble([]);
    setElapsed(0);
    setStarted(null);
    setSolution([]);
    setSolutionIndex(0);
    setMessage("Solved state");
  }

  function undo() {
    const move = history.at(-1);
    if (!move) return;

    setCube((current) => applyMove(current, invertMove(move), size));
    setHistory((current) => current.slice(0, -1));
    setFuture((current) => [move, ...current]);
    setMessage("Undo " + move);
  }

  function redo() {
    const move = future[0];
    if (!move) return;

    setCube((current) => applyMove(current, move, size));
    setFuture((current) => current.slice(1));
    setHistory((current) => [...current, move]);
    setMessage("Redo " + move);
  }

  function changeSize(nextSize: number) {
    setSize(nextSize);
    setCube(initialCube(nextSize));
    setHistory([]);
    setFuture([]);
    setScramble([]);
    setSolution([]);
    setSolutionIndex(0);
    setElapsed(0);
    setStarted(null);
    setMessage(nextSize + "×" + nextSize + " cube ready");
  }

  function playSequence() {
    const check = validateNotation(sequence);

    if (!check.valid) {
      setMessage("Invalid move: " + check.invalid.join(", "));
      return;
    }

    const moves = tokenizeMoves(sequence);

    moves.forEach((move, index) => {
      window.setTimeout(() => requestMove(move), index * 220);
    });

    setMessage(moves.length + " moves queued");
  }

  async function solveCurrent(faceletOverride?: string) {
    if (size !== 3) {
      setMessage("Built-in solver currently supports 3×3.");
      return;
    }

    const facelets = faceletOverride || cubeFacelets(cube, 3);

    if (!validateFacelets(facelets, 3)) {
      setMessage("Invalid cube colors. Check the six faces.");
      return;
    }

    try {
      setSolving(true);
      setMessage("Preparing 3×3 solver…");

      const module = await import("cubejs");
      const Cube = (module as any).default || module;
      Cube.initSolver();

      const solverCube = Cube.fromString(facelets);
      const algorithm = String(solverCube.solve() || "").trim();
      const moves = algorithm ? algorithm.split(/\s+/) : [];

      setSolution(moves);
      setSolutionIndex(0);
      setMessage(
        moves.length
          ? moves.length + " solution moves found"
          : "Cube is already solved"
      );
    } catch {
      setMessage("This cube state could not be solved.");
    } finally {
      setSolving(false);
    }
  }

  function stepSolution(direction: 1 | -1) {
    if (!solution.length) return;

    if (direction === 1) {
      if (solutionIndex >= solution.length) return;
      requestMove(solution[solutionIndex]);
      setSolutionIndex((value) => value + 1);
      return;
    }

    if (solutionIndex > 0) {
      const move = solution[solutionIndex - 1];
      setCube((current) => applyMove(current, invertMove(move), size));
      setHistory((current) => current.slice(0, -1));
      setSolutionIndex((value) => value - 1);
    }
  }

  function playAll() {
    if (!solution.length) return;

    if (autoRef.current !== null) {
      window.clearInterval(autoRef.current);
      autoRef.current = null;
      setMessage("Solution paused");
      return;
    }

    autoRef.current = window.setInterval(() => {
      setSolutionIndex((index) => {
        if (index >= solution.length) {
          if (autoRef.current !== null) {
            window.clearInterval(autoRef.current);
            autoRef.current = null;
          }
          return index;
        }

        requestMove(solution[index]);
        return index + 1;
      });
    }, 300);
  }

  function applyPattern(algorithm: string) {
    setCube((current) => applyAlgorithm(current, algorithm, size));
    setHistory(tokenizeMoves(algorithm));
    setFuture([]);
    setScramble([]);
    setSequence(algorithm);
    setMessage("Pattern applied");
  }

  function checkPainted() {
    const valid = validateFacelets(painted.join(""), 3);
    setMessage(valid ? "Valid 3×3 color counts" : "Each color must appear 9 times");
  }

  function resetPainted() {
    setPainted(cubeFacelets(initialCube(3), 3).split(""));
  }

  return (
    <main className="game-shell">
      <header className="game-top">
        <div className="game-brand">
          <span className="brand-cube">◆</span>
          <div>
            <b>CUBE MIND</b>
            <small>3D CUBE SIMULATOR</small>
          </div>
        </div>

        <div className="reference-size-menu">
          {SIZES.map((value) => (
            <button key={value} className={size === value ? "active" : ""} onClick={() => changeSize(value)}>
              {value}×{value}
            </button>
          ))}
        </div>

        <nav className="top-menu">
          <button
            className={mode === "simulator" ? "active" : ""}
            onClick={() => setMode("simulator")}
          >
            SIMULATOR
          </button>
          <button
            className={mode === "challenge" ? "active" : ""}
            onClick={() => setMode("challenge")}
          >
            CHALLENGE
          </button>
          <button
            className={mode === "solver" ? "active" : ""}
            onClick={() => {
              setMode("solver");
              setPanel("solver");
            }}
          >
            SOLVER
          </button>
        </nav>

        <div className="top-actions">
          <span className="live-dot">● LIVE</span>
          <button className="top-icon" onClick={() => setPanel("learn")}>?</button>
          <button className="top-icon" onClick={() => setPanel("stats")}>⚙</button>
          <select value={size} onChange={(e) => changeSize(Number(e.target.value))}>
            {SIZES.map((value) => (
              <option key={value} value={value}>
                {value}×{value}
              </option>
            ))}
          </select>
          <button className="avatar" onClick={() => setPanel("stats")}>
            SK
          </button>
        </div>
      </header>

      <section className="game-main">
        <aside className="left-rail">
          <div className="eyebrow">ONLINE CUBE LAB</div>
          <h1>
            Play the
            <br />
            <em>cube.</em>
          </h1>

          <p>
            Turn layers with your fingers, rotate the whole cube, type algorithms,
            scramble, learn patterns and replay solutions.
          </p>

          <div className="rail-actions">
            <button onClick={scrambleCube}>↻ SCRAMBLE</button>
            <button onClick={resetCube}>□ RESET</button>
          </div>

          <div className="rail-stats">
            <div>
              <b>{history.length}</b>
              <span>MOVES</span>
            </div>
            <div>
              <b>{progress}%</b>
              <span>STATE</span>
            </div>
            <div>
              <b>{best ? best + "s" : "—"}</b>
              <span>BEST</span>
            </div>
          </div>
        </aside>

        <section className="cube-stage">
          <div className="simulator-controls">
            <label>SPEED <input type="range" min="80" max="500" defaultValue="220" /></label>
            <button onClick={undo} disabled={!history.length}>↶</button>
            <button onClick={redo} disabled={!future.length}>↷</button>
          </div>
          <div className="stage-top">
            <span className="size-pill">{size}×{size}</span>
            <span className="status-pill">{solved ? "SOLVED" : "IN PLAY"}</span>
            <b>{timeLabel}</b>
          </div>

          <Cube3D
            cube={cube}
            size={size}
            onMove={commitMove}
            command={command}
          />

          <div className="reference-controls">
            <button onClick={() => setPanel("colors")}>COLOR PICKER</button>
            <button onClick={() => setPanel("solver")}>SOLVER</button>
            <button onClick={() => setPanel("patterns")}>PATTERNS</button>
            <button onClick={scrambleCube}>SCRAMBLE</button>
            <button onClick={resetCube}>RESET</button>
          </div>

          <div className="gesture-bar">
            <span>DRAG A FACE TO TURN</span>
            <i>→</i>
            <span>TURN LAYER</span>
            <i>•</i>
            <span>DRAG OUTSIDE</span>
            <i>→</i>
            <span>ROTATE</span>
            <i>•</i>
            <span>SCROLL</span>
            <i>→</i>
            <span>ZOOM</span>
          </div>
        </section>

        <aside className="right-rail simulator-side">
          <div className="rail-card">
            <div className="card-title">
              <span>MOVE LAYER</span>
              <button onClick={() => setPanel("moves")}>MOVES</button>
            </div>

            <div className="move-grid">
              {FACES.map((face) => (
                <button key={face} onClick={() => requestMove(face)}>
                  {face}
                </button>
              ))}
            </div>

            <div className="move-grid secondary">
              {FACES.map((face) => (
                <button key={face + "-prime"} onClick={() => requestMove(face + "'")}>
                  {face}'
                </button>
              ))}
            </div>

            <div className="move-row">
              {["U2", "R2", "F2", "D2"].map((move) => (
                <button key={move} onClick={() => requestMove(move)}>
                  {move}
                </button>
              ))}
            </div>
          </div>

          <div className="rail-card compact">
            <div className="card-title">
              <span>SCRAMBLE</span>
              <button onClick={scrambleCube}>NEW</button>
            </div>
            <code>
              {scramble.length
                ? scramble.join(" ")
                : "Press NEW to generate a scramble"}
            </code>
          </div>

          <div className="rail-card compact">
            <div className="card-title">
              <span>RECENT</span>
              <button onClick={() => setHistory([])}>CLEAR</button>
            </div>
            <div className="history">
              {recent.length
                ? recent.map((move, index) => <b key={index}>{move}</b>)
                : <span>—</span>}
            </div>
          </div>

          <div className="rail-card tool-list">
            <button onClick={() => setPanel("solver")}>
              <span>◎</span>
              <div>
                <b>SOLVER</b>
                <small>Find + play solution</small>
              </div>
              <i>→</i>
            </button>

            <button onClick={() => setPanel("patterns")}>
              <span>✦</span>
              <div>
                <b>PATTERNS</b>
                <small>Algorithms & effects</small>
              </div>
              <i>→</i>
            </button>

            <button onClick={() => setPanel("colors")}>
              <span>◈</span>
              <div>
                <b>COLOR PICKER</b>
                <small>Enter a physical cube</small>
              </div>
              <i>→</i>
            </button>

            <button onClick={() => setPanel("learn")}>
              <span>?</span>
              <div>
                <b>LEARN</b>
                <small>Notation & solving basics</small>
              </div>
              <i>→</i>
            </button>
          </div>
        </aside>
      </section>

      <footer className="game-bottom">
        <div className="bottom-message">
          <span className="pulse" />
          {message}
        </div>

        <div className="bottom-links">
          <button onClick={() => setPanel("learn")}>HOW TO PLAY</button>
          <button onClick={() => setPanel("moves")}>NOTATION</button>
          <button onClick={() => setPanel("solver")}>SOLVER</button>
        </div>

        <div className="bottom-progress">
          <span style={{ width: progress + "%" }} />
        </div>
        <b>{progress}%</b>
      </footer>

      {panel && (
        <div className="game-overlay" onClick={() => setPanel(null)}>
          <div className="overlay-card wide" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setPanel(null)}>×</button>

            {panel === "moves" && (
              <div className="overlay-content">
                <span className="eyebrow">MOVE ENGINE</span>
                <h2>Type any algorithm.</h2>
                <p>
                  Supports U D L R F B, prime turns, half turns, wide turns and
                  deeper layers such as 2F and 3Rw2.
                </p>

                <div className="sequence-box">
                  <input
                    value={sequence}
                    onChange={(e) => setSequence(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") playSequence();
                    }}
                    placeholder="F R2 U' L F2"
                  />
                  <button onClick={playSequence}>PLAY</button>
                </div>

                <div className="notation-grid">
                  {[
                    "U U' U2",
                    "R R' R2",
                    "F F' F2",
                    "D D' D2",
                    "L L' L2",
                    "B B' B2",
                    "Rw Rw' Rw2",
                    "2F 2F' 2F2",
                  ].map((item) => (
                    <b key={item}>{item}</b>
                  ))}
                </div>

                <div className="keyboard-note">
                  Keyboard: U D L R F B · Shift = prime · Space = scramble ·
                  Ctrl+Z / Ctrl+Y = undo / redo
                </div>
              </div>
            )}

            {panel === "solver" && (
              <div className="overlay-content">
                <span className="eyebrow">3×3 SOLVER</span>
                <h2>Find and play a solution.</h2>
                <p>
                  The 3×3 solver uses cubejs and its two-phase solving algorithm.
                  It accepts the current cube or a manually painted cube.
                </p>

                <div className="solver-actions">
                  <button
                    className="primary-wide"
                    disabled={solving || size !== 3}
                    onClick={() => solveCurrent()}
                  >
                    {solving ? "PREPARING…" : "SOLVE CURRENT CUBE"}
                  </button>

                  <button onClick={() => {
                    setSolution([]);
                    setSolutionIndex(0);
                  }}>
                    CLEAR
                  </button>
                </div>

                {solution.length > 0 && (
                  <div className="solution-panel">
                    <div className="solution-head">
                      <b>{solution.length} MOVES</b>
                      <span>{solutionIndex}/{solution.length}</span>
                    </div>

                    <div className="solution-moves">
                      {solution.map((move, index) => (
                        <button
                          key={index}
                          className={
                            index < solutionIndex
                              ? "done"
                              : index === solutionIndex
                              ? "current"
                              : ""
                          }
                          onClick={() => {
                            if (index === solutionIndex) stepSolution(1);
                          }}
                        >
                          {move}
                        </button>
                      ))}
                    </div>

                    <div className="solution-controls">
                      <button onClick={() => stepSolution(-1)}>← PREV</button>
                      <button className="primary-wide" onClick={() => stepSolution(1)}>
                        NEXT →
                      </button>
                      <button onClick={playAll}>
                        {autoRef.current !== null ? "PAUSE" : "PLAY ALL"}
                      </button>
                    </div>
                  </div>
                )}

                {size !== 3 && (
                  <div className="notice">
                    NxN simulation works across 2×2–15×15. Solver playback is
                    enabled for 3×3 first.
                  </div>
                )}
              </div>
            )}

            {panel === "patterns" && (
              <div className="overlay-content">
                <span className="eyebrow">PATTERN LAB</span>
                <h2>Make the cube look different.</h2>
                <p>Apply a pattern and inspect its algorithm.</p>

                <div className="pattern-grid">
                  {patterns.map((pattern) => (
                    <button
                      key={pattern.name}
                      onClick={() => applyPattern(pattern.algorithm)}
                    >
                      <strong>{pattern.name}</strong>
                      <code>{pattern.algorithm}</code>
                      <span>APPLY →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {panel === "colors" && (
              <div className="overlay-content">
                <span className="eyebrow">COLOR PICKER</span>
                <h2>Enter the cube in your hand.</h2>
                <p>
                  Paint the 54 stickers, validate the counts, then send the state
                  to the 3×3 solver.
                </p>

                <div className="color-palette">
                  {FACES.map((face) => (
                    <button
                      key={face}
                      className={paintColor === face ? "selected" : ""}
                      onClick={() => setPaintColor(face)}
                    >
                      {face}
                    </button>
                  ))}
                </div>

                <div className="sticker-net">
                  {FACES.map((face, faceIndex) => (
                    <div className={"net-face face-" + face} key={face}>
                      <span>{face}</span>
                      {Array.from({ length: 9 }, (_, index) => {
                        const stickerIndex = faceIndex * 9 + index;
                        return (
                          <button
                            key={stickerIndex}
                            style={{
                              backgroundColor:
                                PAINT_COLORS[painted[stickerIndex]] || "#171a27",
                            }}
                            onClick={() => {
                              setPainted((current) =>
                                current.map((value, position) =>
                                  position === stickerIndex ? paintColor : value
                                )
                              );
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="solver-actions">
                  <button onClick={checkPainted}>CHECK</button>
                  <button
                    className="primary-wide"
                    onClick={() => solveCurrent(painted.join(""))}
                  >
                    SOLVE PAINTED CUBE
                  </button>
                  <button onClick={resetPainted}>RESET COLORS</button>
                </div>
              </div>
            )}

            {panel === "learn" && (
              <div className="overlay-content">
                <span className="eyebrow">LEARN MODE</span>
                <h2>Everything starts with notation.</h2>

                <div className="learn-grid">
                  <div>
                    <b>01 · HOLD</b>
                    <p>
                      Keep the cube facing you consistently. F = front, B = back,
                      U = up, D = down, L = left, R = right.
                    </p>
                  </div>
                  <div>
                    <b>02 · TURN</b>
                    <p>
                      A letter is a quarter turn. Apostrophe means counter-clockwise.
                      2 means a half turn.
                    </p>
                  </div>
                  <div>
                    <b>03 · PLAY</b>
                    <p>
                      Swipe a face to turn its layer. Drag outside the cube to
                      orbit. Scroll or pinch to zoom.
                    </p>
                  </div>
                  <div>
                    <b>04 · PRACTICE</b>
                    <p>
                      Scramble, solve, undo mistakes and replay the solution one
                      move at a time.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {panel === "stats" && (
              <div className="overlay-content">
                <span className="eyebrow">SESSION</span>
                <h2>Your cube session.</h2>

                <div className="big-stats">
                  <div>
                    <b>{elapsed}s</b>
                    <span>TIME</span>
                  </div>
                  <div>
                    <b>{history.length}</b>
                    <span>MOVES</span>
                  </div>
                  <div>
                    <b>{progress}%</b>
                    <span>STATE</span>
                  </div>
                  <div>
                    <b>{best ? best + "s" : "—"}</b>
                    <span>PERSONAL BEST</span>
                  </div>
                </div>

                <div className="stat-note">
                  Gameplay metrics are derived from cube interaction. They are not
                  IQ or psychological scores.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
