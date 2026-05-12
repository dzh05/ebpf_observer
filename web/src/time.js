export function formatBeijingTime(value) {
  if (value === null || value === undefined || value === '') return '—';

  let date;
  const raw = String(value);

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    const millis = raw.length > 13 ? Math.floor(numeric / 1_000_000) : numeric;
    date = new Date(millis);
  } else {
    date = new Date(raw);
  }

  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}
