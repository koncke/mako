'use client';

// =============================================================================
// La Sidebar y el set de íconos, dentro del sistema de diseño
// =============================================================================
// NADA DE ESTO ESTÁ ESCRITO ACÁ. La barra es el componente de verdad
// (`BarraPreview`, que usa las mismas piezas que `Sidebar`) y la tabla sale de
// `nav.ts`. Si mañana se renombra una tab y nadie toca este archivo, acá se ve
// el nombre nuevo.

import { useState } from 'react';
import { Section, Tabs, MONO } from '@/app/_ui';
import { BarraPreview } from '@/app/_components/BarraPreview';
import { FAMILIAS, MAKO_NAV, USER_NAV, ADMIN_NAV, ADMIN_FAMILIAS, type NavItem } from '@/app/_components/nav';
import { Icon, NOMBRES_ICONO } from '@/app/_components/icons';

// ── La barra ─────────────────────────────────────────────────────────────────
/** Las rutas que se pueden previsualizar. Una por familia, para ver el activo. */
const RUTAS = [
  { id: '/general', label: 'Operate' },
  { id: '/second-brain', label: 'Analyze' },
  { id: '/landing-generator', label: 'Sales Machine' },
  { id: '/ideas', label: 'Content Machine' },
];

export function LaSidebar() {
  const [ruta, setRuta] = useState('/general');
  const [abierta, setAbierta] = useState(true);

  return (
    <>
      <Section titulo="Sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>Parado en</span>
          {RUTAS.map((r) => (
            <button key={r.id} type="button" className="mk-tab" data-activo={ruta === r.id}
              onClick={() => setRuta(r.id)}
              style={{ border: '1px solid var(--border)', background: ruta === r.id ? 'var(--surface-2)' : 'transparent', borderRadius: 999, padding: '5px 12px', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: ruta === r.id ? 600 : 500, cursor: 'pointer' }}>
              {r.label}
            </button>
          ))}
          <button type="button" className="mk-tab"
            onClick={() => setAbierta((v) => !v)}
            style={{ marginLeft: 'auto', border: '1px solid var(--border)', background: 'transparent', borderRadius: 999, padding: '5px 12px', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 500, cursor: 'pointer' }}>
            {abierta ? 'Ver plegada' : 'Ver desplegada'}
          </button>
        </div>

        {/* El fondo claro es el de la app: la barra se mira SOBRE el contenido,
            no sobre un lienzo neutro. Ahí es donde se ve si contrasta. */}
        {/* `flex-start`, no el `stretch` por defecto: si no, la barra se estira
            a lo alto de la tabla de destinos —1.800 px— y deja de parecerse a
            una barra. La tabla es lo que scrollea; la barra se queda quieta. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 22, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 22 }}>
          <div style={{ position: 'sticky', top: 22, flex: 'none' }}>
            <BarraPreview ruta={ruta} expandida={abierta} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            <TablaDestinos ruta={ruta} />
          </div>
        </div>
      </Section>
    </>
  );
}

/** Cada destino con su ruta y su `key`. La key es contrato: se escribe en base. */
function TablaDestinos({ ruta }: { ruta: string }) {
  const filas: { grupo: string; items: NavItem[] }[] = [
    ...FAMILIAS.map((f) => ({
      grupo: f.label,
      items: [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)],
    })),
    { grupo: 'Detrás del avatar', items: [...MAKO_NAV, ...USER_NAV] },
    // Solo en el shell de super admin, y ahora son dos familias más (Admin y
    // Dev) en vez de una lista aparte: se leen de ADMIN_FAMILIAS igual que las
    // de producto se leen de FAMILIAS.
    ...ADMIN_FAMILIAS.map((f) => ({
      grupo: `${f.label} · solo super admin`,
      items: [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)],
    })),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {filas.map((f) => (
        <div key={f.grupo}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600, marginBottom: 6 }}>
            {f.grupo} · {f.items.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {f.items.map((it) => {
              const on = it.match(ruta);
              return (
                <div key={it.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr) auto', gap: 12, alignItems: 'center', padding: '5px 8px', borderRadius: 'var(--r-sm)', background: on ? 'var(--primary-bg)' : 'transparent' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--ink)', fontWeight: on ? 600 : 400, minWidth: 0 }}>
                    <span style={{ display: 'flex', flex: 'none', color: 'var(--faint)' }}><Icon name={it.icon} size={15} /></span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
                  </span>
                  <code style={{ fontFamily: MONO, fontSize: 11, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.href}</code>
                  <code style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>
                    {it.key}{it.comingSoon ? ' · pronto' : ''}
                  </code>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--dim)', lineHeight: 1.55 }}>
        La tercera columna es la <code style={{ fontFamily: MONO }}>key</code>, y es un <strong style={{ color: 'var(--ink)' }}>contrato</strong>:
        se escribe en base para las capas y para el onboarding de cada tab. El nombre y la ruta se pueden cambiar; la key no.
      </p>
    </div>
  );
}

// ── Los íconos ───────────────────────────────────────────────────────────────
function Ficha({ name, uso }: { name: string; uso?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', minWidth: 0 }}>
      <span style={{ display: 'flex', flex: 'none', color: 'var(--ink)' }}><Icon name={name} size={20} /></span>
      <span style={{ minWidth: 0 }}>
        <code style={{ display: 'block', fontFamily: MONO, fontSize: 11, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</code>
        {uso && <span style={{ display: 'block', fontSize: 'var(--fs-meta)', color: 'var(--dim)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{uso}</span>}
      </span>
    </div>
  );
}

function Grilla({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(184px, 1fr))', gap: 8 }}>{children}</div>;
}

export function LosIconos() {
  // Los que ya tienen un puesto en la barra, agrupados como en la barra.
  const enBarra = new Set<string>();
  const grupos = [
    ...FAMILIAS.map((f) => ({
      titulo: f.label,
      items: [
        { name: f.icon, uso: `${f.label} · la sección` },
        ...(f.grupos ?? []).map((g) => ({ name: g.icon, uso: `${g.label} · el desplegable` })),
        ...f.bloques.flat().map((i) => ({ name: i.icon, uso: i.label })),
        ...(f.grupos ?? []).flatMap((g) => g.items.map((i) => ({ name: i.icon, uso: i.label }))),
      ],
    })),
    {
      titulo: 'Detrás del avatar y administración',
      items: [...MAKO_NAV, ...USER_NAV, ...ADMIN_NAV].map((i) => ({ name: i.icon, uso: i.label })),
    },
  ].map((g) => {
    const items = g.items.filter((i) => { if (enBarra.has(i.name)) return false; enBarra.add(i.name); return true; });
    return { ...g, items };
  });

  const sueltos = NOMBRES_ICONO.filter((n) => !enBarra.has(n));

  return (
    <>
      {grupos.map((g) => (
        <Section key={g.titulo} titulo={g.titulo}>
          <Grilla>{g.items.map((i) => <Ficha key={i.name} name={i.name} uso={i.uso} />)}</Grilla>
        </Section>
      ))}
      <Section titulo="El resto del set" nota={`${sueltos.length} que no están en la barra: acciones, estados y controles`}>
        <Grilla>{sueltos.map((n) => <Ficha key={n} name={n} />)}</Grilla>
      </Section>
      <Section titulo="Dos trazos conviviendo">
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {['crm', 'analytics', 'whatsapp', 'search'].map((n) => <Icon key={n} name={n} size={24} />)}
            <code style={{ fontFamily: MONO, fontSize: 11, color: 'var(--dim)' }}>línea</code>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {['sales', 'cerebro', 'meta', 'roleplay'].map((n) => <Icon key={n} name={n} size={24} />)}
            <code style={{ fontFamily: MONO, fontSize: 11, color: 'var(--dim)' }}>macizo</code>
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--dim)', lineHeight: 1.55 }}>
          Los nuevos vinieron macizos y los originales son de línea. Conviven porque casi nunca caen en la misma
          columna, pero es una decisión pendiente: o se migra el set entero a macizo, o los nuevos se pasan a línea.
          Todos se normalizaron por su <strong style={{ color: 'var(--ink)' }}>caja de tinta</strong>, no por su lienzo —
          si no, dos dibujos con el mismo tamaño de archivo se ven de tamaños distintos en la misma fila.
        </p>
      </Section>
    </>
  );
}
