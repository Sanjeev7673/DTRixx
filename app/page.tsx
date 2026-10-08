"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { applyMove, cloneCube, initialCube, invertMove, isSolved, progressPercent, scramble as makeScramble, type Cubie, type Sticker } from "../lib/cube";

const faces = ["U","D","L","R","F","B"] as const;
const modes = [
  { id: "daily", title: "Daily 5", sub: "A quick daily brain reset", limit: 300 },
  { id: "interview", title: "Interview 60", sub: "60 seconds. One challenge.", limit: 60 },
  { id: "practice", title: "Practice", sub: "Explore without pressure", limit: 0 }
];

function StickerPlane({ sticker }: { sticker: Sticker }) {
  const [x,y,z] = sticker.n;
  const transform =
    x === 1 ? "translateZ(27px) rotateY(90deg)" :
    x === -1 ? "translateZ(27px) rotateY(-90deg)" :
    y === 1 ? "translateZ(27px) rotateX(-90deg)" :
    y === -1 ? "translateZ(27px) rotateX(90deg)" :
    z === 1 ? "translateZ(27px)" : "translateZ(-27px) rotateY(180deg)";
  return <span className="sticker" style={{ background: sticker.color, transform }} />;
}

function CubeView({ cube }: { cube: Cubie[] }) {
  const drag = useRef<{x:number;y:number}|null>(null);
  const [rotation, setRotation] = useState({x:-24,y:-34});

  const down = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = {x:e.clientX,y:e.clientY};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = e.clientX-drag.current.x, dy = e.clientY-drag.current.y;
    drag.current = {x:e.clientX,y:e.clientY};
    setRotation(r => ({x:Math.max(-78,Math.min(78,r.x+dy*.55)),y:r.y+dx*.55}));
  };
  const up = () => { drag.current = null; };

  return <div className="cube-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
    <div className="cube" style={{transform:`rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`}}>
      {cube.map(c => <div key={c.id} className="cubie" style={{transform:`translate3d(${c.p[0]*58}px,${-c.p[1]*58}px,${c.p[2]*58}px)`}}>
        {c.stickers.map((s,i)=><StickerPlane key={i} sticker={s}/>)}
        <span className="cubie-core"/>
      </div>)}
    </div>
  </div>;
}

export default function Home() {
  const [cube,setCube] = useState<Cubie[]>(initialCube());
  const [history,setHistory] = useState<string[]>([]);
  const [future,setFuture] = useState<string[]>([]);
  const [scramble,setScramble] = useState<string[]>([]);
  const [mode,setMode] = useState("daily");
  const [started,setStarted] = useState<number|null>(null);
  const [elapsed,setElapsed] = useState(0);
  const [best,setBest] = useState(0);
  const [tab,setTab] = useState("Play");
  const [notice,setNotice] = useState("Scramble the cube, then solve it with direct controls or your keyboard.");
  const limit = modes.find(m=>m.id===mode)?.limit ?? 0;
  const solved = isSolved(cube);
  const progress = progressPercent(cube);
  const currentMoves = useMemo(()=>history.slice(-12),[history]);

  useEffect(()=>{setBest(Number(localStorage.getItem("cube-mind-best")||0));},[]);
  useEffect(()=>{
    if(!started) return;
    const id=window.setInterval(()=>{
      const sec=Math.floor((Date.now()-started)/1000);
      setElapsed(limit?Math.min(limit,sec):sec);
      if(limit && sec>=limit){setStarted(null);setNotice("Time is up. Reset or scramble for another attempt.");}
    },200);
    return()=>clearInterval(id);
  },[started,limit]);

  useEffect(()=>{
    if(solved && started){
      const sec=Math.floor((Date.now()-started)/1000);
      setElapsed(sec);setStarted(null);
      if(!best || sec<best){setBest(sec);localStorage.setItem("cube-mind-best",String(sec));}
      setNotice("Solved. Great attempt — your gameplay metrics are ready to review.");
    }
  },[solved,started,best]);

  const move = (m:string) => {
    if(!started && !solved && limit) setStarted(Date.now());
    setCube(c=>applyMove(c,m));
    setHistory(h=>[...h,m]);
    setFuture([]);
    setNotice(`Move ${m} recorded.`);
  };

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)return;
      const map:Record<string,string>={u:"U",d:"D",l:"L",r:"R",f:"F",b:"B"};
      const m=map[e.key.toLowerCase()];
      if(!m)return;
      e.preventDefault();
      move(e.shiftKey?m+"'":m);
    };
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  });

  const doScramble=()=>{
    const seq=makeScramble(mode==="interview"?18:20);
    setCube(c=>seq.reduce((v,m)=>applyMove(v,m),cloneCube(c)));
    setScramble(seq);setHistory([]);setFuture([]);setElapsed(0);setStarted(null);
    setNotice("Scrambled. The timer starts on your first move.");
  };
  const reset=()=>{
    setCube(initialCube());setScramble([]);setHistory([]);setFuture([]);setElapsed(0);setStarted(null);
    setNotice("Cube reset. Ready when you are.");
  };
  const undo=()=>{
    const m=history.at(-1);if(!m)return;
    setCube(c=>applyMove(c,invertMove(m)));setHistory(h=>h.slice(0,-1));setFuture(f=>[m,...f]);
  };
  const redo=()=>{
    const m=future[0];if(!m)return;
    setCube(c=>applyMove(c,m));setFuture(f=>f.slice(1));setHistory(h=>[...h,m]);
  };
  const startDaily=()=>{setMode("daily");reset();setTab("Play");};

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">C</span><div><b>CUBE MIND</b><small>Think. Solve. Grow.</small></div></div>
      <nav>{["Play","Learn","Leaderboard","Analytics"].map(n=><button className={tab===n?"nav active":"nav"} key={n} onClick={()=>setTab(n)}>{n}</button>)}</nav>
      <div className="avatar">SK</div>
    </header>

    {tab!=="Play" ? <section className="placeholder">
      <span className="eyebrow">{tab.toUpperCase()}</span>
      <h1>{tab==="Learn"?"Learn the thinking.":tab==="Leaderboard"?"Compete on the challenge.":"See how you are improving."}</h1>
      <p>{tab==="Learn"?"Notation, cube basics and algorithms will live here next.":"This area is reserved for the CUBE MIND progression system; the interactive game is already live on Play."}</p>
      <button className="big-button" onClick={()=>setTab("Play")}>← Back to Play</button>
    </section> : <>
      <section className="hero">
        <div><span className="eyebrow">INTERACTIVE CUBE CHALLENGE</span><h1>Small moves.<br/><em>Bigger mind.</em></h1><p>Think through the cube, make your moves, and watch your game performance improve over time.</p>
          <div className="modes">{modes.map(m=><button className={mode===m.id?"mode selected":"mode"} key={m.id} onClick={()=>{setMode(m.id);reset();}}><strong>{m.title}</strong><span>{m.sub}</span></button>)}</div>
        </div>
        <div className="stats"><div><span>BEST TIME</span><b>{best?`${best}s`:"—"}</b></div><div><span>ATTEMPT</span><b>{String(elapsed).padStart(2,"0")}s</b></div><div><span>MOVES</span><b>{history.length}</b></div></div>
      </section>

      <section className="game-grid">
        <div className="game-card">
          <div className="game-head"><div><span className="pill">3×3 LIVE CUBE</span><h2>{solved?"Challenge complete!":"Your cube is ready."}</h2></div><div className="timer">{limit?`${String(Math.max(0,limit-elapsed)).padStart(2,"0")}s`:`${String(elapsed).padStart(2,"0")}s`}<small>{limit?"remaining":"time"}</small></div></div>
          <CubeView cube={cube}/>
          <div className="cube-tip">↔ Drag to rotate the whole cube · U D L R F B keys · Shift + key = prime</div>
          <div className="controls"><button onClick={undo} disabled={!history.length}>↶ Undo</button><button onClick={redo} disabled={!future.length}>↷ Redo</button><button className="primary" onClick={doScramble}>Scramble</button><button onClick={reset}>Reset</button></div>
        </div>

        <aside className="side-card">
          <div className="progress-head"><span>CHALLENGE PROGRESS</span><b>{progress}%</b></div><div className="progress"><span style={{width:`${progress}%`}}/></div>
          <p className="notice">{notice}</p>
          <h3>Move the cube</h3>
          <div className="move-pad">{faces.map(f=><button key={f} onClick={()=>move(f)}>{f}</button>)}</div>
          <div className="move-pad prime">{faces.map(f=><button key={f+"p"} onClick={()=>move(f+"'")}>{f}&apos;</button>)}</div>
          <div className="quick"><button onClick={()=>move("R2")}>R2</button><button onClick={()=>move("U2")}>U2</button><button onClick={()=>move("F2")}>F2</button></div>
          <div className="scramble-box"><span>SCRAMBLE</span><p>{scramble.length?scramble.join(" "):"Press Scramble to generate a puzzle."}</p></div>
          <div className="history"><span>MOVE HISTORY</span><div>{currentMoves.length?currentMoves.map((m,i)=><b key={i}>{m}</b>):<i>No moves yet</i>}</div></div>
          {solved && <div className="success">✓ SOLVED · {history.length} moves · {elapsed}s</div>}
        </aside>
      </section>

      <section className="lower">
        <div className="feature"><span>DAILY 5</span><h3>Five focused minutes.</h3><p>A short structured cube session for a daily cognitive reset.</p><button onClick={startDaily}>Start Daily 5 →</button></div>
        <div className="feature"><span>HOW TO SOLVE</span><h3>Learn the thinking.</h3><p>Notation, layers and algorithms can become your next learning track.</p><button onClick={()=>setTab("Learn")}>Explore Learn →</button></div>
        <div className="feature"><span>PERFORMANCE</span><h3>Measure your progress.</h3><p>Time, moves, progress, reversals and improvement — from gameplay.</p><button onClick={()=>setTab("Analytics")}>View Analytics →</button></div>
      </section>
    </>}

    <footer><span>CUBE MIND</span><span>Gameplay indicators are not IQ or psychological scores.</span><span>Think. Solve. Grow.</span></footer>
  </main>;
}