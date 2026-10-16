'use client';

// =============================================================================
// El avance de un chat: la barra derecha de su conversación (15/10/2026)
// =============================================================================
// Martín: «Elimina lo de "Avances y pushes", quiero que cada chat tenga arriba, en su topbar un botón para ver los
// avances, que despliegue la sidebar derecha, que sea algo similar a lo que tenemos en "offer"». Y que sea un roadmap
// «simple, épico y entendible», con el estado como el COLOR del punto (gris = no empezado), «Pedido hace» y los
// pushes en el detalle de cada nodo, y la cuenta como chip.
//
// Copiado de:
//   · la barra derecha de Offer (app/offer/PiezasRail.tsx): la tarjeta que estira hasta el alto de la conversación,
//     el título con su conteo «3/5» fijo arriba, y lo que scrollea es la LISTA; en el teléfono, la barra compacta que
//     se abre al tocarla (`BarraAvanceMovil`, la de «Tu oferta 8/13»);
//   · el panel «Project Milestones» de Linear (su doc, mirada el 15/10): un rombo por milestone que cambia según el
//     estado —el que está en curso, en amarillo—, el nombre y la fecha a la derecha. Acá cada rombo se abre en su
//     detalle, como una fila de Linear.
// Las reglas (qué es un nodo y de qué color) viven en lib/centro-chats.ts → `avanceDelChat`.

import { useId, useState } from 'react';
import { Icon } from '@/app/_components/icons';
import { ROTULO_NODO, conteoAvance, gruposDelAvance, mensajeDeCommit, nombreCuenta, type EstadoNodo, type NodoAvance } from '@/lib/centro-chats';
import { ROTULO_TIPO, diaDeNovedad, hace, pushDelCommit, type PushP } from '@/lib/progreso-reglas';

/** El rombo de Linear: vacío sin empezar, a medias en curso, lleno terminado; rojo si no salió. */
export function Rombo({ estado, size = 14 }: { estado: EstadoNodo; size?: number }) {
  const color = estado === 'hecho' ? 'var(--good)' : estado === 'en_curso' ? 'var(--warn)' : estado === 'no_salio' ? 'var(--bad)' : 'var(--faint)';
  return (
    <svg className="co-rombo" width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill={estado === 'hecho' || estado === 'no_salio' ? color : 'var(--surface)'} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {estado === 'en_curso' && <path d="M8 3.6 12.4 8 8 12.4Z" fill={color} />}
    </svg>
  );
}

function Conteo({ nodos }: { nodos: readonly NodoAvance[] }) {
  const { hechos, total } = conteoAvance(nodos);
  return (
    <span className="co-avance__conteo">
      {hechos}<span>/{total}</span>
    </span>
  );
}

/** El detalle de un nodo: el prompt textual, cuándo, en qué cuenta y lo que subió a producción. */
function Detalle({ n, pushes, ahora }: { n: NodoAvance; pushes: readonly PushP[] | null; ahora: number }) {
  const cuando = `${n.origen === 'trabajo' ? 'Lo mandaste' : 'Lo pediste'} ${hace(n.instante, ahora)}`;
  return (
    <div className="co-nodo__detalle">
      {/* Un trabajo firmado no tiene título: el suyo ES su primer renglón, y abierto ya se lee entero. */}
      {n.prompt.trim() !== n.titulo.trim() && <p className="co-nodo__prompt">{n.prompt}</p>}
      <p className="co-nodo__meta">
        <span>{cuando}</span>
        {n.cuentas.map((c) => <span key={c} className="co-chip-cuenta">{nombreCuenta(c)}</span>)}
      </p>
      {n.trabajaron.length > 0 && <p className="co-nodo__meta">{`Lo trabajó ${n.trabajaron.join(', ')}`}</p>}
      {n.pasos.length > 0 && (
        <ul className="co-nodo__pasos">
          {n.pasos.map((s, i) => (
            <li key={i}><span>{ROTULO_TIPO[s.tipo] ?? s.tipo}</span>{s.titulo}</li>
          ))}
        </ul>
      )}
      {n.cierre && <p className="co-nodo__cierre">{n.cierre}</p>}
      {n.motivo && <p className="co-nodo__motivo">{n.motivo}</p>}
      {n.commits.length > 0 && (
        <ul className="co-nodo__pushes" aria-label="Pushes">
          {n.commits.map((c) => {
            // Lo que la bitácora de la versión publicada nombra ya está en producción; con el push que lo encabeza,
            // además se sabe cuándo subió (lib/progreso-reglas.ts → pushDelCommit).
            const push = pushes ? pushDelCommit(c.sha, pushes) : null;
            return (
              <li key={c.sha}>
                <Icon name="rayo" size={13} />
                <span className="co-nodo__push-txt">{mensajeDeCommit(c.msg)}</span>
                <span className="co-nodo__push-cuando">{push ? `Subió ${hace(push.creado, ahora)}` : 'En producción'}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** La lista de nodos con una línea que los une (el roadmap): lo pendiente arriba y lo terminado abajo, cada grupo con
 *  su rótulo y lo más nuevo primero (`gruposDelAvance`). */
export function ListaAvance({ nodos, pushes, ahora }: { nodos: readonly NodoAvance[]; pushes: readonly PushP[] | null; ahora: number }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  if (!nodos.length) return <p className="co-avance__vacio">Escríbele para empezar su avance.</p>;
  return (
    <>
      {gruposDelAvance(nodos).map((g) => (
        <section key={g.clave} className="co-avance__grupo" aria-label={g.titulo}>
          <h3 className="co-avance__grupo-tit">{g.titulo}<span>{g.nodos.length}</span></h3>
          <ol className="co-avance__lista">
            {g.nodos.map((n) => {
              const abre = abierto === n.id;
              return (
                <li key={n.id} className="co-nodo" data-estado={n.estado}>
                  <button type="button" className="co-nodo__fila" aria-expanded={abre} onClick={() => setAbierto(abre ? null : n.id)}
                    aria-label={`${n.titulo}: ${ROTULO_NODO[n.estado]}`}>
                    <span className="co-nodo__rombo" title={ROTULO_NODO[n.estado]}><Rombo estado={n.estado} /></span>
                    <span className="co-nodo__titulo">{n.titulo}</span>
                    <span className="co-nodo__dia">{diaDeNovedad(n.instante, ahora)}</span>
                  </button>
                  {abre && <Detalle n={n} pushes={pushes} ahora={ahora} />}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </>
  );
}

/** La barra derecha de la computadora. Se abre con el botón «Avance» de la cabecera. */
export function RielAvance({ nodos, pushes, ahora, onCerrar }: {
  nodos: readonly NodoAvance[]; pushes: readonly PushP[] | null; ahora: number; onCerrar: () => void;
}) {
  return (
    <aside className="co-riel" aria-label="Avance">
      {/* Como la de Offer: la tarjeta estira con flex (un porcentaje contra un alto de flex da cero en Safari), y lo
          que scrollea es la lista; el título con el conteo queda fijo arriba. */}
      <div className="co-riel__tarjeta">
        <div className="co-riel__cab">
          <span className="co-riel__titulo">Avance</span>
          <Conteo nodos={nodos} />
          <button type="button" className="co-riel__cerrar" onClick={onCerrar} aria-label="Cerrar el avance" title="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="co-riel__cuerpo">
          <ListaAvance nodos={nodos} pushes={pushes} ahora={ahora} />
        </div>
      </div>
    </aside>
  );
}

/** La barra compacta del teléfono: el conteo, y la lista al tocarla (la de «Tu oferta 8/13»). */
export function BarraAvanceMovil({ nodos, pushes, ahora }: { nodos: readonly NodoAvance[]; pushes: readonly PushP[] | null; ahora: number }) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();
  return (
    <div className="co-avance-movil">
      <button type="button" className="co-avance-movil__btn" aria-expanded={abierta} aria-controls={id} onClick={() => setAbierta((v) => !v)}>
        <Icon name="todo" size={16} />
        <span>Avance</span>
        <Conteo nodos={nodos} />
        <span className="co-avance-movil__chev" aria-hidden style={{ transform: abierta ? 'rotate(180deg)' : 'none' }}><Icon name="chevron" size={16} /></span>
      </button>
      {abierta && (
        <div id={id} className="co-avance-movil__lista">
          <ListaAvance nodos={nodos} pushes={pushes} ahora={ahora} />
        </div>
      )}
    </div>
  );
}
