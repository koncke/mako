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

import Link from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { ADMIN_NAV, MAKO_NAV, TODOS_LOS_ITEMS } from '@/app/_components/nav';
import { Markdown } from '@/app/_components/Markdown';
import { destinoDeReview, yaEstaDelChat, type ChatCentro } from '@/lib/centro-chats';
import { ROTULO_TAREA, type TareaDelChat } from '@/lib/centro-plan-auto-reglas';
import type { TurnoChat } from '@/lib/operaciones-reglas';

/**
 * Las tabs del menú, en el MISMO orden que `nombresDeTabs` (app/admin/operaciones/tabs.ts): el nombre de una tab se repite
 * entre la barra del cliente y la del super admin, y la del producto va primero (lib/centro-chats.ts → `rutaDeLaTab`).
 * Se importa `nav.ts` acá y no se trae del servidor: es una tabla pura que el Sidebar ya lleva al navegador, y así el link
 * anda igual en la computadora y en el teléfono (tests/centro-revisar.test.ts vigila que el orden sea el mismo).
 */
const TABS_DEL_MENU = [...TODOS_LOS_ITEMS, ...MAKO_NAV, ...ADMIN_NAV];

/** El chat del mensaje: su título trae su tab, y su clave y su sesión arman el link de «Revisar». */
export type ChatDelYaEsta = Pick<ChatCentro, 'clave' | 'sesion' | 'titulo'>;

/** Cómo se dice en qué está la tarea del Plan de un «Ya está». */
const estadoDe = (x: TareaDelChat) => (x.ya && x.estado === 'creada' ? 'Marcándola hecha' : ROTULO_TAREA[x.estado]);

/** El «Ya está» de un chat, en su conversación: qué cambió, dónde revisarlo, su tarea del Plan y responder sobre esto. */
export function YaEstaMensaje({ t, chat, tareas = [], onFeedback }: {
  t: TurnoChat; chat?: ChatDelYaEsta; tareas?: readonly TareaDelChat[];
  /** Responder sobre este «Ya está»: la caja de abajo arranca con «Sobre «…»: » (Conversacion.tsx). */
  onFeedback?: (titulo: string) => void;
}) {
  const [n] = yaEstaDelChat([{ tipo: 'turno', instante: Date.parse(t.at), turno: t }]);
  const destino = n ? destinoDeReview(n, chat, TABS_DEL_MENU) : null;
  // El primer renglón es el título; lo demás, el detalle (los chats contestan en Markdown).
  const cuerpo = t.texto.trim().split('\n').slice(1).join('\n').trim();
  const suyas = tareas.filter((x) => x.ya === t.uuid);
  const titulo = n?.titulo ?? 'Ya está';
  return (
    <article className="co-ya" aria-label={`Ya está: ${titulo}`}>
      <header className="co-ya__cab">
        <span className="co-ya__sello" aria-hidden><Icon name="check" size={13} /></span>
        <span className="co-ya__rotulo">Ya está</span>
      </header>
      <p className="co-ya__titulo">{titulo}</p>
      {cuerpo && <div className="co-ya__md co-el__md"><Markdown text={cuerpo} enlaces /></div>}
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
          <button type="button" className="co-chip" onClick={() => onFeedback(titulo)}>Responder sobre esto</button>
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
