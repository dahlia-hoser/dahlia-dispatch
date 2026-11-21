// "Add to calendar": a calendar file (Apple, Outlook, most phones) and a Google Calendar link. Free, nothing stored about anyone.
import type { Farm, SaleEvent } from './types';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function saleTitle(s: SaleEvent, f: Farm | undefined) {
  return `${f?.name ?? 'Dahlia sale'}: ${s.label ?? 'dahlia sale'} opens`;
}
function details(s: SaleEvent, f: Farm | undefined) {
  return [s.note, s.url ?? f?.site ? `Shop: ${s.url ?? f?.site}` : null, 'From The Dahlia Hoser'].filter(Boolean).join('\n');
}

/** Only sales with a set date and time can go in a calendar. */
export const canAddToCalendar = (s: SaleEvent, now = Date.now()) => !!s.starts_at && new Date(s.starts_at).getTime() > now;

export function icsFor(s: SaleEvent, f: Farm | undefined): string {
  const start = new Date(s.starts_at!);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Dahlia Hoser//Sale calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:sale-${s.id}@dahliahoser`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(saleTitle(s, f))}`,
    `DESCRIPTION:${esc(details(s, f))}`,
    ...(s.url ?? f?.site ? [`URL:${s.url ?? f?.site}`] : []),
    // Reminders: the day before, and 15 minutes before it opens.
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(saleTitle(s, f))} tomorrow`, 'TRIGGER:-P1D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(saleTitle(s, f))} in 15 minutes`, 'TRIGGER:-PT15M', 'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

export function googleCalendarLink(s: SaleEvent, f: Farm | undefined): string {
  const start = new Date(s.starts_at!);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const p = new URLSearchParams({ action: 'TEMPLATE', text: saleTitle(s, f), dates: `${stamp(start)}/${stamp(end)}`, details: details(s, f) });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
