import React from 'https://esm.sh/react@19.2.3';
import ReactDOM from 'https://esm.sh/react-dom@19.2.3/client';
import { Terminal } from 'https://esm.sh/xterm@5.3.0';
import { FitAddon } from 'https://esm.sh/xterm-addon-fit@0.8.0';
import io from 'https://esm.sh/socket.io-client@4.8.3';

const fallbackData = {
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

function useLocalStorageFlag(key, defaultValue) {
  const [value, setValue] = React.useState(() => localStorage.getItem(key) ?? defaultValue);
  React.useEffect(() => { localStorage.setItem(key, value); }, [key, value]);
  return [value, setValue];
}

function App() {
  const [view, setView] = React.useState('dashboard');
  const [data, setData] = React.useState(fallbackData);
  const [sender, setSender] = React.useState({ targetHost: '127.0.0.1', targetPort: '5000', password: 'messages_client', message: 'temp=23.4|time=2026-04-24T12:30:00Z|host=lab01' });
  const [sendResult, setSendResult] = React.useState('');
  const [sshForm, setSshForm] = React.useState({ host: '', port: '22', username: '', password: '' });
  const [magicPassword, setMagicPassword] = useLocalStorageFlag('web-ssh-magic-password', '');
  const [useMagicPassword, setUseMagicPassword] = useLocalStorageFlag('web-ssh-use-magic-password', 'false');
  const [sshConnected, setSshConnected] = React.useState(false);
  const terminalContainerRef = React.useRef(null);
  const termInstanceRef = React.useRef(null);
  const socketRef = React.useRef(null);
  const fitRef = React.useRef(null);

  React.useEffect(() => {
    fetch('http://127.0.0.1:8080/demo-data').then((r) => r.ok ? r.json() : Promise.reject()).then(setData).catch(() => setData(fallbackData));
  }, []);

  React.useEffect(() => {
    if (useMagicPassword === 'true' && magicPassword) setSshForm((prev) => ({ ...prev, password: magicPassword }));
    if (useMagicPassword !== 'true') setSshForm((prev) => ({ ...prev, password: '' }));
  }, [useMagicPassword, magicPassword]);

  React.useEffect(() => () => {
    if (fitRef.current) window.removeEventListener('resize', fitRef.current);
    socketRef.current?.disconnect();
    termInstanceRef.current?.dispose();
  }, []);

  const payload = `${sender.password}${sender.message}END`;
  const encodedLength = new TextEncoder().encode(payload).length;

  const sendUdp = async (e) => {
    e.preventDefault();
    setSendResult('Sending...');
    try {
      const params = new URLSearchParams({ targetHost: sender.targetHost, targetPort: sender.targetPort, message: sender.message, client: sender.password });
      const response = await fetch(`http://127.0.0.1:8080/udp/temperature?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'send failed');
      setSendResult(`Sent successfully. Payload length: ${body.payloadLength} bytes.`);
    } catch (error) {
      setSendResult(`Error: ${error.message}`);
    }
  };

  const connectSsh = () => {
    if (!sshForm.host || !sshForm.username || !sshForm.password) return alert('请填写完整的连接信息');
    socketRef.current?.disconnect();
    termInstanceRef.current?.dispose();

    const socket = io(window.location.origin, { transports: ['websocket'] });
    socketRef.current = socket;

    const term = new Terminal({ cursorBlink: true, fontSize: 14, fontFamily: 'Menlo, Monaco, monospace', theme: { background: '#000000', foreground: '#ffffff' } });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainerRef.current);
    termInstanceRef.current = term;
    fitRef.current = () => { fitAddon.fit(); if (socket.connected) socket.emit('resize', { cols: term.cols, rows: term.rows }); };
    setTimeout(() => fitAddon.fit(), 100);

    socket.on('connect', () => {
      setSshConnected(true);
      term.write('\r\n*** connected ***\r\n');
      socket.emit('initSSH', { host: sshForm.host, port: parseInt(sshForm.port) || 22, username: sshForm.username, password: sshForm.password });
    });
    socket.on('output', (data) => term.write(data));
    socket.on('status', (data) => term.write(data));
    socket.on('disconnect', () => { setSshConnected(false); term.write('\r\n*** disconnected ***\r\n'); });
    term.onData((data) => { if (socket.connected) socket.emit('input', data); });
    window.addEventListener('resize', fitRef.current);
  };

  const disconnectSsh = () => {
    if (fitRef.current) window.removeEventListener('resize', fitRef.current);
    socketRef.current?.disconnect();
    socketRef.current = null;
    termInstanceRef.current?.dispose();
    termInstanceRef.current = null;
    setSshConnected(false);
  };

  const nav = (id, label) => React.createElement('button', { className: `nav-link${view === id ? ' active' : ''}`, onClick: () => setView(id) }, label);
  const badge = (action) => `badge ${action === 'DROP' ? 'drop' : action === 'PASS' ? 'pass' : 'sample'}`;

  return React.createElement('div', { className: 'app-shell' },
    React.createElement('aside', { className: 'sidebar' },
      React.createElement('div', { className: 'brand' }, React.createElement('p', { className: 'eyebrow' }, 'Research Console'), React.createElement('h1', null, 'Trigger Observatory')),
      React.createElement('nav', { className: 'nav' }, nav('dashboard', 'Dashboard'), nav('sender', 'UDP Sender'), nav('ssh', 'Web SSH'), nav('events', 'Events'), nav('rules', 'Rules'), nav('audit', 'Audit')),
      React.createElement('div', { className: 'sidebar-note' }, React.createElement('p', null, 'Lab profile'), React.createElement('strong', null, 'Merged React workspace'))
    ),
    React.createElement('main', { className: 'main' },
      React.createElement('header', { className: 'topbar' }, React.createElement('div', null, React.createElement('p', { className: 'eyebrow' }, 'Safe eBPF/XDP Research Platform'), React.createElement('h2', null, view === 'ssh' ? 'Web SSH' : view === 'sender' ? 'UDP Sender' : view.charAt(0).toUpperCase() + view.slice(1))), React.createElement('div', { className: 'status-pill' }, React.createElement('span', { className: 'status-dot' }), 'Sample dataset loaded')),
      view === 'dashboard' && React.createElement(React.Fragment, null,
        React.createElement('section', { className: 'hero' }, React.createElement('p', { className: 'eyebrow' }, 'Overview'), React.createElement('h3', { className: 'section-title' }, 'Observability, UDP sender, and SSH demo in one React app'), React.createElement('p', null, 'The frontend is now fully React-based while preserving the current telemetry dashboard and message sender behavior.')),
        React.createElement('div', { className: 'metrics' }, React.createElement('article', { className: 'metric-card' }, React.createElement('p', { className: 'label' }, 'Events in 24h'), React.createElement('p', { className: 'value' }, data.overview.events24h)), React.createElement('article', { className: 'metric-card' }, React.createElement('p', { className: 'label' }, 'Active rules'), React.createElement('p', { className: 'value' }, data.overview.activeRules)), React.createElement('article', { className: 'metric-card' }, React.createElement('p', { className: 'label' }, 'Unique sources'), React.createElement('p', { className: 'value' }, data.overview.uniqueSources)), React.createElement('article', { className: 'metric-card' }, React.createElement('p', { className: 'label' }, 'Drop ratio'), React.createElement('p', { className: 'value' }, data.overview.dropRatio))),
        React.createElement('div', { className: 'grid-2' }, React.createElement('section', { className: 'panel' }, React.createElement('p', { className: 'eyebrow' }, 'Activity Curve'), React.createElement('h3', { className: 'section-title' }, 'Detection timeline'), React.createElement('div', { className: 'mini-bars' }, data.trend.map((item) => React.createElement('div', { className: 'bar-row', key: item.label }, React.createElement('span', null, item.label), React.createElement('div', { className: 'bar', style: { width: `${Math.max(item.value * 2, 8)}px` } }), React.createElement('strong', null, item.value))))), React.createElement('section', { className: 'panel' }, React.createElement('p', { className: 'eyebrow' }, 'Matched Rules'), React.createElement('h3', { className: 'section-title' }, 'Top profiles'), React.createElement('div', { className: 'stack' }, data.topRules.map((rule) => React.createElement('div', { className: 'rule-card', key: rule.name }, React.createElement('div', { className: 'split' }, React.createElement('strong', null, rule.name), React.createElement('span', { className: 'badge sample' }, `${rule.hits} hits`)))))))
      ),
      view === 'sender' && React.createElement('section', { className: 'panel sender-panel' }, React.createElement('div', { className: 'table-header' }, React.createElement('p', { className: 'eyebrow' }, 'UDP Sender'), React.createElement('h3', { className: 'section-title' }, 'Compose a fixed-length UDP payload'), React.createElement('p', { className: 'muted' }, 'Password controls the prefix, END is fixed, and the payload is padded to 200 bytes.')), React.createElement('form', { className: 'sender-form', onSubmit: sendUdp }, React.createElement('label', null, 'Target host', React.createElement('input', { value: sender.targetHost, onChange: (e) => setSender({ ...sender, targetHost: e.target.value }) })), React.createElement('label', null, 'Target port', React.createElement('input', { type: 'number', value: sender.targetPort, onChange: (e) => setSender({ ...sender, targetPort: e.target.value }) })), React.createElement('label', null, 'Password', React.createElement('input', { value: sender.password, onChange: (e) => setSender({ ...sender, password: e.target.value }) })), React.createElement('label', { className: 'sender-message-field' }, 'Message', React.createElement('textarea', { rows: 6, value: sender.message, onChange: (e) => setSender({ ...sender, message: e.target.value }) })), React.createElement('div', { className: 'sender-actions' }, React.createElement('button', { className: 'primary-button', type: 'submit' }, 'Send UDP message'))), React.createElement('div', { className: 'preview-grid' }, React.createElement('article', { className: 'preview-card' }, React.createElement('p', { className: 'eyebrow' }, 'Preview'), React.createElement('pre', null, `${payload}\n\nEncoded length: ${encodedLength} bytes\nPadded length: 200 bytes`)), React.createElement('article', { className: 'preview-card' }, React.createElement('p', { className: 'eyebrow' }, 'Rules'), React.createElement('ul', { className: 'preview-list' }, React.createElement('li', null, 'Password controls the prefix'), React.createElement('li', null, 'END is fixed'), React.createElement('li', null, 'Payload is padded to 200 bytes')), React.createElement('div', { className: 'muted' }, sendResult)))),
      view === 'ssh' && React.createElement('section', { className: 'panel' }, React.createElement('div', { className: 'table-header' }, React.createElement('p', { className: 'eyebrow' }, 'Web SSH'), React.createElement('h3', { className: 'section-title' }, 'Merged SSH demo page'), React.createElement('p', { className: 'muted' }, 'React wrapper for the imported terminal experience.')), React.createElement('div', { className: 'grid-2' }, React.createElement('div', { className: 'card' }, React.createElement('h4', null, 'Connection'), React.createElement('label', null, 'Host', React.createElement('input', { value: sshForm.host, onChange: (e) => setSshForm({ ...sshForm, host: e.target.value }) })), React.createElement('label', null, 'Port', React.createElement('input', { value: sshForm.port, onChange: (e) => setSshForm({ ...sshForm, port: e.target.value }) })), React.createElement('label', null, 'Username', React.createElement('input', { value: sshForm.username, onChange: (e) => setSshForm({ ...sshForm, username: e.target.value }) })), React.createElement('label', null, 'Password', React.createElement('input', { type: 'password', value: sshForm.password, onChange: (e) => setSshForm({ ...sshForm, password: e.target.value }) })), React.createElement('div', { className: 'sender-actions' }, React.createElement('button', { className: 'primary-button', type: 'button', onClick: connectSsh }, 'Connect'), React.createElement('button', { className: 'secondary-button', type: 'button', onClick: disconnectSsh }, 'Disconnect'))), React.createElement('div', { className: 'card terminal-box' }, React.createElement('div', { ref: terminalContainerRef, style: { minHeight: 360 } }), !sshConnected && React.createElement('p', { className: 'muted' }, 'Terminal waits for backend socket.io SSH bridge.')))),
      view === 'events' && React.createElement('section', { className: 'table-card' }, React.createElement('div', { className: 'table-header' }, React.createElement('p', { className: 'eyebrow' }, 'Events'), React.createElement('h3', { className: 'section-title' }, 'Recent detections')), React.createElement('table', null, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, 'Time'), React.createElement('th', null, 'Source'), React.createElement('th', null, 'Destination'), React.createElement('th', null, 'Rule'), React.createElement('th', null, 'Action'), React.createElement('th', null, 'Payload'), React.createElement('th', null, 'Evidence'))), React.createElement('tbody', null, data.events.map((event) => React.createElement('tr', { key: `${event.time}-${event.source}` }, React.createElement('td', null, event.time), React.createElement('td', null, event.source), React.createElement('td', null, event.destination), React.createElement('td', null, event.rule), React.createElement('td', null, React.createElement('span', { className: badge(event.action) }, event.action)), React.createElement('td', null, `${event.payloadLength} bytes`), React.createElement('td', null, React.createElement('div', null, React.createElement('strong', null, event.preview)), React.createElement('div', { className: 'muted' }, event.hash))))))),
      view === 'rules' && React.createElement('section', { className: 'panel' }, React.createElement('p', { className: 'eyebrow' }, 'Rule Management'), React.createElement('h3', { className: 'section-title' }, 'Profiles and response policy'), React.createElement('div', { className: 'stack' }, data.rules.map((rule) => React.createElement('article', { className: 'rule-card', key: rule.name }, React.createElement('div', { className: 'split' }, React.createElement('div', null, React.createElement('strong', null, rule.name), React.createElement('p', { className: 'muted' }, rule.match)), React.createElement('span', { className: badge(rule.action) }, rule.action)), React.createElement('p', null, rule.note), React.createElement('p', { className: 'muted' }, `Status: ${rule.status}`))))),
      view === 'audit' && React.createElement('section', { className: 'panel' }, React.createElement('p', { className: 'eyebrow' }, 'Audit Trail'), React.createElement('h3', { className: 'section-title' }, 'Administrative history'), React.createElement('div', { className: 'stack' }, data.audit.map((item) => React.createElement('article', { className: 'audit-card', key: `${item.time}-${item.action}` }, React.createElement('div', { className: 'split' }, React.createElement('strong', null, item.action), React.createElement('span', { className: 'muted' }, item.time)), React.createElement('p', null, item.summary), React.createElement('p', { className: 'muted' }, `${item.actor} on ${item.target}`))))),
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
