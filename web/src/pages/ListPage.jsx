import React from 'react';
import Badge from '../components/Badge.jsx';
import { formatBeijingTime } from '../time.js';

function formatEndpoint(ip, port) {
  if (!ip) return '—';
  return port ? `${ip}:${port}` : ip;
}

function getEventEndpoints(event) {
  const localIp = event.local_ip || event.src_ip;
  const localPort = event.local_port || event.src_port;
  const remoteIp = event.remote_ip || event.dst_ip;
  const remotePort = event.remote_port || event.dst_port;

  if (String(event.direction).toLowerCase() === 'inbound') {
    return {
      source: formatEndpoint(remoteIp, remotePort),
      destination: formatEndpoint(localIp, localPort),
    };
  }

  return {
    source: formatEndpoint(localIp, localPort),
    destination: formatEndpoint(remoteIp, remotePort),
  };
}

export function AgentsPage({ data, onOpenUdpSender }) {
  const agents = data.agents || [];
  return (
    <section className="panel">
      <div className="table-header"><p className="eyebrow">Agents</p><h3 className="section-title">Registered agents</h3></div>
      <div className="stack">
        {agents.length === 0 ? (
          <p className="muted">No agents have registered yet.</p>
        ) : agents.map((agent) => (
          <article className="rule-card" key={agent.agent_id}>
            <div className="split">
              <div>
                <strong>{agent.hostname}</strong>
                <p className="muted">Agent ID: {agent.agent_id}</p>
              </div>
              <Badge action={agent.healthy ? 'PASS' : 'DROP'}>{agent.healthy ? 'healthy' : 'unhealthy'}</Badge>
            </div>
            <p className="muted">Version: {agent.version}</p>
            <p className="muted">External IP: {agent.host_external_ip || '—'}</p>
            <p className="muted">First registered: {formatBeijingTime(agent.registered_at)}</p>
            <p className="muted">Last heartbeat: {formatBeijingTime(agent.last_seen_at)}</p>
            <button className="secondary-button" type="button" disabled={!agent.host_external_ip} onClick={() => onOpenUdpSender?.(agent)}>UDP sender</button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EventsPage({ data }) {
  const events = data.events || [];
  const agentOptions = [...new Set(events.map((event) => event.agent_id).filter(Boolean))];
  const directionOptions = [...new Set(events.map((event) => event.direction).filter(Boolean))];
  const [agentFilter, setAgentFilter] = React.useState('all');
  const [directionFilter, setDirectionFilter] = React.useState('all');

  const filteredEvents = events.filter((event) => {
    const agentMatch = agentFilter === 'all' || event.agent_id === agentFilter;
    const directionMatch = directionFilter === 'all' || event.direction === directionFilter;
    return agentMatch && directionMatch;
  });

  return (
    <section className="table-card">
      <div className="table-header">
        <div>
          <p className="eyebrow">Events</p>
          <h3 className="section-title">Observed agent events</h3>
        </div>
        <div className="table-filters">
          <label className="filter-field">
            <span>Agent</span>
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
              <option value="all">All agents</option>
              {agentOptions.map((agentId) => <option key={agentId} value={agentId}>{agentId}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Direction</span>
            <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)}>
              <option value="all">All directions</option>
              {directionOptions.map((direction) => <option key={direction} value={direction}>{direction}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="muted" style={{ marginBottom: '12px' }}>Showing {filteredEvents.length} of {events.length} events.</div>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Agent</th>
            <th>Direction</th>
            <th>Protocol</th>
            <th>PID/Comm</th>
            <th>Source</th>
            <th>Destination</th>
          </tr>
        </thead>
        <tbody>
          {filteredEvents.length === 0 ? (
            <tr><td colSpan="7" className="muted">No matching event data available.</td></tr>
          ) : filteredEvents.map((event) => {
            const endpoints = getEventEndpoints(event);
            return (
              <tr key={event.id}>
                <td>{formatBeijingTime(event.received_at || event.timestamp_ns)}</td>
                <td>{event.agent_id}</td>
                <td>{event.direction}</td>
                <td>{event.protocol}</td>
                <td>{event.pid} / {event.comm}</td>
                <td>{endpoints.source}</td>
                <td>{endpoints.destination}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

