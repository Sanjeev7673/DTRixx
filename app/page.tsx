"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { applyMove, cloneCube, initialCube, invertMove, isSolved, progressPercent, scramble as makeScramble, type Cubie } from "../lib/cube";

const Cube3D = dynamic(() => import("../components/Cube3D"), { ssr:false, loading:()=> <div className="cube-loading">Loading 3D cube…</div> });
const faces=["U","R","F","D","L","B"] as const;
const modes=[{id:"daily",name:"Daily 5",time:300},{id:"interview",name:"Interview 60",time:60},{id:"practice",name:"Free Play",time:0}];

export default function Home(){
  const [cube,setCube]=useState<Cubie[]>(initialCube());
  const [history,setHistory]=useState<string[]>([]);
  const [future,setFuture]=useState<string[]>([]);
  const [scramble,setScramble]=useState<string[]>([]);
  const [mode,setMode]=useState("daily");
  const [elapsed,setElapsed]=useState(0);
  const [started,setStarted]=useState<number|null>(null);
  const [best,setBest]=useState(0);
  const [menu,setMenu]=useState<"moves"|"learn"|"stats"|null>(null);
  const limit=modes.find(m=>m.id===mode)?.time??0;
  const solved=isSolved(cube);
  const progress=progressPercent(cube);
  const remaining=limit?Math.max(0,limit-elapsed):elapsed;

  useEffect(()=>{setBest(Number(localStorage.getItem("cube-mind-best")||0));},[]);
  useEffect(()=>{
    if(!started)return;
    const id=window.setInterval(()=>{
      const seconds=Math.floor((Date.now()-started)/1000);
      setElapsed(limit?Math.min(limit,seconds):seconds);
      if(limit && seconds>=limit)setStarted(null);
    },100);
    return()=>clearInterval(id);
  },[started,limit]);

  const commitMove=(move:string)=>{
    if(limit && !started && !solved)setStarted(Date.now());
    setCube(c=>applyMove(c,move));
    setHistory(h=>[...h,move]);
    setFuture([]);
  };

  const requestMove=(move:string)=>{
    if(limit && !started && !solved)setStarted(Date.now());
    // Cube3D animates the move first and calls commitMove after the 90° turn.
    (window as any).__cubeMindMove?.(move);
  };

  const onCubeMove=(move:string)=>commitMove(move);

  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
      const map:Record<string,string>={u:"U",d:"D",l:"L",r:"R",f:"F",b:"B"};
      const m=map[e.key.toLowerCase()];
      if(!m)return;
      e.preventDefault();
      requestMove(e.shiftKey?m+"'":m);
    };
    window.addEventListener("keydown",key);
    return()=>window.removeEventListener("keydown",key);
  });

  const scrambleCube=()=>{
    const seq=makeScramble(mode==="interview"?18:20);
    setCube(c=>seq.reduce((v,m)=>applyMove(v,m),cloneCube(c)));
    setScramble(seq);setHistory([]);setFuture([]);setElapsed(0);setStarted(null);
  };
  const reset=()=>{setCube(initialCube());setHistory([]);setFuture([]);setScramble([]);setElapsed(0);setStarted(null);};
  const undo=()=>{const m=history.at(-1);if(!m)return;setCube(c=>applyMove(c,invertMove(m)));setHistory(h=>h.slice(0,-1));setFuture(f=>[m,...f]);};
  const redo=()=>{const m=future[0];if(!m)return;setCube(c=>applyMove(c,m));setFuture(f=>f.slice(1));setHistory(h=>[...h,m]);};
  const newChallenge=()=>{reset();setTimeout(scrambleCube,30);};

  useEffect(()=>{
    if(solved&&history.length&&started){
      const seconds=Math.floor((Date.now()-started)/1000);
      setElapsed(seconds);setStarted(null);
      if(!best||seconds<best){setBest(seconds);localStorage.setItem("cube-mind-best",String(seconds));}
    }
  },[solved,history.length,started,best]);

  const visibleMoves=useMemo(()=>history.slice(-16),[history]);

  return <main className="game-shell">
    <header className="game-top">
      <div className="game-brand"><span className="brand-cube">◆</span><div><b>CUBE MIND</b><small>THINK · SOLVE · GROW</small></div></div>
      <div className="mode-switch">{modes.map(m=><button key={m.id} className={mode===m.id?"mode-chip active":"mode-chip"} onClick={()=>{setMode(m.id);reset();}}>{m.name}</button>)}</div>
      <div className="top-actions"><span className="live-dot">● LIVE</span><button onClick={()=>setMenu(menu==="stats"?null:"stats")}>Stats</button><button className="avatar">SK</button></div>
    </header>

    <section className="game-main">
      <div className="hud-left">
        <span className="hud-label">{mode==="daily"?"DAILY CHALLENGE":mode==="interview"?"60 SECOND CHALLENGE":"FREE PLAY"}</span>
        <h1>{solved?"SOLVED!":"Solve the cube."}</h1>
        <p>{solved?"Clean finish. Ready for another challenge?":"Swipe the cube faces to turn them. Drag outside the cube to orbit around it."}</p>
        <div className="challenge-stat-row"><div><b>{history.length}</b><span>MOVES</span></div><div><b>{progress}%</b><span>PROGRESS</span></div><div><b>{best?best+"s":"—"}</b><span>BEST</span></div></div>
      </div>

      <div className="cube-game">
        <div className="cube-badge"><span>3×3</span><b>{limit?String(remaining).padStart(3,"0")+"s":"∞"}</b><small>{limit?"TIME LEFT":"FREE PLAY"}</small></div>
        <Cube3D cube={cube} onMove={onCubeMove} />
        <div className="cube-actions">
          <button onClick={undo} disabled={!history.length}>↶</button>
          <button onClick={redo} disabled={!future.length}>↷</button>
          <button className="primary" onClick={scrambleCube}>SCRAMBLE</button>
          <button onClick={reset}>RESET</button>
        </div>
      </div>

      <aside className="game-panel">
        <div className="panel-head"><span>MOVE CONTROLS</span><button onClick={()=>setMenu(menu==="moves"?null:"moves")}>⌘</button></div>
        <div className="face-buttons">{faces.map(f=><button key={f} onClick={()=>requestMove(f)}>{f}</button>)}</div>
        <div className="face-buttons prime">{faces.map(f=><button key={f+"p"} onClick={()=>requestMove(f+"'")}>{f}&apos;</button>)}</div>
        <div className="panel-section"><span>SCRAMBLE</span><p>{scramble.length?scramble.join(" "):"Generate a puzzle to begin."}</p></div>
        <div className="panel-section"><span>RECENT MOVES</span><div className="move-history">{visibleMoves.length?visibleMoves.map((m,i)=><b key={i}>{m}</b):<i>—</i>}</div></div>
        <div className="game-tip"><strong>HOW TO PLAY</strong><span>Swipe a face → turn that layer</span><span>Drag outside → rotate cube</span><span>Scroll → zoom</span><span>U D L R F B → keyboard</span></div>
      </aside>
    </section>

    <footer className="game-bottom">
      <button onClick={()=>setMenu(menu==="learn"?null:"learn")}>HOW TO SOLVE</button>
      <button onClick={()=>setMenu(menu==="moves"?null:"moves")}>MOVES & NOTATION</button>
      <button onClick={newChallenge}>NEW CHALLENGE</button>
      <div className="progress-bar"><span style={{width:progress+"%"}}/></div>
      <span>{progress}% COMPLETE</span>
    </footer>

    {menu && <div className="game-overlay" onClick={()=>setMenu(null)}>
      <div className="overlay-card" onClick={e=>e.stopPropagation()}>
        <button className="close" onClick={()=>setMenu(null)}>×</button>
        {menu==="moves"&&<><span className="hud-label">MOVES & NOTATION</span><h2>Control the cube like a cuber.</h2><p>Swipe any visible face to turn its layer. Use U D L R F B on the keyboard. Shift + a key makes a prime turn. Double turns are available from the move pad.</p><div className="notation-grid">{["U U' U2","R R' R2","F F' F2","D D' D2","L L' L2","B B' B2"].map(x=><b key={x}>{x}</b>)}</div></>}
        {menu==="learn"&&<><span className="hud-label">HOW TO SOLVE</span><h2>Learn by doing.</h2><p>Start with notation and cube orientation, then learn the beginner layer-by-layer method. CUBE MIND will turn each concept into short interactive challenges.</p><button className="overlay-action" onClick={()=>setMenu(null)}>START PRACTICE</button></>}
        {menu==="stats"&&<><span className="hud-label">GAME STATS</span><h2>Your attempt.</h2><div className="big-stats"><div><b>{elapsed}s</b><span>TIME</span></div><div><b>{history.length}</b><span>MOVES</span></div><div><b>{progress}%</b><span>PROGRESS</span></div><div><b>{best?best+"s":"—"}</b><span>PERSONAL BEST</span></div></div></>}
      </div>
    </div>}
  </main>;
}