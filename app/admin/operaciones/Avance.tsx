'use client';

// =============================================================================
// El «Ya está» de un chat como un mensaje bien diseñado, y sus tareas del Plan (17/10/2026, la C y la D)
// =============================================================================
// Martín (feedback del 17/10): «"Review" y "En el Plan" SE VAN. En su lugar, cada "Ya está" es un MENSAJE muy bien
// diseñado en la conversación», con qué cambió, los links a dónde revisar, una forma fácil de darle feedback ahí mismo y
// la TARJETA del Plan, clickeable. Y el Plan desde el chat: «en el "+", "Tareas vinculadas (N)" trae las tareas del
// chat... nada de desplegables: tocar un ítem trae el mensaje bien diseñado que ya se mandó».
//
// Hasta el 17/10 esto era la barra derecha del avance (el roadmap con rombos de Linear, las sub-tabs «Plan» y «Review» y
// la sección «En el Plan»). Lo que se quedó: el link de «Revisar» sale de `destinoDeReview` (la página que dejó el chat, o
// la tab de su área), con las tabs en el MISMO orden que tabs.ts. El Plan de cada chat se arma solo con el «Voy a
// trabajar en…» y el «Ya está» (lib/centro-plan-auto-reglas.ts): la tarjeta del Plan de un «Ya está» es la tarea que
// ese mensaje marcó hecha.
// Copiado de las tarjetas de «tarea completada» de Linear y de los mensajes con acciones de Slack: un sello, el título,
// el detalle, los links como botones y la acción de responder al pie.

import { useState } from 'react';
import Link from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { ADMIN_NAV, MAKO_NAV, TODOS_LOS_ITEMS } from '@/app/_components/nav';
import { Markdown, conFormato } from '@/app/_components/Markdown';
import { listasEnRenglones } from '@/lib/respuesta-como-claude';
import { CUERPO_PLEGABLE, cortadoPorLaPC, destinoDeReview, partesDeYaEsta, partirPendiente, tieneCheck, nodoDeCompletado, type ChatCentro } from '@/lib/centro-chats';
import { ROTULO_TAREA, type TareaDelChat } from '@/lib/centro-plan-auto-reglas';
import type { TurnoChat } from '@/lib/operaciones-reglas';

/**
 * Las tabs del menú, en el MISMO orden que `nombresDeTabs` (app/admin/operaciones/tabs.ts): el nombre de una tab se repite
 * entre la barra del cliente y la del super admin, y la del producto va primero (lib/centro-chats.ts → `rutaDeLaTab`).
 * Se importa `nav.ts` acá y no se trae del servidor: es una tabla pura que el Sidebar ya lleva al navegador, y así el link
 * anda igual en la computadora y en el teléfono (tests/centro-revisar.test.ts vigila que el orden sea el mismo).
 */
export const TABS_DEL_MENU = [...TODOS_LOS_ITEMS, ...MAKO_NAV, ...ADMIN_NAV];

/** El chat del mensaje: su título trae su tab, y su clave y su sesión arman el link de «Revisar». `area`: la tab de su bitácora. */
export type ChatDelYaEsta = Pick<ChatCentro, 'clave' | 'sesion' | 'titulo'> & { area?: string };

/** Cómo se dice en qué está la tarea del Plan de un «Ya está». */
const estadoDe = (x: TareaDelChat) => (x.ya && x.estado === 'creada' ? 'Marcándola hecha' : ROTULO_TAREA[x.estado]);

/** El «Ya está» de un chat, en su conversación: qué cambió, dónde revisarlo, su tarea del Plan y responder sobre esto. */
export function YaEstaMensaje({ t, chat, tareas = [], onFeedback, yaVisto, onYaVisto, rotulo = null }: {
  t: TurnoChat; chat?: ChatDelYaEsta; tareas?: readonly TareaDelChat[];
  /** QUÉ SE COMPLETÓ, «Tab · Función» (10/11/2026, lib/centro-rotulo-completado.ts): va donde decía «Completado». null = «Completado». */
  rotulo?: string | null;
  /** El ✓ (18/10/2026, Martín: «no desaparecer hasta que yo le dé un check al mensaje de completado»): hasta qué «Ya está»
   *  lo vio, y cómo lo marca. Sin `onYaVisto`, la tarjeta no lleva ✓. */
  yaVisto?: number | null; onYaVisto?: (instante: number) => void;
  /** Responder sobre este «Ya está»: la caja de abajo arranca con «Sobre «…»: » (Conversacion.tsx). */
  /** «Responder sobre esto» (26/10/2026): cita ESTE «Ya está» arriba de la caja, como responder un mensaje. */
  onFeedback?: (t: TurnoChat) => void;
}) {
  const n = nodoDeCompletado(t, Date.parse(t.at));
  const destino = n ? destinoDeReview(n, chat, TABS_DEL_MENU) : null;
  // El título de la tarjeta es el primer renglón ENTERO y el cuerpo es todo lo demás (lib/centro-chats.ts → partesDeYaEsta):
  // `n.titulo` es el de la FILA de una lista (72 caracteres y «…») y acá cortaba lo más importante (Martín, 17/10/2026).
  // ⚠️ NUNCA «Cortado a los N caracteres» (25/10/2026, Martín: «que no haya nunca un limite de caracteres, en todo caso achica
  //    el mensaje»): lo que la PC cortó al subirlo termina en «…», y lo largo se pliega a su resumen, con «Ver todo».
  const { titulo: tituloEntero, cuerpo } = partesDeYaEsta(cortadoPorLaPC(t.texto) ? `${t.texto.trimEnd()}…` : t.texto);
  const suyas = tareas.filter((x) => x.ya === t.uuid);
  // En pantalla un «Ya está» se dice «Completado» (Martín, 17/10/2026). El chat lo sigue escribiendo «Ya está»: es lo que
  // lee el servidor (`esYaEsta`, el Plan automático) y no se toca. Para el aria-label y el «Responder sobre esto» sí sirve
  // el título corto de la fila.
  const titulo = n?.titulo && n.titulo !== 'Ya está' ? n.titulo : 'Completado';
  // Un cuerpo muy largo se pliega SÓLO en su detalle; lo que sigue pendiente y cómo probarlo queda siempre a la vista. Sin esa
  // cola, se pliega entero (antes quedaba abierto, tan largo como fuera).
  const largo = cuerpo.length > CUERPO_PLEGABLE;
  const plegable = largo ? partirPendiente(cuerpo) ?? { detalle: cuerpo, cola: '' } : null;
  const [abierto, setAbierto] = useState(false);
  const instante = Date.parse(t.at);
  const visto = tieneCheck(instante, yaVisto);
  return (
    <article className="co-ya" aria-label={`Completado${rotulo ? ` · ${rotulo}` : ''}: ${titulo}`}>
      <header className="co-ya__cab">
        <span className="co-ya__sello" aria-hidden><Icon name="check" size={13} /></span>
        {/* Qué se completó (10/11/2026, Martín: «que yo rápidamente pueda identificar qué se completó… qué funcionalidad, qué
            feature, qué tab»): «Image · Portadas de carruseles». El ✓ de al lado dice que está completado. */}
        <span className="co-ya__rotulo">{rotulo ?? 'Completado'}</span>
        {/* Hasta que lo toca, el chat dice «Espera tu respuesta» en la lista (lib/centro-chats.ts → esperaCheck). */}
        {onYaVisto && Number.isFinite(instante) && (
          <button type="button" className={`co-ya__check${visto ? ' co-ya__check--ok' : ''}`} aria-pressed={visto} disabled={visto}
            aria-label={visto ? 'Visto' : 'Marcar como visto'} title={visto ? 'Visto' : 'Marcar como visto'} onClick={() => onYaVisto(instante)}>
            <Icon name="check" size={15} />{visto ? 'Visto' : null}
          </button>
        )}
      </header>
      {/* Con el formato aplicado (17/10/2026): el título de un chat puede traer **negrita**, `código` o un link. */}
      {tituloEntero && <p className="co-ya__titulo">{conFormato(tituloEntero, 'ya-t')}</p>}
      {plegable ? (
        <>
          <div className={`co-ya__md co-el__md co-ya__detalle${abierto ? '' : ' co-ya__detalle--plegado'}`}><Markdown text={listasEnRenglones(plegable.detalle)} enlaces aire /></div>
          <button type="button" className="co-chip co-ya__mas" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ver menos' : 'Ver todo'}
          </button>
          {plegable.cola && <div className="co-ya__md co-el__md co-ya__cola"><Markdown text={listasEnRenglones(plegable.cola)} enlaces aire /></div>}
        </>
      ) : cuerpo && <div className="co-ya__md co-el__md"><Markdown text={listasEnRenglones(cuerpo)} enlaces aire /></div>}
      {(destino || suyas.length > 0) && (
        <div className="co-ya__links">
          {destino && (
            <Link className="co-ya__revisar" href={destino.href}>
              <Icon name="eye" size={15} />{destino.via === 'tab' ? 'Revisar en su tab' : 'Revisar'}
            </Link>
          )}
          {suyas.map((x) => (
            <a key={`${x.voy ?? ''}${x.ya ?? ''}`} className="co-ya__plan" href={x.tarea ? `/plan?tarea=${encodeURIComponent(x.tarea)}` : '/plan'}
              target="_blank" rel="noreferrer" title="Abrir en el Plan">
              <Icon name="todo" size={15} />
              <span className="co-ya__plan-titulo">{x.titulo}</span>
              <span className="co-ya__plan-estado" data-estado={x.estado}>{estadoDe(x)}</span>
            </a>
          ))}
        </div>
      )}
      {onFeedback && (
        <div className="co-ya__pie">
          <button type="button" className="co-chip" onClick={() => onFeedback(t)}>Responder sobre esto</button>
        </div>
      )}
    </article>
  );
}

/** Lleva la conversación al mensaje de un turno (el «Ya está» de una tarea, o su «Voy a trabajar en…») y lo marca un rato. */
export function irAlTurno(uuid: string | null) {
  if (!uuid || typeof document === 'undefined') return;
  const el = document.getElementById(`co-turno-${uuid}`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.add('co-el--visto');
  window.setTimeout(() => el.classList.remove('co-el--visto'), 1600);
}

/**
 * «Tareas vinculadas (N)», adentro del «+» de la caja: las del Plan de este chat (las que armaron su «Voy a trabajar en…»
 * y su «Ya está»), la más nueva arriba. Tocar una trae su mensaje en la conversación; no se despliega nada.
 */
export function TareasVinculadas({ tareas, onIr }: { tareas: readonly TareaDelChat[]; onIr: (uuid: string | null) => void }) {
  const lista = [...tareas].reverse();
  return (
    <section className="co-tareas" aria-label="Tareas vinculadas">
      <p className="co-tareas__titulo">{`Tareas vinculadas (${lista.length})`}</p>
      {!lista.length
        ? <p className="co-tareas__vacio">Se suman solas al empezar un trabajo.</p>
        : (
          <ul className="co-tareas__lista">
            {lista.map((x) => (
              <li key={`${x.local}${x.voy ?? ''}${x.ya ?? ''}`}>
                <button type="button" className="co-tareas__fila" onClick={() => onIr(x.ya ?? x.voy)}>
                  <span className="co-tareas__punto" data-estado={x.estado} aria-hidden />
                  <span className="co-tareas__nombre">{x.titulo}</span>
                  <span className="co-tareas__estado">{estadoDe(x)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
