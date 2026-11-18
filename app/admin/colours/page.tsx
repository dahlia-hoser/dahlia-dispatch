import { reviewCards, waitingDetails } from '../../../lib/review';
import { confirmBatch } from '../actions';
import { text, fill } from '../../../site-text';

const SWATCH: Record<string, string> = {
  White: '#ffffff', Cream: '#f3ead3', Yellow: '#f2d15a', Orange: '#e8893a', Peach: '#f4b896', Pink: '#e889a9',
  Blush: '#f6d3cf', Red: '#c8352f', Burgundy: '#6d1f33', Purple: '#7b4a9a', Lavender: '#c9b6e4', Bicolour: '#e8e0d3',
};

export default async function BatchColours({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  const [cards, more] = await Promise.all([reviewCards(), waitingDetails()]);
  const details = cards.filter((c) => c.kind === 'details') as Extract<(typeof cards)[number], { kind: 'details' }>[];
  return (
    <>
      <a className="back" href="/admin">← {text.reviewTitle}</a>
      <h1 style={{ fontSize: 32 }}>{text.batchTitle}</h1>
      {done && <p className="saved">{fill(text.batchDone, { n: done })}</p>}
      <p className="note">{text.batchIntro}</p>
      {details.length === 0 ? (
        <div className="done">
          <img src="/all-caught-up.jpg" alt="" />
          <h2>{text.reviewDoneTitle}</h2>
          <p>{text.reviewDoneText}</p>
        </div>
      ) : (
        <form action={confirmBatch} className="batch">
          <div className="batch-grid">
            {details.map((c) => {
              const cols = [c.colour1, c.colour2].filter(Boolean) as string[];
              return (
                <label key={c.id} className="batch-tile">
                  <input type="checkbox" name="ok" value={c.id} defaultChecked={cols.length > 0 && !!c.form} />
                  {c.seenAt.find((s) => s.image) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="batch-photo" src={c.seenAt.find((s) => s.image)!.image!} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  )}
                  <span className="batch-body">
                    <b>{c.name}</b>
                    <span className="inline" style={{ gap: 6 }}>
                      {cols.length ? cols.map((x) => <span key={x} className="dot" style={{ background: SWATCH[x] }} title={x} />) : <span className="note">{text.batchNoColour}</span>}
                      <span className="note">{cols.join(' / ')}</span>
                    </span>
                    <span className="note">{c.form ?? text.batchNoForm}{c.formFrom ? ` · ${fill(text.reviewFormFrom, { farm: c.formFrom })}` : ''}</span>
                    <span className="note">
                      {c.seenAt.map((s, i) => <span key={i}>{i > 0 && ' · '}{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.farm} ↗</a> : s.farm}</span>)}
                    </span>
                    <a href={`/admin/varieties/${c.slug}`}>{text.batchFix}</a>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="inline">
            <button className="btn" type="submit">{text.batchConfirm}</button>
            <span className="note">{more > 0 ? fill(text.reviewMoreWaiting, { n: more }) : ''}</span>
          </div>
        </form>
      )}
    </>
  );
}
