'use client';

// =============================================================================
// El mapa de Dev: UNA barra, y es la barra de verdad
// =============================================================================
// Dos intentos anteriores fallaron por la misma razón, y el dueño la dijo dos
// veces: «utiliza el mismo diseño que vamos a utilizar en la sidebar» y después
// «REPLICA el mismo diseño de la sidebar, no es tan difícil… Y solo UNA sidebar».
//
// El primer intento fue una lista clara con franjas de color: no se parecía en
// nada. El segundo copió los tokens de la barra a mano y quedó peor — ocho cajas
// oscuras en grilla, o sea ocho barras al lado de la barra real.
//
// Esto NO dibuja nada: monta `BarraPreview`, que es el mismo componente que el
// sistema de diseño usa para mostrar la barra, con las familias de Dev adentro.
// La advertencia ya estaba escrita arriba de ese archivo desde antes que yo
// llegara: «un catálogo que muestra un dibujo de la pieza en vez de la pieza no
// sirve para revisar nada».
//
// Y esta pantalla es justamente donde se DECIDE cómo va a quedar Dev en la barra,
// así que tiene que ser la barra o no sirve para decidir.

import { useMemo, useState } from 'react';
import { BarraPreview } from '@/app/_components/BarraPreview';
import { familiasDev, badgesDev, contadorFamiliaDev } from './nav-dev';

export type AreaVista = {
  slug: string;
  titulo: string;
  alcance: string;
  agente: boolean;
  abiertas: number;
  estado: 'listo' | 'parcial' | 'por-construir';
  nota: string;
};

export function MapaAreas({ areas, total, abiertas }: { areas: AreaVista[]; total: number; abiertas: number }) {
  const [expandida, setExpandida] = useState(true);
  const familias = useMemo(() => familiasDev(), []);
  const porSlug = useMemo(() => Object.fromEntries(areas.map((a) => [a.slug, a.abiertas])), [areas]);
  const badge = useMemo(() => badgesDev(porSlug), [porSlug]);

  const conTrampa = areas.filter((a) => a.nota);
  const porEstado = (e: AreaVista['estado']) => areas.filter((a) => a.estado === e).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 34, alignItems: 'start' }}>
      <div style={{ position: 'sticky', top: 18 }}>
        <BarraPreview
          ruta="/admin/dev"
          expandida={expandida}
          familias={familias}
          pie={false}
          navegable
          alto={640}
          contadorItem={badge}
          contadorFamilia={(k) => contadorFamiliaDev(k, porSlug)}
        />
        <button
          type="button"
          onClick={() => setExpandida((v) => !v)}
          style={{
            marginTop: 10, width: '100%', font: 'inherit', fontSize: 12.5, cursor: 'pointer',
            padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-strong)',
            background: 'var(--surface)', color: 'var(--dim)',
          }}
        >
          {expandida ? 'Ver plegada (rail)' : 'Ver desplegada'}
        </button>
      </div>

      <div style={{ minWidth: 0 }}>
        <Resumen total={total} abiertas={abiertas} porEstado={porEstado} agentes={areas.filter((a) => a.agente).length} trampas={conTrampa.length} />

        <h3 style={{ margin: '26px 0 4px', fontSize: 15, fontWeight: 640, letterSpacing: '-0.01em' }}>
          Lo que hay que mirar antes de tocar
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--dim)', maxWidth: '68ch' }}>
          {conTrampa.length} áreas tienen una trampa anotada durante el relevamiento: algo que sorprendió y
          que cuesta caro descubrir de nuevo.
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {conTrampa.map((a) => (
            <li key={a.slug} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px' }}>
              <a
                href={`/admin/dev/${a.slug}`}
                style={{ fontWeight: 580, fontSize: 13.5, color: 'inherit', textDecoration: 'none' }}
              >
                {a.titulo}
              </a>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--dim)', maxWidth: '78ch' }}>{a.nota}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Resumen({ total, abiertas, porEstado, agentes, trampas }: {
  total: number; abiertas: number; agentes: number; trampas: number;
  porEstado: (e: AreaVista['estado']) => number;
}) {
  const dato = (n: number | string, label: string, color?: string) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px' }}>
      <div style={{ fontSize: 22, fontWeight: 660, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: color ?? 'var(--ink)' }}>{n}</div>
      <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 1 }}>{label}</div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 10 }}>
      {dato(total, 'áreas')}
      {dato(porEstado('listo'), 'cerradas', 'var(--good)')}
      {dato(porEstado('parcial'), 'abiertas', 'var(--warn)')}
      {dato(porEstado('por-construir'), 'por construir', 'var(--faint)')}
      {dato(agentes, 'agentes', 'var(--mako-ink)')}
      {dato(abiertas, 'tareas del plan', 'var(--bad)')}
      {dato(trampas, 'con trampa', 'var(--mako-ink)')}
    </div>
  );
}
