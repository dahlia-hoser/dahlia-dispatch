import { reviewCards, reviewTotals, waitingDetails } from '../../lib/review';
import { ReviewDeck } from '../../components/ReviewDeck';
import { text } from '../../site-text';
import { db } from '../../lib/db';

export default async function Admin() {
  const [cards, more, totals] = await Promise.all([reviewCards(), waitingDetails(), reviewTotals()]);
  const preview = db().preview;
  return (
    <>
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 32 }}>{text.reviewTitle}</h1>
        <span className="inline">
          <a href="/admin/colours">{text.batchLink}</a>
          <a href="/admin/farms">Farms</a>
          <a href="/admin/sales">Sale dates</a>
        </span>
      </div>
      {preview && <p className="note-box">Preview mode: no database connected yet, so answers are forgotten when the site restarts.</p>}
      <p className="note">
        <strong>{totals.toReview}</strong> {totals.toReview === 1 ? 'flower' : 'flowers'} left to review
        {totals.toReview > 20 && <> (20 at a time)</>}
        {totals.quiet > 0 && <> · {totals.quiet} more keeping their best guess until a second farm sells them</>}
      </p>
      <ReviewDeck cards={cards} more={more} />
    </>
  );
}
