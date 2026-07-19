const TZ = 'Asia/Kuala_Lumpur';

/** Display helper — does not mutate API timestamps. */
export function formatKlDateTime(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '—';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export function formatKlTime(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '—';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: TZ,
    timeStyle: 'short',
  }).format(d);
}
