import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import io from 'socket.io-client';
import { fallbackData, fetchJson } from './app-data.js';
import DashboardPage from './pages/DashboardPage.jsx';
import UdpSenderPage from './pages/UdpSenderPage.jsx';
import SshPage from './pages/SshPage.jsx';
import { AgentsPage, EventsPage } from './pages/ListPage.jsx';

function useLocalStorageFlag(key, defaultValue) {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? defaultValue);
  useEffect(() => { localStorage.setItem(key, value); }, [key, value]);
  return [value, setValue];
}

export default function App() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';
  const [view, setView] = useState('dashboard');
  const [data, setData] = useState(fallbackData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sender, setSender] = useState({ targetHost: '127.0.0.1', targetPort: '111', password: 'Phantom2025!', message: '', executionMode: 'main' });
  const [sendResult, setSendResult] = useState('');
  const [sendHistory, setSendHistory] = useState([]);
  const [sshForm, setSshForm] = useState({ host: '', port: '22', username: '', password: '' });
  const [magicPassword, setMagicPassword] = useLocalStorageFlag('web-ssh-magic-password', '');
  const [useMagicPassword, setUseMagicPassword] = useLocalStorageFlag('web-ssh-use-magic-password', 'false');
  const [sshConnected, setSshConnected] = useState(false);
  const [sshStatus, setSshStatus] = useState('Ready to connect.');
  const terminalContainerRef = useRef(null);
  const termInstanceRef = useRef(null);
  const socketRef = useRef(null);
  const fitRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchJson(apiBaseUrl, '/api/agents'),
      fetchJson(apiBaseUrl, '/api/events'),
      fetchJson(apiBaseUrl, '/api/heartbeats'),
      fetchJson(apiBaseUrl, '/health').catch(() => ({ status: 'unknown' })),
      fetchJson(apiBaseUrl, '/demo-data').catch(() => fallbackData),
    ])
      .then(([agents, events, heartbeats, health, demoData]) => {
        if (!mounted) return;
        setData({
          ...demoData,
          agents: agents.items || [],
          events: events.items || [],
          heartbeats: heartbeats.items || [],
          health,
        });
        setLoadError('');
      })
      .catch((error) => {
        if (!mounted) return;
        setLoadError(error.message || 'Failed to load backend data');
        setData(fallbackData);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (useMagicPassword === 'true' && magicPassword) setSshForm((prev) => ({ ...prev, password: magicPassword }));
    if (useMagicPassword !== 'true') setSshForm((prev) => ({ ...prev, password: '' }));
  }, [useMagicPassword, magicPassword]);

  useEffect(() => () => {
    if (fitRef.current) window.removeEventListener('resize', fitRef.current);
    socketRef.current?.disconnect();
    termInstanceRef.current?.dispose();
  }, []);

  const effectiveMessage = useMemo(() => (sender.executionMode === 'thread' && !sender.message.startsWith('&') ? `&${sender.message}` : sender.message), [sender.executionMode, sender.message]);
  const payload = useMemo(() => `${sender.password}${effectiveMessage}END`, [sender.password, effectiveMessage]);
  const encodedLength = useMemo(() => new TextEncoder().encode(payload).length, [payload]);

  const sendUdp = async (event) => {
    event.preventDefault();
    setSendResult('Sending...');
    try {
      const params = new URLSearchParams({ targetHost: sender.targetHost, targetPort: sender.targetPort, message: effectiveMessage, client: sender.password });
      const response = await fetch(`${apiBaseUrl}/udp/temperature?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'send failed');
      const result = `Sent successfully. Payload length: ${body.payloadLength} bytes.`;
      setSendResult(result);
      setSendHistory((prev) => [{
        id: `${Date.now()}-${prev.length}`,
        time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }),
        targetHost: sender.targetHost,
        targetPort: sender.targetPort,
        executionMode: sender.executionMode,
        message: effectiveMessage,
        payloadLength: body.payloadLength,
      }, ...prev].slice(0, 10));
    } catch (error) {
      setSendResult(`Error: ${error.message}`);
    }
  };

  const connectSsh = () => {
    if (!sshForm.host || !sshForm.username || !sshForm.password) {
      setSshStatus('Please fill host, port, username, and password.');
      return;
    }

    socketRef.current?.disconnect();
    termInstanceRef.current?.dispose();
    setSshConnected(false);
    setSshStatus('Connecting...');

    const socketUrl = import.meta.env.VITE_SSH_SOCKET_URL || 'http://127.0.0.1:4000';
    const socket = io(socketUrl, { transports: ['websocket'], reconnection: false });
    socketRef.current = socket;

    const term = new Terminal({ cursorBlink: true, fontSize: 14, fontFamily: 'Menlo, Monaco, monospace', theme: { background: '#000000', foreground: '#ffffff' } });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainerRef.current);
    termInstanceRef.current = term;
    fitRef.current = () => {
      fitAddon.fit();
      if (socket.connected) socket.emit('resize', { cols: term.cols, rows: term.rows });
    };
    setTimeout(() => fitAddon.fit(), 100);

    socket.on('connect', () => {
      setSshStatus(`Connected to ${socketUrl}`);
      setSshConnected(true);
      term.write('\r\n*** connected ***\r\n');
      socket.emit('initSSH', { host: sshForm.host, port: parseInt(sshForm.port, 10) || 22, username: sshForm.username, password: sshForm.password });
    });
    socket.on('connect_error', (error) => {
      setSshStatus(`Connection error: ${error.message}`);
      term.write(`\r\n*** connection error: ${error.message} ***\r\n`);
    });
    socket.on('output', (data) => term.write(data));
    socket.on('status', (data) => {
      setSshStatus(String(data).replace(/\r?\n/g, ' '));
      term.write(data);
    });
    socket.on('disconnect', () => { setSshConnected(false); setSshStatus('Disconnected'); term.write('\r\n*** disconnected ***\r\n'); });
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

  const openUdpSenderForAgent = (agent) => {
    if (!agent?.host_external_ip) return;
    setSender((prev) => ({ ...prev, targetHost: agent.host_external_ip }));
    setSendResult(`Target host set from agent ${agent.agent_id}.`);
    setView('sender');
  };

  const nav = (id, label) => <button className={`nav-link${view === id ? ' active' : ''}`} onClick={() => setView(id)}>{label}</button>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><p className="eyebrow">Research Console</p><h1>Trigger Observatory</h1></div>
        <nav className="nav">{nav('dashboard', 'Dashboard')}{nav('agents', 'Agents')}{nav('events', 'Events')}{nav('sender', 'UDP Sender')}{nav('ssh', 'Web SSH')}</nav>
        <div className="sidebar-note"><p>Lab profile</p><strong>Merged React workspace</strong></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">Safe eBPF/XDP Research Platform</p><h2>{view === 'ssh' ? 'Web SSH' : view === 'sender' ? 'UDP Sender' : view === 'agents' ? 'Agents' : view.charAt(0).toUpperCase() + view.slice(1)}</h2></div>
          <div className="status-pill"><span className="status-dot" />{loading ? 'Loading backend data...' : loadError ? `Fallback data in use: ${loadError}` : 'Backend connected'}</div>
        </header>

        {view === 'dashboard' && <DashboardPage data={data} />}
        {view === 'agents' && <AgentsPage data={data} onOpenUdpSender={openUdpSenderForAgent} />}
        {view === 'sender' && <UdpSenderPage sender={sender} setSender={setSender} payload={payload} encodedLength={encodedLength} sendResult={sendResult} sendHistory={sendHistory} onSubmit={sendUdp} />}
        {view === 'ssh' && <SshPage sshForm={sshForm} setSshForm={setSshForm} sshConnected={sshConnected} sshStatus={sshStatus} terminalContainerRef={terminalContainerRef} connectSsh={connectSsh} disconnectSsh={disconnectSsh} useMagicPassword={useMagicPassword} setUseMagicPassword={setUseMagicPassword} magicPassword={magicPassword} setMagicPassword={setMagicPassword} />}
        {view === 'events' && <EventsPage data={data} />}
      </main>
    </div>
  );
}
