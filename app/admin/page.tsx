import { reviewCards, waitingDetails } from '../../lib/review';
import { ReviewDeck } from '../../components/ReviewDeck';
import { text } from '../../site-text';
import { db } from '../../lib/db';

export default async function Admin() {
  const [cards, more] = await Promise.all([reviewCards(), waitingDetails()]);
  const preview = db().preview;
  return (
    <>
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 32 }}>{text.reviewTitle}</h1>
        <span className="inline">
          <a href="/admin/farms">Farms</a>
          <a href="/admin/sales">Sale dates</a>
        </span>
      </div>
      {preview && <p className="note-box">Preview mode: no database connected yet, so answers are forgotten when the site restarts.</p>}
      <ReviewDeck cards={cards} more={more} />
    </>
  );
}
