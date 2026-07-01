// =============================================================================
// Icon — set de íconos de línea (SVG) para el sidebar plegable
// =============================================================================
// Todos comparten viewBox 24 y usan currentColor, así heredan el color del texto
// del item (activo / inactivo). Un solo componente <Icon name=… /> para no
// depender de una librería externa.

import type { ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  general: (<><path d="M4 15a8 8 0 0 1 16 0" /><path d="M12 15l4.2-3.4" /><circle cx="12" cy="15" r="1.1" /><path d="M4.2 15H5.6M18.4 15h1.4M12 7.2V5.6" /></>),
  grid: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9h17" /><path d="M3.5 14h17" /><path d="M9 9v10.5" /><path d="M15 9v10.5" /></>),
  tvad: (<><rect x="4" y="8" width="16" height="12" rx="2.5" /><path d="M8.5 8 12 4.2 15.5 8" /><path d="M8.5 20v1.6M15.5 20v1.6" /><path d="M10.5 11.3l4.2 2.7-4.2 2.7Z" /></>),
  crm: (<><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M17.5 14.2A5.5 5.5 0 0 1 21.5 20" /></>),
  graphics: (<><rect x="3" y="12" width="4" height="8" rx="1" /><rect x="10" y="5" width="4" height="15" rx="1" /><rect x="17" y="9" width="4" height="11" rx="1" /></>),
  ads: (<><path d="M4 10v4h3l7 4V6l-7 4H4Z" /><path d="M17 9a3.5 3.5 0 0 1 0 6" /></>),
  closing: (<path d="M4 4h4l2 5-2.5 1.6a11 11 0 0 0 5 5L15 13l5 2v3.5A1.5 1.5 0 0 1 18.5 21 16 16 0 0 1 3 5.5 1.5 1.5 0 0 1 4.5 4Z" />),
  script: (<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M8 4 6.5 9" /><path d="M13 4l-1.5 5" /></>),
  experiments: (<><path d="M9 3h6" /><path d="M10 3v5.5L5.4 16.8A2 2 0 0 0 7.1 20h9.8a2 2 0 0 0 1.7-3.2L14 8.5V3" /><path d="M7.5 15h9" /></>),
  whatsapp: (<path d="M21 11.5a8 8 0 0 1-11.7 7.1L4 20l1.5-5.2A8 8 0 1 1 21 11.5Z" />),
  email: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>),
  mako: (<><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M12 8.5 13.3 11 16 12l-2.7 1L12 15.5 10.7 13 8 12l2.7-1Z" /></>),
  perfil: (<><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  integraciones: (<><path d="M9 2v5M15 2v5" /><path d="M7 7h10v3.5a5 5 0 0 1-10 0V7Z" /><path d="M12 15.5V22" /></>),
  contexto: (<><path d="M5 4.5A2 2 0 0 1 7 3h11v14H7a2 2 0 0 0-2 2V4.5Z" /><path d="M5 19a2 2 0 0 0 2 2h11" /></>),
  config: (<><path d="M4 7h9M17 7h3" /><circle cx="15" cy="7" r="2" /><path d="M4 12h3M11 12h9" /><circle cx="9" cy="12" r="2" /><path d="M4 17h9M17 17h3" /><circle cx="15" cy="17" r="2" /></>),
  logout: (<><path d="M15 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8" /><path d="M17 15l3-3-3-3" /><path d="M20 12H9" /></>),
  bell: (<><path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.8 5.6 2 5.9H4c.2-.3 2-1.4 2-5.9Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  funnel: (<path d="M3 5h18l-6.5 8v5.5l-5-2.5V13L3 5Z" />),
  onboarding: (<><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9.5 4V3h5v1" /><path d="M9 11.5l2 2 4-4" /></>),
  analytics: (<><path d="M4 5v14h16" /><path d="m7 14 3-3 2.5 2 4.5-5.5" /></>),
  tools: (<><path d="M6.4 4.2a3.2 3.2 0 0 0 4.2 4.2l6.9 6.9a1.7 1.7 0 0 1-2.4 2.4l-6.9-6.9A3.2 3.2 0 0 1 4 6.6Z" /><path d="M4.2 19.8l.5-2.2 9-9 1.7 1.7-9 9-2.2.5Z" /><path d="M14.4 7.6l1.7 1.7 1.8-1.8a1.2 1.2 0 0 0-1.7-1.7Z" /></>),
  chats: (<><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h10A1.5 1.5 0 0 1 16 5.5v5A1.5 1.5 0 0 1 14.5 12H8l-4 3v-3h-.5A1.5 1.5 0 0 1 3 10.5v-5Z" /></>),
  cs: (<><circle cx="12" cy="12" r="8.5" /><path d="M8 14a5 5 0 0 0 8 0" /><path d="M9 9.7h.01" /><path d="M15 9.7h.01" /></>),
  instagram: (<><rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.4" /><circle cx="16.9" cy="7.1" r="1" /></>),
  pen: (<><path d="M4 20l3.6-.9L18.2 8.5 15.5 5.8 4.9 16.4 4 20Z" /><path d="M14 7.3 16.7 10" /></>),
  hammer: (<><path d="M13.3 4.6l6.1 6.1-2.4 2.4-6.1-6.1Z" /><path d="M14 9.9l-8.4 8.4a1.7 1.7 0 0 0 2.4 2.4l8.4-8.4" /></>),
  tag: (<><path d="M4 4.5h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-5.1 5.1a1.5 1.5 0 0 1-2.1 0L4 11.7V4.5Z" /><circle cx="8.4" cy="8.4" r="1.4" /></>),
  web: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.6 12h16.8" /><path d="M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17" /></>),
  spy: (<><path d="M5.5 11.4c1.2-3.4 3.5-4.9 6.5-4.9s5.3 1.5 6.5 4.9" /><path d="M3.4 11.7h17.2" /><circle cx="8" cy="15.8" r="2.4" /><circle cx="16" cy="15.8" r="2.4" /><path d="M10.4 15.3c1-.5 2.2-.5 3.2 0" /></>),
  video: (<><rect x="3" y="6" width="18" height="12" rx="3.2" /><path d="M10.4 9.4l4.7 2.6-4.7 2.6Z" /></>),
  dot: (<circle cx="12" cy="12" r="3" />),
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
      {PATHS[name] ?? PATHS.dot}
    </svg>
  );
}
