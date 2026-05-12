export const fallbackData = {
  overview: { events24h: 128, activeRules: 3, uniqueSources: 17, dropRatio: '14%' },
  trend: [
    { label: '00:00', value: 8 },
    { label: '04:00', value: 12 },
    { label: '08:00', value: 26 },
    { label: '12:00', value: 34 },
    { label: '16:00', value: 22 },
    { label: '20:00', value: 14 }
  ],
  topRules: [
    { name: 'udp-fixed-length-lab', hits: 64 },
    { name: 'marker-prefix-demo', hits: 41 },
    { name: 'passive-sample-profile', hits: 23 }
  ],
  events: [
    { time: '2026-04-17 16:10:21', source: '192.168.56.12:53001', destination: '192.168.56.10:9000', rule: 'udp-fixed-length-lab', action: 'DROP', payloadLength: 200, preview: 'demo payload', hash: 'sha256:7c4f...ab91' }
  ],
  rules: [
    { name: 'udp-fixed-length-lab', status: 'Enabled', action: 'DROP', match: 'UDP, start marker, exact length 200', note: 'Used to demonstrate early-path classification.' },
    { name: 'marker-prefix-demo', status: 'Enabled', action: 'SAMPLE_ONLY', match: 'UDP, preview prefix match, analyst review', note: 'Keeps packets flowing while capturing evidence.' }
  ],
  audit: [
    { time: '2026-04-17 15:55:08', actor: 'researcher', action: 'Updated rule action', target: 'udp-fixed-length-lab', summary: 'Changed action from SAMPLE_ONLY to DROP for a controlled replay.' }
  ]
};

export async function fetchJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return body;
}
