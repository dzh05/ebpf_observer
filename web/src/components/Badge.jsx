import React from 'react';

export default function Badge({ action, children }) {
  const cls = action === 'DROP' ? 'badge drop' : action === 'PASS' ? 'badge pass' : 'badge sample';
  return <span className={cls}>{children}</span>;
}
