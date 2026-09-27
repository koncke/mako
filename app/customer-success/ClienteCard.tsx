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
import { fondoPortada } from '@/lib/portadas';
import { Marca } from '@/app/_components/Marca';

/** Nombre → color estable. El mismo cliente tiene siempre el mismo, en cualquier
 *  pantalla y en cualquier orden de la lista: un color que baila es ruido. */
export function colorDe(nombre: string): string {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 46%)`;
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
      {/* LA BANDA ES SU PORTADA (mig 0173): un degradado del catálogo, una foto, o —el
          default— el degradado derivado de su nombre, que es lo que se veía antes. La
          decisión de qué pintar vive en `fondoPortada` y no acá: la misma banda se dibuja
          en la ficha, y dos copias de esta regla divergen en el primer cambio. */}
      {/* ⚠️ EL TERCER ARGUMENTO ES EL ENCUADRE, y faltaba: `portadaY` (mig 0174) está
          leído, tipado, guardado y respetado por los otros TRES call-sites de
          `fondoPortada`. Sin él la tarjeta centraba la foto mientras la ficha la
          mostraba donde el dueño la había dejado — reposicionar «no hacía nada» en
          la grilla, que es donde se mira. */}
      <span className="cl-banda" aria-hidden style={{ background: fondoPortada(c.portada, color, c.portadaY) }} />
      {/* ⚠️ Y ACÁ VA `Marca`, NO UN AVATAR PROPIO, por lo mismo del otro lado: el
          `Avatar` local sólo sabe de fotos, así que la tarjeta ignoraba el ÍCONO y
          el encuadre del redondel. Elegías un ícono para un cliente y aparecía en su
          ficha y en la tabla —las dos dibujan `Marca`— y no en la grilla.
          El anillo que lo despega de la banda se mudó a `.cl-avwrap`: es del hueco,
          no de la marca, y así `Marca` sigue siendo la misma en todas partes. */}
      <span className="cl-avwrap"><Marca icono={c.icono ?? c.avatarUrl} nombre={nombre} tam={44} y={c.avatarY} color={color} /></span>

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

.cl-banda{ display:block; height:74px; width:100%; }
/* El avatar MONTADO sobre la banda, como en la referencia: medio adentro y medio afuera.
   El margen negativo es la mitad de su alto, y el anillo lo despega del degradado. */
.cl-avwrap{ display:block; width:fit-content; margin:-22px 0 0 16px;
  border-radius:999px; box-shadow:0 0 0 3px var(--surface); }

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
