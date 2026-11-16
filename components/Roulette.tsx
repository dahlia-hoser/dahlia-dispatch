'use client';
// The roulette: a spinning maple leaf, then a random mystery pack.
import { useState } from 'react';
import { Leaf } from './Leaf';
import { text } from '../site-text';

type Pick = { title: string; farm: string; price: string; url: string; inStock: boolean };

export function Roulette({ picks }: { picks: Pick[] }) {
  const [spinning, setSpinning] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  if (!picks.length) return <p className="note">{text.spinNone}</p>;
  const spin = () => {
    setSpinning(true);
    setPick(null);
    const pool = picks.some((p) => p.inStock) ? picks.filter((p) => p.inStock) : picks;
    setTimeout(() => {
      setPick(pool[Math.floor(Math.random() * pool.length)]);
      setSpinning(false);
    }, 1400);
  };
  return (
    <div className="roulette">
      <div className={`wheel${spinning ? ' spinning' : ''}`} aria-hidden="true">
        <Leaf size={72} veins />
      </div>
      <button className="btn" onClick={spin} disabled={spinning}>{pick ? text.spinAgain : text.spinButton}</button>
      <div aria-live="polite">
        {pick && (
          <div className="pick">
            <span className="note">{text.spinResult}</span>
            <b>{pick.title}</b>
            <span className="note">{pick.farm} · {pick.price}</span>
            <a href={pick.url} target="_blank" rel="noopener noreferrer">{text.visitShop} ↗</a>
          </div>
        )}
      </div>
    </div>
  );
}
