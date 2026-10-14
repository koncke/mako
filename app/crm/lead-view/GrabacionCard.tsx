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
// meses, que ya se pagó una vez. Las siete causas y su frase viven en
// `lib/replay-ficha.ts`, puras y con test; acá sólo se dibujan.
//
// ⚠️ Y LA PANTALLA NO INVENTA DÓNDE SE ARREGLA. Cada frase lleva link sólo si hay
// una pantalla que de verdad lo resuelve: `pixel_viejo` (repegar el código). Un
// botón que lleva a un lugar donde no está la respuesta es peor que ninguno.
//
// ⚠️ LA GRABACIÓN SE VE ACÁ ADENTRO, debajo de su fila, y no en un pop-up (pedido de
// Martín del 14/10/2026: «que viva dentro de la sección "Grabación de su visita" en
// tracking»). Una abierta a la vez: abrir otra pliega la anterior, y el botón de la
// fila abierta se vuelve la X que la pliega. Es el MISMO `<button>` en los dos estados,
// a propósito: React lo reusa y el foco se queda donde estaba al plegarla.

import { Fragment, useState, type CSSProperties } from 'react';
import Link from '@/app/_ui/Link';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { duracionCorta, textoDelCorte, textoDelVacio, type ReplayEnLaFicha, type SesionDeLead } from '@/lib/replay-ficha';
import { GrabacionEnLinea } from './GrabacionModal';
import { useTzWorkspace } from './useTzWorkspace';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const botonVer: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 9, cursor: 'pointer',
  border: '1px solid var(--border-strong)', background: 'var(--surface-2)', font: 'inherit',
  fontSize: 12, fontWeight: 600, color: 'var(--ink)',
};

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
function Fila({ s, tz, abierta, onAlternar }: { s: SesionDeLead; tz: string; abierta: boolean; onAlternar: () => void }) {
  const corte = textoDelCorte(s.corte);
  // Una sesión sin sellar no se puede abrir: su cuerpo todavía está en el buffer
  // caliente y no en un objeto. Decirlo evita un botón que contesta un error.
  const sub = s.lista ? corte : 'Se está guardando';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap', padding: '11px 2px 12px', borderTop: '1px solid var(--border)' }}>
      <div style={{ flex: '0 1 auto', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fmtTs(s.inicio, tz)}
          <span style={{ marginLeft: 8, fontFamily: MONO, fontSize: 11.5, fontWeight: 500, color: 'var(--faint)' }}>{duracionCorta(s.segundos)}</span>
        </div>
        {/* ⚠️ EL SEGUNDO RENGLÓN SÓLO EXISTE SI TIENE ALGO QUE DECIR. Lo que
            distingue una sesión de otra son la fecha y la duración, que ya están
            arriba; el número de eventos de rrweb no le dice nada a nadie y ocupa
            el lugar de la única cosa que sí hay que decir: que la cortamos
            nosotros, o que todavía no se puede abrir. Con la grabación abierta,
            es además el aviso del corte: queda justo encima del reproductor. */}
        {sub && (
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub}
          </div>
        )}
      </div>
      <div style={{ flex: 'none', marginLeft: 'auto' }}>
        {s.lista && (
          <button type="button" onClick={onAlternar} aria-expanded={abierta}
            className={abierta ? 'mk-iconbtn mk-iconbtn--sm' : undefined}
            title={abierta ? 'Cerrar la grabación' : undefined}
            aria-label={abierta ? 'Cerrar la grabación' : undefined}
            style={abierta ? undefined : botonVer}>
            {abierta ? <IconoMenu nombre="cerrar" size={15} /> : 'Ver la grabación'}
          </button>
        )}
      </div>
    </div>
  );
}

export function GrabacionCard({ replay }: { replay: ReplayEnLaFicha }) {
  const tz = useTzWorkspace();
  // El id y no la sesión: si la lista se vuelve a leer, la abierta sigue abierta, y si
  // desaparece, el reproductor se va con ella.
  const [abierta, setAbierta] = useState<string | null>(null);

  // ⚠️ `sin_visitor` NO DIBUJA NADA, y es lo único que esta tarjeta se calla: la
  // tarjeta de arriba ya lo dice en esa misma ficha («ingresó antes de que existiera
  // la medición… No hay forma de reconstruirlo»), así que una sección más repitiendo
  // lo mismo es la ficha mostrando dos veces el mismo vacío. La causa sigue viva en
  // `motivoDelVacio` —es un dato del lead, no un detalle de pantalla— y es la única
  // que no se arregla en ningún lado.
  if (replay.vacio === 'sin_visitor') return null;

  // La fecha de su visita va en la zona del negocio, la misma de las otras tarjetas.
  const vacio = replay.vacio ? textoDelVacio(replay.vacio, replay.retencionDias, replay.visita, tz) : null;

  return (
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
        replay.sesiones.map((s) => (
          <Fragment key={s.id}>
            <Fila s={s} tz={tz} abierta={abierta === s.id}
              onAlternar={() => setAbierta((a) => (a === s.id ? null : s.id))} />
            {/* `key` por sesión: abrir otra es otro reproductor, con su descarga y su
                montaje desde cero, nunca el anterior con otros eventos. */}
            {abierta === s.id && s.lista && <GrabacionEnLinea key={s.id} sesion={s} />}
          </Fragment>
        ))
      )}
    </section>
  );
}
