import { sendFeedback } from './actions';
import { text } from '../../site-text';

export default async function Feedback({ searchParams }: { searchParams: Promise<{ sent?: string; from?: string }> }) {
  const { sent, from } = await searchParams;
  return (
    <>
      <section className="hero">
        <h1>{text.feedbackTitle}</h1>
        <p>{text.feedbackIntro}</p>
      </section>
      {sent ? (
        <p className="saved">{text.feedbackThanks}</p>
      ) : (
        <form className="form" action={sendFeedback}>
          <input type="hidden" name="page" value={from ?? ''} />
          {/* Spam trap: people never see or fill this in. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
            <label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
          <label>
            {text.feedbackMessage}
            <textarea name="message" rows={6} maxLength={2000} required />
          </label>
          <label>
            {text.feedbackContact}
            <input name="contact" maxLength={200} autoComplete="email" />
          </label>
          <p className="note">{text.feedbackPrivacy}</p>
          <div><button className="btn" type="submit">{text.feedbackSend}</button></div>
        </form>
      )}
    </>
  );
}
