'use client';

// =============================================================================
// TrabajoCliente — el tablero de ESE cliente, adentro de su ficha
// =============================================================================
// El pedido, textual (25/09/2026): «que la tab de clientes pueda visualizar allí mismo
// el detail del proyecto, de las tareas o de las recurrentes». «Allí mismo» es acá: la
// ficha de un cliente vive en Customer Success y el detalle no puede mandarte afuera.
//
// ⚠️ POR QUÉ NO SE MONTA EL `TaskModal` DEL TABLERO, que es lo que hace
// `app/admin/dev/customer-success/RoadmapCS.tsx`. Se midió y no entra por tres cosas:
//
//   1. `RoadmapCS` monta el modal del tablero del DUEÑO (`repoPlan()` → /api/plan-board
//      → `plan_tareas`). Acá el trabajo vive en `experimento_tareas`, y el `Repo` de ese
//      tablero está escrito INLINE adentro de `app/plan/TodoBoard.tsx` (no exportado).
//      Para reusar el modal habría que sacarlo a su propio `repo-todo.ts` — que es lo
//      correcto y es un archivo de otro paquete. Queda declarado como lo que falta.
//   2. `useBoard` AUTOGUARDA por dirty-set y `saveTask` hace upsert de la FILA ENTERA
//      desde el estado del navegador. Dos `useBoard` montados a la vez son dos
//      escritores: el que tenga el estado viejo pisa al otro sin un solo error.
//   3. Importar de `BoardShell` arrastra su grafo entero (~699 KB de fuente) a una
//      pantalla que hoy no paga nada de eso.
//
// Lo que el pedido pide es VER el detalle, y para verlo no hace falta ninguna de las
// tres. Acá se lee, y para EDITARLO hay un link al tablero que abre en otra pestaña:
// un «ver» sin regreso deja a la persona afuera de Customer Success, y esto no la saca.
//
// Lo que sí se comparte en vez de copiarse: el rótulo y el chip de las recurrentes
// (`RepiteChip`), el formato de la fecha con su plazo (`LineaDeadline`) y el renderer
// del detalle (`mdAHtml` + `sanitizeHtml`). Son los mismos que pinta el tablero, así
// que la misma tarjeta no puede decir dos cosas distintas en dos pantallas.
//
// ⚠️ SE PODÓ EL 26/09/2026 y conviene no volver a plantarlo. Se fueron el bloque de
// proyectos huérfanos, el chip de CÓMO se ató el proyecto al cliente y los párrafos que
// explicaban el ranking. Nada de eso es un cliente, un proyecto, una tarea o una
// recurrente — que es todo lo que esta pantalla muestra. El cruce sigue igual de blando
// que antes (./cruce.ts): lo que se fue es el comentario en pantalla, no la regla.

import { useEffect, useMemo, useState } from 'react';
import { Status, MONO } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { RepiteChip, LineaDeadline } from '@/app/plan/board/piezas';
import { mdAHtml, sanitizeHtml } from '@/app/plan/board/RichText';
import { ROTULO_RECURRENTE } from '@/lib/plan-recurrentes';
import type { ProyectoCS, TareaCS, ResumenTrabajo } from './trabajo';
import { trabajoDelClienteAction } from './actions';

type Cargado = { proyectos: ProyectoCS[]; tareas: TareaCS[]; recurrentes: TareaCS[] };
type Estado =
  | { fase: 'cargando' }
  | { fase: 'error'; error: string }
  | ({ fase: 'lista' } & Cargado);

/**
 * Lo que está abierto EN LUGAR de la lista. Es una PILA y no un booleano porque desde el
 * detalle de un proyecto se abre una de sus tareas, y «Volver» tiene que volver AL
 * PROYECTO — el destino de volver es una propiedad de la pantalla, no del historial.
 *
 * ⚠️ Y ES UN PANEL, NO UN `<Modal>` ANIDADO. La ficha del cliente YA es un `<Modal>`, y la
 * pila de modales (app/_components/pila-modales.ts) esconde al de abajo con
 * `display:none` sobre su contenedor: un `<Modal>` escrito adentro de los `children` de
 * otro es un DESCENDIENTE de ese contenedor, así que al abrirse se esconde a sí mismo.
 * El resultado sería una pantalla en blanco, sin error y sin nada que apunte acá. Los
 * modales de la pila que funcionan (`CrmBoard`, `StageMoveDialog`) se montan como
 * HERMANOS, no adentro. Acá el detalle reemplaza a la lista en el cuerpo de la ficha —
 * que además es lo que el pedido dice: verlo ALLÍ MISMO, sin tapar de quién es.
 */
type Foco = { tipo: 'proyecto'; id: number } | { tipo: 'tarea'; id: number };

const hoyISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function TrabajoDelCliente({ leadId, nombre, resumen }: {
  leadId: number;
  nombre: string;
  /** Lo que ya sabe la grilla. Sirve para no pintar un vacío mientras carga el detalle. */
  resumen: ResumenTrabajo | null;
}) {
  const [e, setE] = useState<Estado>({ fase: 'cargando' });
  const [pila, setPila] = useState<Foco[]>([]);
  const hoy = useMemo(() => hoyISO(), []);

  useEffect(() => {
    let vivo = true;
    trabajoDelClienteAction(leadId)
      .then((r) => {
        if (!vivo) return;
        setE(r.ok
          ? { fase: 'lista', proyectos: r.proyectos, tareas: r.tareas, recurrentes: r.recurrentes }
          : { fase: 'error', error: r.error });
      })
      .catch((err) => { if (vivo) setE({ fase: 'error', error: err instanceof Error ? err.message : 'No pude leer el tablero.' }); });
    return () => { vivo = false; };
  }, [leadId]);

  // ⚠️ MEDIDO, y por eso la espera se anuncia: la lectura tarda entre 0,5 y 9 segundos
  // (dev server contra la Supabase de producción, 212 tareas + 19 proyectos + la cartera).
  // Un spinner mudo de más de ~8 s es indistinguible de algo colgado, y la persona cierra
  // sin saber si perdió lo que estaba haciendo. Mientras tanto se muestran los números que
  // la grilla YA sabe: no es un placeholder, es el dato que después se va a detallar.
  if (e.fase === 'cargando') {
    return (
      <div className="tr-cargando">
        <p className="q">
          {resumen && (resumen.proyectos || resumen.abiertas || resumen.recurrentes)
            ? `Buscando en el tablero: ${[
                resumen.proyectos && `${resumen.proyectos} ${resumen.proyectos === 1 ? 'proyecto' : 'proyectos'}`,
                resumen.abiertas && `${resumen.abiertas} ${resumen.abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'}`,
                resumen.recurrentes && `${resumen.recurrentes} ${resumen.recurrentes === 1 ? 'recurrente' : 'recurrentes'}`,
              ].filter(Boolean).join(' · ')}…`
            : 'Buscando su trabajo en el tablero…'}
        </p>
        <p className="d">Puede tardar unos segundos.</p>
      </div>
    );
  }
  // Un error de lectura NO se pinta como «no tiene trabajo»: son dos respuestas, y la
  // segunda sobre la primera es la mentira que nadie va a ir a auditar.
  if (e.fase === 'error') {
    return (
      <div className="tr-vacio">
        <p className="t tr-error">No pude leer el tablero</p>
        <p className="d">{e.error}</p>
      </div>
    );
  }

  const { proyectos, tareas, recurrentes } = e;
  const abiertas = tareas.filter((t) => t.abierta);
  const hechas = tareas.filter((t) => !t.abierta);
  const vacio = !proyectos.length && !tareas.length && !recurrentes.length;

  const abrir = (f: Foco) => setPila((p) => [...p, f]);
  const volver = () => setPila((p) => p.slice(0, -1));
  const cerrarTodo = () => setPila([]);
  const arriba = pila[pila.length - 1] ?? null;
  const debajo = pila.length > 1 ? pila[pila.length - 2] : null;

  const proyectoDe = (id: number) => proyectos.find((p) => p.id === id) ?? null;
  const tareaDe = (id: number) => [...tareas, ...recurrentes].find((t) => t.id === id) ?? null;
  const nombreDe = (f: Foco): string =>
    f.tipo === 'proyecto' ? (proyectoDe(f.id)?.nombre ?? 'el proyecto') : (tareaDe(f.id)?.titulo ?? 'la tarea');

  if (arriba) {
    return (
      <div className="tr">
        {arriba.tipo === 'proyecto' ? (
          <DetalleProyecto
            p={proyectoDe(arriba.id)} hoy={hoy}
            tareas={[...tareas, ...recurrentes].filter((t) => t.proyectos.includes(arriba.id))}
            volverA={debajo ? nombreDe(debajo) : null}
            onVolver={volver} onCerrar={cerrarTodo}
            onTarea={(id) => abrir({ tipo: 'tarea', id })}
          />
        ) : (
          <DetalleTarea
            t={tareaDe(arriba.id)} hoy={hoy} proyectos={proyectos}
            volverA={debajo ? nombreDe(debajo) : null}
            onVolver={volver} onCerrar={cerrarTodo}
          />
        )}
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <style dangerouslySetInnerHTML={{ __html: CSS_DET }} />
      </div>
    );
  }

  return (
    <div className="tr">
      {vacio ? (
        <SinTrabajo nombre={nombre} />
      ) : (
        <>
          <Grupo titulo="Proyectos" n={proyectos.length} vacio="Ninguno.">
            {proyectos.map((p) => (
              <FilaProyecto key={p.id} p={p} hoy={hoy} onAbrir={() => abrir({ tipo: 'proyecto', id: p.id })} />
            ))}
          </Grupo>

          <Grupo
            titulo="Tareas" n={abiertas.length} hay={tareas.length}
            sub={hechas.length ? `${hechas.length} ${hechas.length === 1 ? 'terminada' : 'terminadas'}` : undefined}
            vacio="Ninguna."
          >
            {[...abiertas, ...hechas].map((t) => (
              <FilaTarea key={t.id} t={t} hoy={hoy} onAbrir={() => abrir({ tipo: 'tarea', id: t.id })} />
            ))}
          </Grupo>

          <Grupo titulo="Recurrentes" n={recurrentes.length} vacio="Ninguna.">
            {recurrentes.map((t) => (
              <FilaTarea key={t.id} t={t} hoy={hoy} onAbrir={() => abrir({ tipo: 'tarea', id: t.id })} />
            ))}
          </Grupo>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

// ── La lista ─────────────────────────────────────────────────────────────────

/**
 * ⚠️ `n` ES EL BADGE Y `hay` ES CUÁNTAS FILAS HAY, y no siempre son el mismo número. El
 * badge de «Tareas» cuenta las ABIERTAS —es lo que hay que hacer—, pero la lista muestra
 * también las terminadas. Con un solo número, un cliente con todo su trabajo terminado
 * decía «ninguna tarea abierta con él» y se COMÍA la lista de lo hecho: el texto era
 * cierto y la pantalla mentía por omisión.
 */
function Grupo({ titulo, n, hay = n, sub, vacio, children }: {
  titulo: string; n: number; hay?: number; sub?: string; vacio: string; children: React.ReactNode;
}) {
  return (
    <section className="tr-grupo">
      <header>
        <h3>{titulo}</h3>
        <span className="n">{n}</span>
        {sub && <span className="s">{sub}</span>}
      </header>
      {hay === 0 ? <p className="tr-nota">{vacio}</p> : <ul className="tr-lista">{children}</ul>}
    </section>
  );
}

function FilaProyecto({ p, hoy, onAbrir }: { p: ProyectoCS; hoy: string; onAbrir: () => void }) {
  const conFin = p.abiertas + p.hechas;
  const pct = conFin ? Math.round((p.hechas / conFin) * 100) : 0;
  return (
    <li className="tr-fila">
      <button className="tr-abrir" onClick={onAbrir}>
        <span className="em" aria-hidden style={{ color: p.color }}>{p.emoji}</span>
        <span className="med">
          <span className="ti">{p.nombre}</span>
          <span className="de">
            {conFin > 0
              ? `${p.hechas} de ${conFin} terminadas`
              : p.recurrentes > 0 ? 'En marcha · sin trabajo con fin' : 'Sin tareas'}
            {p.recurrentes > 0 && ` · ${p.recurrentes} ${p.recurrentes === 1 ? 'se repite' : 'se repiten'}`}
          </span>
        </span>
        <span className="der">
          {p.deadline && <LineaDeadline iso={p.deadline} hoy={hoy} />}
        </span>
      </button>
      {/* El avance es el BORDE de la fila, no una barra con ancho propio: adentro de una
          lista, una barra suelta deja el mismo hueco muerto que un max-width. Y un
          proyecto sin trabajo-con-fin no pinta 0%: no tiene qué pintar. */}
      {conFin > 0 && <span className="tr-filo" aria-hidden><span style={{ width: `${Math.min(100, pct)}%` }} /></span>}
    </li>
  );
}

function FilaTarea({ t, hoy, onAbrir }: { t: TareaCS; hoy: string; onAbrir: () => void }) {
  return (
    <li className="tr-fila">
      <button className="tr-abrir" onClick={onAbrir}>
        <span className="em" aria-hidden>{t.recurrente ? '🔁' : t.abierta ? '📌' : '✓'}</span>
        <span className="med">
          <span className={`ti${t.abierta ? '' : ' hecha'}`}>{t.titulo}</span>
          <span className="de">
            {t.recurrente
              ? ROTULO_RECURRENTE
              : t.abierta ? `${t.progreso}% avanzado` : 'Terminada'}
            {t.responsable && ` · ${t.responsable}`}
            {t.porClave && ' · lo dice su ficha'}
          </span>
        </span>
        <span className="der">
          {t.recurrente
            ? <RepiteChip soloIcono />
            : t.abierta && <span className="sc" title={t.scoreRazon ?? 'La prioridad que le puso MaKo'}>{t.score}</span>}
          {!t.recurrente && t.deadline && <LineaDeadline iso={t.deadline} hoy={hoy} />}
        </span>
      </button>
    </li>
  );
}

function SinTrabajo({ nombre }: { nombre: string }) {
  return (
    <div className="tr-vacio">
      <p className="t">Todavía no hay trabajo suyo en el tablero</p>
      <p className="d">Aparece solo cuando un proyecto del tablero lleva el nombre de {nombre}.</p>
    </div>
  );
}

// ── El detalle ───────────────────────────────────────────────────────────────

/** La cabecera del detalle: de qué es, y CÓMO SE VUELVE. El destino se declara —«volver
 *  al proyecto», «volver al trabajo»— en vez de salir de `router.back()`: cada camino
 *  nuevo a esta pantalla separaría «de dónde vine» de «cuál es el nivel de arriba». */
function CabDetalle({ tipo, titulo, volverA, onVolver, onCerrar }: {
  tipo: string; titulo: React.ReactNode; volverA: string | null; onVolver: () => void; onCerrar: () => void;
}) {
  return (
    <header className="tr-cab">
      <button className="volver" onClick={volverA ? onVolver : onCerrar}>
        ← {volverA ? `Volver a ${volverA}` : 'Volver a su trabajo'}
      </button>
      <span className="tipo">{tipo}</span>
      <h3>{titulo}</h3>
    </header>
  );
}

/** El pie: el único camino AFUERA, y abre en otra pestaña a propósito — la ficha del
 *  cliente queda donde está. Acá se mira; editar es del tablero. */
function PieDetalle({ href }: { href: string }) {
  return (
    <footer className="tr-pie">
      <Link href={href} target="_blank" rel="noopener noreferrer" className="tr-link">
        Abrir en el tablero ↗
      </Link>
    </footer>
  );
}

function DetalleTarea({ t, hoy, proyectos, volverA, onVolver, onCerrar }: {
  t: TareaCS | null; hoy: string; proyectos: ProyectoCS[];
  volverA: string | null; onVolver: () => void; onCerrar: () => void;
}) {
  if (!t) return null;
  const suyos = proyectos.filter((p) => t.proyectos.includes(p.id));
  return (
    <>
      <CabDetalle
        tipo={t.recurrente ? ROTULO_RECURRENTE : t.abierta ? 'Tarea abierta' : 'Tarea terminada'}
        titulo={t.titulo} volverA={volverA} onVolver={onVolver} onCerrar={onCerrar}
      />
      <div className="tr-det">
        <div className="chips">
          {t.recurrente && <RepiteChip />}
          {!t.recurrente && t.abierta && <Status>Prioridad {t.score}</Status>}
          {!t.recurrente && !t.abierta && <Status tono="good">Terminada</Status>}
          {suyos.map((p) => <span key={p.id} className="proy" style={{ borderColor: p.color }}>{p.emoji} {p.nombre}</span>)}
          {t.responsable && <span className="quien">{t.responsable}</span>}
          {t.deadline
            ? <LineaDeadline iso={t.deadline} hoy={hoy} tam={12} />
            : !t.recurrente && <span className="sinfecha">Sin fecha</span>}
        </div>

        {!t.recurrente && t.abierta && <Barra pct={t.progreso} rotulo={`${t.progreso}% avanzado`} />}

        <Doc texto={t.detalle} vacio="Sin detalle cargado." />

        {t.scoreRazon && !t.recurrente && (
          <section className="porque">
            <h4>Por qué esa prioridad</h4>
            <p>{t.scoreRazon}</p>
          </section>
        )}
      </div>
      <PieDetalle href={`/plan?tarea=${t.id}`} />
    </>
  );
}

function DetalleProyecto({ p, hoy, tareas, volverA, onVolver, onCerrar, onTarea }: {
  p: ProyectoCS | null; hoy: string; tareas: TareaCS[];
  volverA: string | null; onVolver: () => void; onCerrar: () => void; onTarea: (id: number) => void;
}) {
  if (!p) return null;
  const conFin = p.abiertas + p.hechas;
  const pct = conFin ? Math.round((p.hechas / conFin) * 100) : 0;
  const abiertas = tareas.filter((t) => !t.recurrente && t.abierta);
  const hechas = tareas.filter((t) => !t.recurrente && !t.abierta);
  const repiten = tareas.filter((t) => t.recurrente);

  return (
    <>
      <CabDetalle
        tipo="Proyecto" titulo={`${p.emoji} ${p.nombre}`}
        volverA={volverA} onVolver={onVolver} onCerrar={onCerrar}
      />
      <div className="tr-det">
        <div className="chips">
          <Status>Prioridad {p.score}</Status>
          {p.quarter && <span className="quien">{p.quarter}</span>}
          {p.deadline
            ? <LineaDeadline iso={p.deadline} hoy={hoy} tam={12} />
            : <span className="sinfecha">Sin fecha</span>}
        </div>

        {/* ⚠️ Un proyecto de PURAS recurrentes no muestra 0%. Ese 0% es indistinguible de
            «nadie hizo nada» sobre un cliente al que se atiende todas las semanas — y es
            el caso que el pedido marca. Muestra su propio estado. */}
        {conFin > 0
          ? <Barra pct={pct} rotulo={`${p.hechas} de ${conFin} terminadas${p.recurrentes ? ` · ${p.recurrentes} se repiten` : ''}`} />
          : (
            <p className="tr-nota">
              {p.recurrentes > 0
                ? `${p.recurrentes} ${p.recurrentes === 1 ? 'se repite' : 'se repiten'} · nada con fin`
                : 'Sin tareas'}
            </p>
          )}

        <Doc texto={p.detalle} vacio="Sin detalle cargado." />

        {p.scoreRazon && (
          <section className="porque">
            <h4>Por qué esa prioridad</h4>
            <p>{p.scoreRazon}</p>
          </section>
        )}

        <ListaEnProyecto titulo="Abiertas" tareas={abiertas} hoy={hoy} onTarea={onTarea} />
        <ListaEnProyecto titulo="Se repiten" tareas={repiten} hoy={hoy} onTarea={onTarea} />
        <ListaEnProyecto titulo="Terminadas" tareas={hechas} hoy={hoy} onTarea={onTarea} />
      </div>
      <PieDetalle href={`/plan?proyecto=${p.id}`} />
    </>
  );
}

function ListaEnProyecto({ titulo, tareas, hoy, onTarea }: {
  titulo: string; tareas: TareaCS[]; hoy: string; onTarea: (id: number) => void;
}) {
  if (!tareas.length) return null;
  return (
    <section className="tr-grupo">
      <header><h3>{titulo}</h3><span className="n">{tareas.length}</span></header>
      <ul className="tr-lista">
        {tareas.map((t) => <FilaTarea key={t.id} t={t} hoy={hoy} onAbrir={() => onTarea(t.id)} />)}
      </ul>
    </section>
  );
}

function Barra({ pct, rotulo }: { pct: number; rotulo: string }) {
  return (
    <div className="tr-barra">
      {/* Recortada al 100% y con el número al lado: una barra que se pasa del carril
          desborda la PÁGINA, y el color nunca es el único portador del dato. */}
      <span className="carril" aria-hidden><span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></span>
      <span className="v">{rotulo}</span>
    </div>
  );
}

/** El detalle, con el MISMO renderer que el tablero (`mdAHtml` + `sanitizeHtml`). Escribir
 *  un segundo aquí sería la copia que se queda vieja: el detalle se guarda en markdown o
 *  en el HTML del editor según quién lo escribió, y sólo ese par sabe leer los dos. */
function Doc({ texto, vacio }: { texto: string; vacio: string }) {
  const html = useMemo(() => (texto.trim() ? sanitizeHtml(mdAHtml(texto)) : ''), [texto]);
  if (!html) return <p className="tr-nota">{vacio}</p>;
  return <div className="tr-doc" dangerouslySetInnerHTML={{ __html: html }} />;
}

const CSS = `
.tr-grupo{ margin:0 0 22px; }
.tr-grupo:last-child{ margin-bottom:6px; }
.tr-grupo > header{ display:flex; align-items:baseline; gap:9px; margin:0 0 7px; }
.tr-grupo h3{ margin:0; font-size:12px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--faint); font-weight:600; }
.tr-grupo .n{ font-family:${MONO}; font-size:11px; padding:1px 7px; border-radius:999px;
  background:var(--surface-2); color:var(--dim); }
.tr-grupo .s{ margin-left:auto; font-size:12px; color:var(--faint); }

.tr-lista{ list-style:none; margin:0; padding:0; }
.tr-fila{ position:relative; border-bottom:1px solid var(--border); }
.tr-fila:last-child{ border-bottom:0; }
.tr-abrir{ display:flex; align-items:center; gap:11px; width:100%; background:none; border:0;
  padding:10px 4px; text-align:left; font:inherit; color:inherit; cursor:pointer; }
.tr-abrir:hover{ background:var(--surface-2); }
.tr-abrir:hover .ti{ text-decoration:underline; text-underline-offset:3px; }
.tr-abrir .em{ flex:none; font-size:15px; line-height:1; }
.tr-abrir .med{ display:flex; flex-direction:column; gap:2px; min-width:0; flex:1 1 auto; }
.tr-abrir .ti{ font-size:14px; line-height:1.35; overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; }
.tr-abrir .ti.hecha{ color:var(--faint); text-decoration:line-through; }
.tr-abrir .de{ font-size:12px; color:var(--faint); overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; }
.tr-abrir .der{ flex:none; display:flex; align-items:center; gap:8px; }
.tr-abrir .sc{ font-family:${MONO}; font-size:11px; font-weight:700; color:var(--dim);
  background:var(--surface-2); border:1px solid var(--border-strong); border-radius:6px;
  padding:1px 6px; }
.tr-filo{ display:block; height:2px; background:var(--border); }
.tr-filo span{ display:block; height:100%; background:var(--ink); }

.tr-cargando{ padding:16px 0; }
.tr-cargando .q{ margin:0 0 6px; font-size:14px; line-height:1.5; }
.tr-cargando .d{ margin:0; font-size:12.5px; line-height:1.5; color:var(--faint); }

.tr-nota{ font-size:13px; line-height:1.5; color:var(--dim); margin:2px 0 0; }
.tr-error{ color:var(--bad); }
.tr-vacio{ padding:22px 0; }
.tr-vacio .t{ font-size:15px; font-weight:600; margin:0 0 5px; }
.tr-vacio .d{ font-size:13.5px; line-height:1.5; color:var(--dim); margin:0 0 12px; }

`;

const CSS_DET = `
/* La cabecera del detalle: la salida primero, y pegada arriba mientras se scrollea el
   cuerpo de la ficha — un «volver» que hay que ir a buscar es un «volver» que no está. */
.tr-cab{ position:sticky; top:-4px; z-index:2; display:flex; align-items:baseline; gap:10px;
  flex-wrap:wrap; background:var(--surface); border-bottom:1px solid var(--border); }
/* ⚠️ El margen negativo NO es un ajuste fino: es lo que hace que la cabecera TAPE. El
   contenedor de scroll (.mk-modal__cuerpo) tiene 4px de padding arriba (app/_ui/ui.css),
   así que sin el margen negativo queda una franja transparente encima por la que se ve
   pasar el texto que scrollea por debajo — se lee como una línea de basura sobre el
   título. El top:-4px es ESE mismo padding, MEDIDO con getComputedStyle: un sticky se
   pega al borde del padding box. No se adivinó: se midió.
   ⚠️ Los dos números son EL MISMO padding. Hasta el 26/09/2026 el margen valía -18px
   porque el cuerpo de la ficha metía su propia caja (.dc-cuerpo) entre el modal y esto;
   esa caja se fue con las tabs, y el margen tuvo que bajar con ella.

   (Y sin comillas invertidas en este comentario: adentro de un template literal cierran la
   cadena, y la pantalla contesta 200 sin cuerpo. Esto lo cazó el navegador y no el
   typecheck — AGENTS.md lo tiene escrito y pasó igual.) */
.tr-cab{ margin:-4px 0 14px; padding:4px 0 10px; }
.tr-cab .volver{ background:none; border:0; padding:4px 8px 4px 0; font:inherit; font-size:13px;
  color:var(--dim); cursor:pointer; }
.tr-cab .volver:hover{ color:var(--ink); text-decoration:underline; text-underline-offset:3px; }
.tr-cab .tipo{ font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--faint); }
.tr-cab h3{ flex:1 1 100%; margin:2px 0 0; font-size:17px; font-weight:660; letter-spacing:-.02em;
  line-height:1.3; }

.tr-pie{ display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin:20px 0 0;
  padding:13px 0 0; border-top:1px solid var(--border); }
.tr-pie .nota{ font-size:12px; color:var(--faint); }

.tr-det .chips{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0 0 16px; }
.tr-det .chips .proy{ font-size:11.5px; padding:2px 8px; border-radius:6px;
  border:1px solid var(--border-strong); color:var(--dim); }
.tr-det .chips .quien{ font-size:11.5px; color:var(--faint); }
.tr-det .chips .sinfecha{ font-size:11.5px; color:var(--faint); }

.tr-barra{ display:flex; align-items:center; gap:11px; margin:0 0 18px; }
.tr-barra .carril{ flex:1 1 auto; height:6px; border-radius:999px; overflow:hidden;
  background:var(--surface-2); }
.tr-barra .carril span{ display:block; height:100%; background:var(--ink); }
.tr-barra .v{ flex:none; font-size:12.5px; color:var(--dim); font-variant-numeric:tabular-nums; }

.tr-doc{ font-size:14px; line-height:1.6; }
.tr-doc :first-child{ margin-top:0; }
.tr-doc :last-child{ margin-bottom:0; }
.tr-doc ul, .tr-doc ol{ padding-left:20px; }
.tr-doc h1, .tr-doc h2, .tr-doc h3, .tr-doc h4{ font-size:14px; font-weight:700; margin:16px 0 4px; }

.tr-det .porque{ margin:18px 0 0; padding:12px 14px; border-radius:11px;
  background:var(--surface-2); border:1px solid var(--border); }
.tr-det .porque h4{ margin:0 0 5px; font-size:11px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--faint); font-weight:600; }
.tr-det .porque p{ margin:0; font-size:13.5px; line-height:1.55; }

.tr-link{ font-size:13px; color:var(--dim); }
.tr-link:hover{ color:var(--ink); }
`;
