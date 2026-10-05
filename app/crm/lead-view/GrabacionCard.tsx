'use client';

// =============================================================================
// GrabacionCard — las grabaciones de ESTA persona, dentro de MaKo
// =============================================================================
// Va DESPUÉS de «Actividad registrada» y ANTES de «Fuera de MaKo»: es lo nuestro,
// y lo externo sigue último (el orden de las secciones lo decidió Martín el
// 05/10/2026 y no se toca).
//
// ⚠️ EL VACÍO NO ACUSA A NADIE, y es la mitad del trabajo de esta tarjeta. Durante
// semanas el estado normal va a ser «no hay», y «sin grabación» a secas se lee como
// que el producto no mide — igual que el botón de Clarity sobre un lead de hace tres
// meses, que ya se pagó una vez. Las seis causas y su frase viven en
// `lib/replay-ficha.ts`, puras y con test; acá sólo se dibujan.
//
// ⚠️ Y LA PANTALLA NO INVENTA DÓNDE SE ARREGLA. Sólo `pixel_viejo` lleva link, que
// es el único caso con una pantalla que de verdad lo resuelve. El interruptor
// `landing.replay` todavía no tiene UI, así que su frase no lleva botón: un botón
// que lleva a un lugar donde no está la respuesta es peor que ninguno.

import { useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { duracionCorta, textoDelCorte, textoDelVacio, type ReplayEnLaFicha, type SesionDeLead } from '@/lib/replay-ficha';
import { GrabacionModal } from './GrabacionModal';
import { useTzWorkspace } from './useTzWorkspace';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const fmtTs = (iso: string, tz: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  }).format(d).replace(',', ' ·');
};

/**
 * Un renglón por sesión: la regla de la casa para un grupo de cosas del mismo tipo
 * es una LISTA con filete, no una pila de cajas.
 */
function Fila({ s, tz, onVer }: { s: SesionDeLead; tz: string; onVer: () => void }) {
  const corte = textoDelCorte(s.corte);
  // Una sesión sin sellar no se puede abrir: su cuerpo todavía está en el buffer
  // caliente y no en un objeto. Decirlo evita un botón que contesta un error.
  const sub = s.lista ? corte : 'Se está guardando';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'nowrap', padding: '11px 2px 12px', borderTop: '1px solid var(--border)' }}>
      <div style={{ flex: '0 1 auto', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fmtTs(s.inicio, tz)}
          <span style={{ marginLeft: 8, fontFamily: MONO, fontSize: 11.5, fontWeight: 500, color: 'var(--faint)' }}>{duracionCorta(s.segundos)}</span>
        </div>
        {/* ⚠️ EL SEGUNDO RENGLÓN SÓLO EXISTE SI TIENE ALGO QUE DECIR. Lo que
            distingue una sesión de otra son la fecha y la duración, que ya están
            arriba; el número de eventos de rrweb no le dice nada a nadie y ocupa
            el lugar de la única cosa que sí hay que decir: que la cortamos
            nosotros, o que todavía no se puede abrir. */}
        {sub && (
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub}
          </div>
        )}
      </div>
      <div style={{ flex: 'none', marginLeft: 'auto' }}>
        {s.lista && (
          <button type="button" onClick={onVer}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 9, cursor: 'pointer',
              border: '1px solid var(--border-strong)', background: 'var(--surface-2)', font: 'inherit',
              fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
            Ver la grabación
          </button>
        )}
      </div>
    </div>
  );
}

export function GrabacionCard({ replay }: { replay: ReplayEnLaFicha }) {
  const tz = useTzWorkspace();
  const [abierta, setAbierta] = useState<SesionDeLead | null>(null);

  // ⚠️ `sin_visitor` NO DIBUJA NADA, y es lo único que esta tarjeta se calla: la
  // tarjeta de arriba ya lo dice en esa misma ficha («ingresó antes de que existiera
  // la medición… No hay forma de reconstruirlo»), así que una sección más repitiendo
  // lo mismo es la ficha mostrando dos veces el mismo vacío. La causa sigue viva en
  // `motivoDelVacio` —es un dato del lead, no un detalle de pantalla— y es la única
  // que no se arregla en ningún lado.
  if (replay.vacio === 'sin_visitor') return null;

  const vacio = replay.vacio ? textoDelVacio(replay.vacio, replay.retencionDias) : null;

  return (
    <>
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: vacio ? 8 : 4 }}>Grabación de su visita</div>
        {vacio ? (
          <p style={{ fontSize: 13.5, color: 'var(--faint)', margin: 0, lineHeight: 1.5 }}>
            {vacio.que}
            {vacio.donde && (
              <>
                {' '}
                <Link href={vacio.donde.href} style={{ fontWeight: 600, color: 'var(--primary)' }}>{vacio.donde.texto}</Link>
              </>
            )}
          </p>
        ) : (
          replay.sesiones.map((s) => <Fila key={s.id} s={s} tz={tz} onVer={() => setAbierta(s)} />)
        )}
      </section>

      {abierta && <GrabacionModal sesion={abierta} onCerrar={() => setAbierta(null)} />}
    </>
  );
}
