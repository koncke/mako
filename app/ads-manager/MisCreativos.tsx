'use client';

// =============================================================================
// MisCreativos — elegir un video que MaKo ya generó, adentro de «Subir creativos» (18/11/2026, F100 punto 1)
// =============================================================================
// COPIADO de «Mis creativos» del Ads Manager de antes (app/ads-manager/MisCreativosMako.tsx, tarea #797, borrado con la
// réplica de Meta Ads Manager el 27/10 en 0c9383b83): la misma puerta, los mismos dos grupos (anuncios montados y tomas
// sueltas, por anuncio), la misma tarjeta con un cuadro del video y el mismo vacío. Lo que cambia es de dónde salen los
// videos: ya no los pide este componente, los trae `subir_preparar` (`generados`), que es lo que el modal ya leía.
//
// Lo que hace al elegir es del modal (`onElegir`): acá sólo se lista y se muestra. La url sirve para la vista previa; al
// servidor vuelve únicamente la `ref`. ⚠️ Sólo `import type` de lib/creativo-mako: la frontera de 'use client' es de datos.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { Spinner } from '@/app/_ui/Feedback';
import type { CreativoMako } from '@/lib/creativo-mako';
import { agruparGenerados, nombreDeGenerado } from './subir-generados';

const MONO = "'Geist Mono', monospace";
const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', margin: '0 0 6px' };

/**
 * `generados`: null mientras se lee la cuenta. `aviso`: lo que dijo el servidor si no pudo leerlos (subir del disco sigue
 * andando). `elegidos`: las `ref` que ya están en la lista, que se apagan (el mismo video dos veces son dos anuncios iguales).
 */
export function MisCreativos({ generados, aviso, elegidos, onElegir }: {
  generados: readonly CreativoMako[] | null;
  aviso: string | null;
  elegidos: ReadonlyArray<string>;
  onElegir: (c: CreativoMako) => void;
}) {
  if (aviso) return <p style={{ fontSize: 13, color: 'var(--bad)', margin: 0, lineHeight: 1.45 }}>{aviso}</p>;
  if (!generados) return <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0', color: 'var(--dim)' }}><Spinner size={18} /></div>;
  const { montados, anuncios } = agruparGenerados(generados);
  if (!montados.length && !anuncios.length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--dim)', margin: 0, lineHeight: 1.45 }}>
        Todavía no hay videos de MaKo. <Link href="/video-generator" style={{ color: 'var(--primary-strong)', fontWeight: 600 }}>Crear uno</Link>
      </p>
    );
  }
  const yaEsta = (c: CreativoMako) => elegidos.includes(c.ref);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto', width: '100%' }}>
      {montados.length > 0 && (
        <div>
          <p style={rotulo}>Anuncios montados</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {montados.map((c) => <Tarjeta key={c.ref} c={c} pie={c.titulo} apagada={yaEsta(c)} onElegir={onElegir} />)}
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
  const nombre = nombreDeGenerado(c);
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
 * Un cuadro del video, pedido recién cuando la tarjeta entra en la vista: con diez anuncios de doce tomas serían cien pedidos
 * de golpe al abrir el panel.
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
      {/* `#t=0.5`: el navegador muestra ese cuadro en vez de uno negro. */}
      {ver && <video src={`${url}#t=0.5`} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />}
    </div>
  );
}
