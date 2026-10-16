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
import { ROTULO_NODO, VISOR_REVISAR, conteoAvance, gruposDelAvance, hrefRevisar, mensajeDeCommit, nombreCuenta, porRevisar, type ChatCentro, type EstadoNodo, type NodoAvance } from '@/lib/centro-chats';
import { ROTULO_TIPO, diaDeNovedad, hace, pushDelCommit, type PushP } from '@/lib/progreso-reglas';
import { SeccionPlan, usePlanDelChat, type PlanDelChat } from './PlanJefe';
import { proyectoDelChat } from '@/lib/centro-plan-reglas';

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
function Detalle({ n, pushes, ahora, plan }: { n: NodoAvance; pushes: readonly PushP[] | null; ahora: number; plan?: PlanDelChat }) {
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
      {/* Lo que falta se suma al Plan del jefe con un clic, sin preguntas (lib/centro-plan-reglas.ts). */}
      {plan && n.estado !== 'hecho' && n.origen !== 'derivado' && n.prompt.trim() && (
        <button type="button" className="co-nodo__plan" disabled={plan.ocupado} onClick={() => { void plan.sumar(n.prompt, true); }}>
          <Icon name="todo" size={13} />Sumar al Plan
        </button>
      )}
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
export function ListaAvance({ nodos, pushes, ahora, plan }: { nodos: readonly NodoAvance[]; pushes: readonly PushP[] | null; ahora: number; plan?: PlanDelChat }) {
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
                  {abre && <Detalle n={n} pushes={pushes} ahora={ahora} plan={plan} />}
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
/** El cuerpo con el Plan del jefe arriba: un componente aparte para que el hook corra sólo con la barra abierta. */
function ConPlan({ chat, nodos, pushes, ahora }: { chat: string; nodos: readonly NodoAvance[]; pushes: readonly PushP[] | null; ahora: number }) {
  const plan = usePlanDelChat(chat);
  return (
    <>
      <SeccionPlan chat={chat} p={plan} />
      <ListaAvance nodos={nodos} pushes={pushes} ahora={ahora} plan={plan} />
    </>
  );
}

/** El chat de la barra: su título trae el Plan de su jefe, y su clave y su sesión arman el link «Revisar». */
type ChatDeBarra = Pick<ChatCentro, 'clave' | 'sesion' | 'titulo'>;

/** Lo que el chat terminó y dejó para mirar, con «Revisar» (la sub-tab «Review»). */
function ListaReview({ nodos, chat, ahora }: { nodos: readonly NodoAvance[]; chat?: ChatDeBarra; ahora: number }) {
  if (!nodos.length) return <p className="co-avance__vacio">Nada para revisar todavía.</p>;
  return (
    <ol className="co-review">
      {nodos.map((n) => {
        const href = chat ? hrefRevisar(n, chat) : n.revisar?.pagina ?? null;
        return (
          <li key={n.id} className="co-review__fila">
            <span className="co-nodo__rombo" aria-hidden><Rombo estado="hecho" /></span>
            <span className="co-review__titulo" title={n.titulo}>{n.titulo}</span>
            <span className="co-nodo__dia">{diaDeNovedad(n.instante, ahora)}</span>
            {href && (
              <a className="co-chip co-review__ir" href={href} {...(VISOR_REVISAR ? {} : { target: '_blank', rel: 'noreferrer' })}
                aria-label={`Revisar: ${n.titulo}`}>Revisar</a>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Las dos sub-tabs de la barra (Martín, 16/10/2026, punto 6: «En "Avance" (que quiero que se llame "Plan") debería haber
 * 2 sub tab internas... "Plan", lo que está actualmente, y otra "Review"»). Copiado del control segmentado de Linear
 * (Activity / Comments): dos botones pegados, el elegido con fondo; «Review» con su número cuando hay algo.
 */
function SubTabs({ nodos, pushes, ahora, chat }: { nodos: readonly NodoAvance[]; pushes: readonly PushP[] | null; ahora: number; chat?: ChatDeBarra }) {
  const [vista, setVista] = useState<'plan' | 'review'>('plan');
  const revisar = porRevisar(nodos);
  return (
    <>
      <div className="co-subtabs" role="tablist" aria-label="Plan o Review">
        <button type="button" role="tab" aria-selected={vista === 'plan'} onClick={() => setVista('plan')}>Plan</button>
        <button type="button" role="tab" aria-selected={vista === 'review'} onClick={() => setVista('review')}>
          Review{revisar.length > 0 && <span className="co-subtabs__n">{revisar.length}</span>}
        </button>
      </div>
      {vista === 'review'
        ? <ListaReview nodos={revisar} chat={chat} ahora={ahora} />
        // `key`: el Plan de OTRO chat no se queda montado (una escritura que termina después de cambiar de chat pintaba
        // sus tareas acá, y «Marcar hecha» cerraba una del jefe anterior).
        : chat && proyectoDelChat(chat.titulo)
          ? <ConPlan key={chat.titulo} chat={chat.titulo} nodos={nodos} pushes={pushes} ahora={ahora} />
          : <ListaAvance nodos={nodos} pushes={pushes} ahora={ahora} />}
    </>
  );
}

export function RielAvance({ nodos, pushes, ahora, onCerrar, chat }: {
  nodos: readonly NodoAvance[]; pushes: readonly PushP[] | null; ahora: number; onCerrar: () => void;
  /** Con el chat, la barra trae el Plan de su jefe y arma «Revisar» (sin él, sólo el avance). */
  chat?: ChatDeBarra;
}) {
  return (
    <aside className="co-riel" aria-label="Plan">
      {/* Como la de Offer: la tarjeta estira con flex (un porcentaje contra un alto de flex da cero en Safari), y lo
          que scrollea es la lista; el título con el conteo queda fijo arriba. */}
      <div className="co-riel__tarjeta">
        <div className="co-riel__cab">
          <span className="co-riel__titulo">Plan</span>
          <Conteo nodos={nodos} />
          <button type="button" className="co-riel__cerrar" onClick={onCerrar} aria-label="Cerrar el Plan" title="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="co-riel__cuerpo">
          <SubTabs key={chat?.clave} nodos={nodos} pushes={pushes} ahora={ahora} chat={chat} />
        </div>
      </div>
    </aside>
  );
}

/** La barra compacta del teléfono: el conteo, y la lista al tocarla (la de «Tu oferta 8/13»). */
export function BarraAvanceMovil({ nodos, pushes, ahora, chat }: { nodos: readonly NodoAvance[]; pushes: readonly PushP[] | null; ahora: number; chat?: ChatDeBarra }) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();
  return (
    <div className="co-avance-movil">
      <button type="button" className="co-avance-movil__btn" aria-expanded={abierta} aria-controls={id} onClick={() => setAbierta((v) => !v)}>
        <Icon name="todo" size={16} />
        <span>Plan</span>
        <Conteo nodos={nodos} />
        <span className="co-avance-movil__chev" aria-hidden style={{ transform: abierta ? 'rotate(180deg)' : 'none' }}><Icon name="chevron" size={16} /></span>
      </button>
      {abierta && (
        <div id={id} className="co-avance-movil__lista">
          <SubTabs key={chat?.clave} nodos={nodos} pushes={pushes} ahora={ahora} chat={chat} />
        </div>
      )}
    </div>
  );
}
