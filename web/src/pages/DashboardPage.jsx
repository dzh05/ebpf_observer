import React from 'react';
import { formatBeijingTime } from '../time.js';

export default function DashboardPage({ data }) {
  const agents = data.agents || [];
  const events = data.events || [];
  const heartbeats = data.heartbeats || [];
  const overview = data.overview || {};

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Agent Overview</p>
        <h3 className="section-title">Server-driven observability console</h3>
        <p>Now the dashboard reflects live agent registration, heartbeat activity, and batched event ingest from the backend.</p>
      </section>

      <div className="metrics">
        <article className="metric-card"><p className="label">Agents</p><p className="value">{agents.length}</p></article>
        <article className="metric-card"><p className="label">Events</p><p className="value">{events.length}</p></article>
        <article className="metric-card"><p className="label">Heartbeats</p><p className="value">{heartbeats.length}</p></article>
        <article className="metric-card"><p className="label">Active rules</p><p className="value">{overview.activeRules ?? '—'}</p></article>
      </div>

      <div className="grid-2">
        <section className="panel">
          <p className="eyebrow">Agents</p>
          <h3 className="section-title">Registered agents</h3>
          <div className="stack">
            {agents.length === 0 ? <p className="muted">No agents have registered yet.</p> : agents.map((agent) => (
              <article className="rule-card" key={agent.agent_id}>
                <div className="split"><strong>{agent.hostname}</strong><span className="badge sample">{agent.agent_id}</span></div>
                <p className="muted">Host ID: {agent.host_id}</p>
                <p className="muted">Version: {agent.version}</p>
                <p className="muted">Healthy: {String(Boolean(agent.healthy))}</p>
                <p className="muted">Last seen: {formatBeijingTime(agent.last_seen_at)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Heartbeat stream</p>
          <h3 className="section-title">Recent heartbeats</h3>
          <div className="stack">
            {heartbeats.length === 0 ? <p className="muted">No heartbeat records yet.</p> : heartbeats.slice(0, 5).map((item) => (
              <article className="rule-card" key={item.id}>
                <div className="split"><strong>{item.agent_id}</strong><span className="badge sample">{item.healthy ? 'healthy' : 'unhealthy'}</span></div>
                <p className="muted">Queue depth: {item.queue_depth}</p>
                <p className="muted">Timestamp(ns): {formatBeijingTime(item.timestamp_ns)}</p>
                <p className="muted">Received: {formatBeijingTime(item.received_at)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
