'use client';
// Phone-sized review list: one question at a time.
import { useState, useTransition } from 'react';
import type { Card } from '../lib/review';
import { answerAction, undoAction } from '../app/admin/actions';
import { COLOURS, FORMS } from '../lib/types';
import { text, fill } from '../site-text';

export function ReviewDeck({ cards, more = 0 }: { cards: Card[]; more?: number }) {
  const [i, setI] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [busy, start] = useTransition();
  const total = cards.length;
  const card = cards[i];

  const go = (a: Parameters<typeof answerAction>[1]) =>
    start(async () => {
      await answerAction(card.id, a);
      setHistory((h) => [...h, card.id]);
      setI((x) => x + 1);
    });
  const undo = () =>
    start(async () => {
      const last = history.at(-1);
      if (last == null) return;
      await undoAction(last);
      setHistory((h) => h.slice(0, -1));
      setI((x) => Math.max(0, x - 1));
    });

  return (
    <div className="review">
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        <span className="note">{fill(text.reviewProgress, { done: Math.min(i, total), total })}</span>
        {history.length > 0 && <button className="linkbtn" onClick={undo} disabled={busy}>{text.reviewUndo}</button>}
      </div>
      <div className="progress" aria-hidden="true"><div style={{ width: total ? `${(Math.min(i, total) / total) * 100}%` : '100%' }} /></div>

      {!card ? (
        more > 0 ? (
          <div className="done">
            <img src="/all-caught-up.jpg" alt="" />
            <h2>{text.reviewBatchDone}</h2>
            <p>{fill(text.reviewMoreWaiting, { n: more })}</p>
            <button className="btn" onClick={() => window.location.reload()}>{text.reviewNextBatch}</button>
          </div>
        ) : (
          <div className="done">
            <img src="/all-caught-up.jpg" alt="" />
            <h2>{text.reviewDoneTitle}</h2>
            <p>{text.reviewDoneText}</p>
          </div>
        )
      ) : (
        <div className="rcard" aria-busy={busy} key={card.id}>
          {card.kind === 'feedback' && <FeedbackCard card={card} busy={busy} go={go} />}
          {card.kind === 'farm' && <FarmCard card={card} busy={busy} go={go} />}
          {card.kind === 'name' && <NameCard card={card} busy={busy} go={go} />}
          {card.kind === 'details' && <DetailsCard card={card} busy={busy} go={go} />}
        </div>
      )}
    </div>
  );
}

type Go = (a: any) => void;

function FeedbackCard({ card, busy, go }: { card: Extract<Card, { kind: 'feedback' }>; busy: boolean; go: Go }) {
  return (
    <>
      <span className="kicker">{text.reviewFeedback}</span>
      <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text)', fontSize: 18 }}>{card.message}</p>
      <p className="note">
        {new Date(card.at).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' })}
        {card.contact && <> · {card.contact}</>}
        {card.page && <> · from {card.page}</>}
      </p>
      <div className="choices">
        <button className="btn" disabled={busy} onClick={() => go({ choice: 'yes' })}>{text.reviewFeedbackDone}</button>
        <button className="linkbtn" disabled={busy} onClick={() => go({ choice: 'later' })}>{text.reviewLater}</button>
      </div>
    </>
  );
}

function FarmCard({ card, busy, go }: { card: Extract<Card, { kind: 'farm' }>; busy: boolean; go: Go }) {
  const [site, setSite] = useState(card.site ?? '');
  return (
    <>
      <span className="kicker">{text.reviewFarmQuestion}</span>
      <h2>{card.name}</h2>
      <p>{[card.place, card.platform === 'shopify' ? 'Shopify shop' : null].filter(Boolean).join(' · ')}</p>
      <label className="form" style={{ gap: 4 }}>
        <span className="note">Shop web address (you can add it later)</span>
        <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="farmname.ca" inputMode="url" style={{ border: '1px solid #d6ccbc', borderRadius: 10, padding: '10px 12px' }} />
      </label>
      {!card.site && (
        <a href={`https://www.google.com/search?q=${encodeURIComponent(card.name + ' dahlia tubers Canada')}`} target="_blank" rel="noopener noreferrer">Look it up ↗</a>
      )}
      <div className="choices">
        <button className="btn" disabled={busy} onClick={() => go({ choice: 'yes', site })}>{text.reviewYes}</button>
        <button className="btn ghost" disabled={busy} onClick={() => go({ choice: 'no' })}>{text.reviewNo}</button>
        <button className="linkbtn" disabled={busy} onClick={() => go({ choice: 'later' })}>{text.reviewLater}</button>
      </div>
    </>
  );
}

function NameCard({ card, busy, go }: { card: Extract<Card, { kind: 'name' }>; busy: boolean; go: Go }) {
  return (
    <>
      <span className="kicker">{text.reviewNameQuestion}</span>
      <h2>“{card.spelling}”</h2>
      <p>at {card.farm}</p>
      {card.suggestion && (
        <p>
          Is it the same as <a href={`/v/${card.suggestion.slug}`} target="_blank"><b>{card.suggestion.name}</b></a>
          {card.suggestion.detail && <> ({card.suggestion.detail})</>}?
        </p>
      )}
      {card.note && <p className="note">{card.note}</p>}
      <div className="choices">
        <button className="btn" disabled={busy} onClick={() => go({ choice: 'yes' })}>{text.reviewYes}, same flower</button>
        <button className="btn ghost" disabled={busy} onClick={() => go({ choice: 'no' })}>{text.reviewNo}, {text.reviewNewVariety.toLowerCase()}</button>
        <button className="linkbtn" disabled={busy} onClick={() => go({ choice: 'later' })}>{text.reviewLater}</button>
      </div>
    </>
  );
}

function DetailsCard({ card, busy, go }: { card: Extract<Card, { kind: 'details' }>; busy: boolean; go: Go }) {
  const [cols, setCols] = useState<string[]>([card.colour1, card.colour2].filter(Boolean) as string[]);
  const [form, setForm] = useState<string | null>(card.form);
  const toggle = (c: string) => setCols((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c].slice(-2)));
  return (
    <>
      <span className="kicker">{card.isNew ? text.reviewNewVariety : text.reviewDetailsQuestion}</span>
      <h2>{card.name}</h2>
      {card.seenAt.length > 0 && (
        <p className="note">
          {card.seenAt.map((s, i) => (
            <span key={i}>{i > 0 && ' · '}{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.farm} ↗</a> : s.farm}</span>
          ))}
        </p>
      )}
      {card.guessed && <p className="note">{text.reviewGuessed}</p>}
      <p><b>{text.varietyColour}</b> <span className="note">(pick up to 2)</span></p>
      <div className="pills">
        {COLOURS.map((c) => <button key={c} type="button" className="pill" aria-pressed={cols.includes(c)} onClick={() => toggle(c)}>{c}</button>)}
      </div>
      <p><b>{text.varietyForm}</b>{card.formFrom && <span className="note"> ({fill(text.reviewFormFrom, { farm: card.formFrom })})</span>}</p>
      <div className="pills">
        {FORMS.map((f) => <button key={f} type="button" className="pill" aria-pressed={form === f} onClick={() => setForm(form === f ? null : f)}>{f}</button>)}
      </div>
      <div className="choices">
        <button className="btn" disabled={busy} onClick={() => go({ choice: 'save', colour1: cols[0] ?? null, colour2: cols[1] ?? null, form })}>{text.reviewSave}</button>
        <button className="btn ghost" disabled={busy} onClick={() => go({ choice: 'notdahlia' })}>{text.reviewNotDahlia}</button>
        <button className="linkbtn" disabled={busy} onClick={() => go({ choice: 'later' })}>{text.reviewLater}</button>
      </div>
    </>
  );
}
