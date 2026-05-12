import React from 'react';

export default function UdpSenderPage({ sender, setSender, payload, encodedLength, sendResult, sendHistory, onSubmit }) {
  return (
    <section className="panel sender-panel">
      <div className="table-header"><p className="eyebrow">UDP Sender</p><h3 className="section-title">Compose a fixed-length UDP payload</h3><p className="muted">Password controls the prefix, END is fixed, and the payload is padded to 200 bytes.</p></div>
      <form className="sender-form" onSubmit={onSubmit}>
        <label>Target host<input value={sender.targetHost} onChange={(e) => setSender({ ...sender, targetHost: e.target.value })} /></label>
        <label>Target port<input type="number" value={sender.targetPort} onChange={(e) => setSender({ ...sender, targetPort: e.target.value })} /></label>
        <label>Password<input value={sender.password} onChange={(e) => setSender({ ...sender, password: e.target.value })} /></label>
        <label>Execution mode
          <select value={sender.executionMode} onChange={(e) => setSender({ ...sender, executionMode: e.target.value })}>
            <option value="main">主线程执行</option>
            <option value="thread">独立线程执行</option>
          </select>
        </label>
        <label className="sender-message-field">Message<textarea rows="6" value={sender.message} onChange={(e) => setSender({ ...sender, message: e.target.value })} placeholder="Leave empty or enter command payload" /></label>
        <div className="sender-actions"><button className="primary-button" type="submit">Send UDP message</button></div>
      </form>
      <div className="preview-grid">
        <article className="preview-card"><p className="eyebrow">Preview</p><pre>{`${payload}\n\nEncoded length: ${encodedLength} bytes\nPadded length: 200 bytes`}</pre></article>
        <article className="preview-card">
          <p className="eyebrow">History</p>
          <ul className="preview-list">
            <li>Password controls the prefix</li>
            <li>END is fixed</li>
            <li>Independent thread mode automatically prefixes message with &</li>
          </ul>
          <div className="muted">{sendResult}</div>
          <div className="stack" style={{ marginTop: '14px' }}>
            {(sendHistory || []).length === 0 ? <p className="muted">No successful send history yet.</p> : sendHistory.map((item) => (
              <article className="audit-card" key={item.id}>
                <div className="split"><strong>{item.targetHost}:{item.targetPort}</strong><span className="muted">{item.time}</span></div>
                <p className="muted">Mode: {item.executionMode === 'thread' ? '独立线程执行' : '主线程执行'} · {item.payloadLength} bytes</p>
                <p className="muted">Message: {item.message || '—'}</p>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
