'use client';

// =============================================================================
// ClienteCard — la tarjeta de un cliente, y la cabecera de su ficha
// =============================================================================
// El molde salió de una referencia que pasó el dueño el 26/09/2026: una card de perfil
// con una banda arriba, el avatar montado sobre ella, el nombre con su bajada y una fila
// de números abajo, separada por filetes. «Tal vez con menos info, claro.»
//
// Lo que se conservó y lo que no:
//   · SÍ la banda, el avatar montado, la jerarquía nombre → empresa y los números al pie
//     en columnas con filete. Es lo que hace que se lea de un vistazo.
//   · NO la foto (no tenemos una por cliente y un placeholder gris en 27 tarjetas es
//     ruido): van las INICIALES sobre un color derivado del nombre, que es estable.
//   · NO el botón de acción sobre la banda: la tarjeta ENTERA es el botón. Uno adentro
//     de otro es HTML inválido, y acá no hay dos acciones distintas que ofrecer.
//   · NO la barra de «exp.» multicolor: no mide nada que tengamos.
//
// ⚠️ LOS TRES NÚMEROS SON LOS DEL TABLERO y no unos inventados para llenar la fila.
// Proyectos · abiertas · se repiten es exactamente lo que la ficha va a mostrar al
// abrirse, así que la tarjeta no puede prometer algo que adentro no está.

import type { ClienteCruce } from './cruce';
import type { ResumenTrabajo } from './trabajo';

/** Nombre → color estable. El mismo cliente tiene siempre el mismo, en cualquier
 *  pantalla y en cualquier orden de la lista: un color que baila es ruido. */
export function colorDe(nombre: string): string {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 46%)`;
}

/** Las iniciales, como en la ficha del CRM: una o dos letras. */
export function inicialesDe(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[1][0]).toUpperCase();
}

export function Avatar({ nombre, tam = 44 }: { nombre: string; tam?: number }) {
  const c = colorDe(nombre);
  return (
    <span aria-hidden className="cl-av" style={{
      width: tam, height: tam, background: `color-mix(in srgb, ${c} 16%, var(--surface))`,
      color: c, fontSize: Math.round(tam * 0.36),
    }}>{inicialesDe(nombre)}</span>
  );
}

export function ClienteCard({ c, n, trabajo, tableroOk, onAbrir }: {
  c: ClienteCruce;
  /** Su número de cliente: «Cliente 1». No es el id del lead — ver `NumeroCliente`. */
  n: number;
  trabajo: ResumenTrabajo | null;
  tableroOk: boolean;
  onAbrir: () => void;
}) {
  const nombre = c.nombre.trim() || 'Sin nombre';
  const color = colorDe(nombre);

  return (
    <button className="cl-card" onClick={onAbrir}>
      {/* La banda no lleva imagen: un degradado del color del cliente. Es lo que hace que
          la grilla se lea como una grilla de personas y no como una tabla. */}
      <span className="cl-banda" aria-hidden style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 26%, var(--surface)), color-mix(in srgb, ${color} 7%, var(--surface)))`,
      }} />
      <span className="cl-avwrap"><Avatar nombre={nombre} /></span>

      <span className="cl-n">{nombre}</span>
      <span className="cl-e">{c.empresa?.trim() || `Cliente ${n}`}</span>

      <span className="cl-sp" />

      {/* ⚠️ LOS TRES NÚMEROS O NINGUNO. Cuando el tablero no se pudo leer, poner ceros
          sería afirmar que no tiene trabajo — que es distinto de no haber podido mirar. */}
      {tableroOk ? (
        <span className="cl-nums">
          <Num v={trabajo?.proyectos ?? 0} k="Proyectos" />
          <Num v={trabajo?.abiertas ?? 0} k="Abiertas" />
          <Num v={trabajo?.recurrentes ?? 0} k="Se repiten" />
        </span>
      ) : (
        <span className="cl-pie">No pude leer el tablero</span>
      )}
    </button>
  );
}

function Num({ v, k }: { v: number; k: string }) {
  return (
    <span className="cl-num">
      <span className={`v${v === 0 ? ' cero' : ''}`}>{v}</span>
      <span className="k">{k}</span>
    </span>
  );
}

export const CSS_CLIENTE = `
.cl-card{ position:relative; display:flex; flex-direction:column; width:100%;
  background:var(--surface); border:1px solid var(--border); border-radius:18px;
  padding:0 0 0; overflow:hidden; cursor:pointer; text-align:left; font:inherit;
  color:inherit; min-height:214px; transition:border-color .12s, box-shadow .12s; }
.cl-card:hover{ border-color:var(--border-strong); box-shadow:0 6px 18px rgba(18,21,27,.06); }
.cl-card:focus-visible{ outline:none; box-shadow:var(--focus-ring); }

.cl-banda{ display:block; height:64px; width:100%; }
/* El avatar MONTADO sobre la banda, como en la referencia: medio adentro y medio afuera.
   El margen negativo es la mitad de su alto, y el anillo lo despega del degradado. */
.cl-avwrap{ display:block; margin:-22px 0 0 16px; }
.cl-av{ display:inline-flex; align-items:center; justify-content:center; border-radius:999px;
  font-weight:700; letter-spacing:.02em; box-shadow:0 0 0 3px var(--surface); }

.cl-n{ display:block; margin:10px 16px 0; font-size:15.5px; font-weight:640;
  letter-spacing:-.01em; line-height:1.25; color:var(--ink); overflow-wrap:anywhere; }
.cl-e{ display:block; margin:2px 16px 0; font-size:12.5px; color:var(--faint);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cl-sp{ flex:1; min-height:12px; }

/* Los números al pie, en columnas con filete — el remate de la referencia. */
.cl-nums{ display:grid; grid-template-columns:repeat(3,1fr); border-top:1px solid var(--border); }
.cl-num{ display:flex; flex-direction:column; align-items:center; gap:1px; padding:9px 4px 10px;
  border-left:1px solid var(--border); }
.cl-num:first-child{ border-left:0; }
.cl-num .v{ font-size:16px; font-weight:680; letter-spacing:-.02em; color:var(--ink);
  font-variant-numeric:tabular-nums; line-height:1.1; }
/* Un cero no grita: es el estado normal de un cliente al que todavía no se le asignó nada. */
.cl-num .v.cero{ color:var(--faint); font-weight:560; }
.cl-num .k{ font-size:10.5px; color:var(--faint); }

.cl-pie{ display:block; padding:10px 16px 12px; border-top:1px solid var(--border);
  font-size:11.5px; color:var(--bad); }

@media(prefers-reduced-motion:reduce){ .cl-card{ transition:none; } }
`;
