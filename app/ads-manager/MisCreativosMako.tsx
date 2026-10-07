'use client';

// =============================================================================
// MisCreativosMako — elegir un video que MaKo ya generó (tarea #797)
// =============================================================================
// La tercera puerta de los tres modales del anuncio, al lado de «Subir creativo» y «Usar
// un ganador». Primero los anuncios MONTADOS (lo que se pensó para publicar) y después
// las TOMAS sueltas, cada grupo con su rótulo.
//
// Lo que hace al elegir es del modal (`onElegir`): acá sólo se lista y se muestra. La url
// de cada video sirve para la vista previa; al server vuelve únicamente su `ref`.
//
// ⚠️ Sólo `import type` de lib/creativo-mako: la frontera de 'use client' es de datos.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { Spinner } from '@/app/_ui/Feedback';
import { listarCreativosMako, type MisCreativos } from './creativeUpload';
import type { CreativoMako } from '@/lib/creativo-mako';

const MONO = "'Geist Mono', monospace";
const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', margin: '0 0 6px' };

/**
 * `elegidos`: las `ref` que ya están en la bandeja. En Nueva campaña entran varios, y el
 * mismo video dos veces son dos videos en la biblioteca de la cuenta (Meta no deduplica
 * por url) y dos anuncios iguales: el ya elegido se apaga.
 */
export function MisCreativosMako({ onElegir, elegidos = [] }: { onElegir: (c: CreativoMako) => void; elegidos?: ReadonlyArray<string> }) {
  const [datos, setDatos] = useState<MisCreativos | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    listarCreativosMako(ctl.signal)
      .then((d) => { if (!ctl.signal.aborted) setDatos(d); })
      .catch((e: unknown) => { if (!ctl.signal.aborted) setErr(e instanceof Error ? e.message : String(e)); });
    return () => ctl.abort();
  }, []);

  if (err) return <p style={{ fontSize: 13, color: 'var(--bad)', margin: 0, lineHeight: 1.45 }}>{err}</p>;
  if (!datos) return <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0', color: 'var(--dim)' }}><Spinner size={18} /></div>;
  if (!datos.montados.length && !datos.tomas.length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--dim)', margin: 0, lineHeight: 1.45 }}>
        Todavía no hay videos de MaKo. <Link href="/video-generator" style={{ color: 'var(--primary-strong)', fontWeight: 600 }}>Crear uno</Link>
      </p>
    );
  }

  // Las tomas, agrupadas por el anuncio del que salen (vienen en orden).
  const anuncios: Array<{ plan: string; titulo: string; tomas: CreativoMako[] }> = [];
  for (const t of datos.tomas) {
    const g = anuncios[anuncios.length - 1];
    if (g && g.plan === t.plan_id) g.tomas.push(t);
    else anuncios.push({ plan: t.plan_id, titulo: t.titulo, tomas: [t] });
  }
  const yaEsta = (c: CreativoMako) => elegidos.includes(c.ref);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto', width: '100%' }}>
      {datos.montados.length > 0 && (
        <div>
          <p style={rotulo}>Anuncios montados</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {datos.montados.map((c) => <Tarjeta key={c.ref} c={c} pie={c.titulo} apagada={yaEsta(c)} onElegir={onElegir} />)}
          </div>
        </div>
      )}
      {anuncios.length > 0 && (
        <div>
          <p style={rotulo}>Tomas sueltas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {anuncios.map((a) => (
              <div key={a.plan}>
                <p style={{ fontSize: 12.5, color: 'var(--dim)', margin: '0 0 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.titulo}>{a.titulo}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {a.tomas.map((c) => <Tarjeta key={c.ref} c={c} pie={`Toma ${c.toma}`} apagada={yaEsta(c)} onElegir={onElegir} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ c, pie, apagada, onElegir }: { c: CreativoMako; pie: string; apagada: boolean; onElegir: (c: CreativoMako) => void }) {
  const nombre = c.toma != null ? `${c.titulo} · toma ${c.toma}` : c.titulo;
  return (
    <button type="button" disabled={apagada} onClick={() => onElegir(c)} title={apagada ? `${nombre} (ya elegido)` : nombre} aria-label={nombre}
      style={{ width: 64, padding: 0, border: 'none', background: 'transparent', cursor: apagada ? 'not-allowed' : 'pointer', opacity: apagada ? 0.4 : 1, textAlign: 'left', flex: 'none' }}>
      <div style={{ width: 64, height: 86, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)' }}>
        <VistaPrevia url={c.url} />
      </div>
      <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, lineHeight: 1.25, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pie}</span>
    </button>
  );
}

/**
 * Un frame del video, pedido recién cuando la tarjeta entra en la vista: con diez
 * anuncios de doce tomas serían cien pedidos de golpe al abrir el panel.
 */
function VistaPrevia({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ver, setVer] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVer(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setVer(true); io.disconnect(); } }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: '100%', height: '100%' }}>
      {/* `#t=0.5`: el navegador muestra ese frame en vez de un cuadro negro. */}
      {ver && <video src={`${url}#t=0.5`} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />}
    </div>
  );
}
