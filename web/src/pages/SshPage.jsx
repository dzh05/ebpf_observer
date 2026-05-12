import React from 'react';

export default function SshPage({ sshForm, setSshForm, sshConnected, sshStatus, terminalContainerRef, connectSsh, disconnectSsh, useMagicPassword, setUseMagicPassword, magicPassword, setMagicPassword }) {
  return (
    <section className="panel">
      <div className="table-header">
        <p className="eyebrow">Web SSH</p>
        <h3 className="section-title">Merged SSH demo page</h3>
        <p className="muted">React wrapper for the imported terminal experience.</p>
      </div>
      <div className="grid-2 ssh-layout">
        <div className="card ssh-card">
          <div className="ssh-card-header">
            <div>
              <h4>Connection</h4>
              <p className="muted">Provide the SSH host, port, username, and password.</p>
            </div>
            <span className={`ssh-badge ${sshConnected ? 'connected' : 'idle'}`}>{sshConnected ? 'Connected' : 'Idle'}</span>
          </div>
          <div className="ssh-grid">
            <label className="ssh-field ssh-wide">Host<input value={sshForm.host} onChange={(e) => setSshForm({ ...sshForm, host: e.target.value })} placeholder="192.168.1.20" /></label>
            <label className="ssh-field">Port<input value={sshForm.port} onChange={(e) => setSshForm({ ...sshForm, port: e.target.value })} placeholder="22" /></label>
            <label className="ssh-field">Username<input value={sshForm.username} onChange={(e) => setSshForm({ ...sshForm, username: e.target.value })} placeholder="root" /></label>
            <label className="ssh-field ssh-wide">Password<input type="password" value={sshForm.password} onChange={(e) => setSshForm({ ...sshForm, password: e.target.value })} placeholder="Enter SSH password" /></label>
          </div>
          <div className="ssh-magic-card">
            <div className="split">
              <strong>Magic password</strong>
              <label className="ssh-toggle">
                <input type="checkbox" checked={useMagicPassword === 'true'} onChange={(e) => setUseMagicPassword(e.target.checked ? 'true' : 'false')} />
                <span>Enable</span>
              </label>
            </div>
            <input className="ssh-magic-input" type="password" value={magicPassword} onChange={(e) => setMagicPassword(e.target.value)} placeholder="Optional shared password" />
            <p className="muted">When enabled, the magic password will autofill the SSH password field.</p>
          </div>
          <div className="sender-actions">
            <button className="primary-button" type="button" onClick={connectSsh}>Connect</button>
            <button className="secondary-button" type="button" onClick={disconnectSsh}>Disconnect</button>
          </div>
          <div className="ssh-status">{sshStatus || 'Ready to connect.'}</div>
        </div>
        <div className="card terminal-box">
          <div ref={terminalContainerRef} className="terminal-host" />
          {!sshConnected && <p className="muted">Terminal waits for backend socket.io SSH bridge.</p>}
        </div>
      </div>
    </section>
  );
}
