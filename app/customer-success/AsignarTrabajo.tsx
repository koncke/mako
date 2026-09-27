'use client';

// =============================================================================
// AsignarTrabajo — elegir qué proyectos y tareas son de este cliente
// =============================================================================
// «No tengo forma de asignar proyectos o tareas a clientes. Debería desde allí mismo,
// buscando o filtrando y seleccionando los que quiera asignar» (26/09/2026).
//
// Se abre desde la ficha del cliente: buscás, marcás y guardás. Selección MÚLTIPLE
// —asignar de a uno sobre 396 tarjetas no es una funcionalidad— y una sola escritura
// para todo el lote, que es la unidad en la que la persona decidió.
//
// ⚠️ LO QUE YA TIENE DUEÑO NO SE ESCONDE: se marca. Esconderlo haría imposible ver que
// una tarea está en el cliente equivocado —que es justo el error que hay que poder
// arreglar— y dejaría la lista vacía apenas se asigna, sin forma de deshacerlo.
//
// ⚠️ ES UN PANEL, NO UN `<Modal>` ANIDADO. La ficha del cliente YA es un `<Modal>`, y la
// pila esconde al de abajo con `display:none` sobre su contenedor: un `<Modal>` escrito
// adentro de sus `children` es un DESCENDIENTE de ese contenedor, así que al abrirse se
// esconde a sí mismo — pantalla en blanco, sin error. Es la misma razón por la que el
// detalle de una tarea reemplaza a la lista en vez de apilarse (ver TrabajoCliente.tsx).

import { useEffect, useMemo, useState } from 'react';
import { Button, Status, MONO } from '@/app/_ui';
import type { Asignable } from './trabajo';
import { catalogoAsignableAction, asignarTrabajoAction, autoasignarAction } from './actions';

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error'; error: string }
  | { fase: 'lista'; items: Asignable[] };

/** Sin acentos y en minúsculas: buscar «esquer» tiene que encontrar «Grupo Esquér». */
const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function AsignarTrabajo({ leadId, nombre, onListo, onCerrar }: {
  leadId: number;
  nombre: string;
  /** Se guardó algo. La ficha recarga su trabajo: lo que se acaba de asignar ya es suyo. */
  onListo: (msg: string) => void;
  onCerrar: () => void;
}) {
  const [e, setE] = useState<Estado>({ fase: 'cargando' });
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [soloSuyo, setSoloSuyo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);
  const [mako, setMako] = useState<'no' | 'pensando' | string>('no');

  useEffect(() => {
    let vivo = true;
    catalogoAsignableAction()
      .then((r) => { if (vivo) setE(r.ok ? { fase: 'lista', items: r.items } : { fase: 'error', error: r.error }); })
      .catch((err) => { if (vivo) setE({ fase: 'error', error: err instanceof Error ? err.message : 'No pude leer el tablero.' }); });
    return () => { vivo = false; };
  }, []);

  // ⚠️ `useMemo` Y NO UN TERNARIO SUELTO: la rama `[]` crea un array NUEVO en cada render,
  // así que el `useMemo` de abajo —que lo tiene en sus deps— se recalcularía siempre. Es
  // barato acá y deja de serlo con las 396 tarjetas del ws9.
  const items = useMemo(() => (e.fase === 'lista' ? e.items : []), [e]);

  const visibles = useMemo(() => {
    const q = norm(busca.trim());
    return items.filter((i) => {
      if (soloSuyo && i.clienteLeadId !== leadId) return false;
      if (!q) return true;
      return norm(i.titulo).includes(q) || norm(i.sub).includes(q);
    });
  }, [items, busca, soloSuyo, leadId]);

  const suyos = items.filter((i) => i.clienteLeadId === leadId).length;

  const alternar = (id: string) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  // ⚠️ SE PARTE POR TIPO ACÁ Y NO EN EL SERVER: el id solo no dice de qué tabla es, y las
  // dos mitades del tablero ni siquiera comparten el tipo de id. Mandar una lista mezclada
  // obligaría al server a adivinar, y adivinar mal es escribir en la tabla equivocada.
  const elegidos = items.filter((i) => sel.has(i.id));
  const ids = {
    proyectos: elegidos.filter((i) => i.tipo === 'proyecto').map((i) => i.id),
    tareas: elegidos.filter((i) => i.tipo === 'tarea').map((i) => i.id),
  };

  // Si TODO lo elegido ya es de este cliente, el botón desasigna: es la misma pantalla y
  // la misma selección, y no hace falta un segundo control para el camino de vuelta.
  const todoSuyo = elegidos.length > 0 && elegidos.every((i) => i.clienteLeadId === leadId);

  async function correrMako() {
    setMako('pensando'); setFalla(null);
    const r = await autoasignarAction();
    if (!r.ok) { setMako('no'); setFalla(r.error); return; }
    const n = r.porNombre + r.porIA;
    // Tres o cuatro palabras (AGENTS.md). Y se DICE cuántas miró sin asignar: «0
    // asignadas» sobre 43 revisadas es un resultado, y sin el segundo número se lee
    // como que no funcionó.
    setMako(n === 0
      ? (r.consultadas ? `Ninguna de ${r.consultadas} es suya` : 'Nada evidente')
      : `${n} asignadas`);
    if (n > 0) onListo(`${n} ${n === 1 ? 'asignada' : 'asignadas'}`);
  }

  async function guardar() {
    setGuardando(true); setFalla(null);
    const r = await asignarTrabajoAction(leadId, ids, !todoSuyo);
    setGuardando(false);
    if (!r.ok) { setFalla(r.error ?? 'No se pudo guardar'); return; }
    const n = (r.proyectos ?? 0) + (r.tareas ?? 0);
    onListo(todoSuyo ? `${n} sin cliente` : `${n} ${n === 1 ? 'asignado' : 'asignados'}`);
  }

  if (e.fase === 'cargando') return <p className="at-nota">Buscando en el tablero…</p>;
  if (e.fase === 'error') {
    return (
      <div className="at">
        <button className="at-volver" onClick={onCerrar}>← Volver a su trabajo</button>
        <p className="at-nota at-mal">No pude leer el tablero</p>
        <p className="at-nota">{e.error}</p>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </div>
    );
  }

  return (
    <div className="at">
      <header className="at-cab">
        <button className="at-volver" onClick={onCerrar}>← Volver a su trabajo</button>
        <span className="at-tipo">Asignar a {nombre}</span>
      </header>

      {/* ⚠️ MAKO VA ACÁ Y NO EN LA CABECERA DE LA PANTALLA. Es la ayuda de ESTE trabajo
          —elegir de quién es cada cosa— y a quien abre el selector ya le está costando:
          en la cabecera sería un botón más que nadie sabe cuándo apretar. */}
      <div className="at-mako">
        <span className="q">¿Te lo asigno yo?</span>
        <button type="button" disabled={mako === 'pensando'} onClick={() => void correrMako()}>
          {mako === 'pensando' ? 'Mirando el tablero…' : 'Asignar lo evidente'}
        </button>
        {typeof mako === 'string' && mako !== 'no' && mako !== 'pensando' && <span className="r">{mako}</span>}
      </div>

      <div className="at-filtros">
        <input autoFocus value={busca} onChange={(ev) => setBusca(ev.target.value)}
          placeholder="Busca un proyecto o una tarea…" className="at-buscar" />
        {/* El filtro es de UNO: «lo suyo». Los otros cortes que un tablero tiene —proyecto,
            estado, prioridad— no ayudan a contestar «¿esto es de este cliente?». */}
        {suyos > 0 && (
          <button type="button" onClick={() => setSoloSuyo((v) => !v)}
            className={`at-chip${soloSuyo ? ' es' : ''}`}>
            Ya es suyo <span className="n">{suyos}</span>
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="at-nota">
          {items.length === 0
            ? 'Tu tablero todavía no tiene proyectos ni tareas abiertas.'
            : `Nada coincide con «${busca.trim()}».`}
        </p>
      ) : (
        <ul className="at-lista">
          {visibles.map((i) => {
            const deOtro = i.clienteLeadId !== null && i.clienteLeadId !== leadId;
            return (
              <li key={i.id}>
                <label className={`at-fila${sel.has(i.id) ? ' es' : ''}`}>
                  <input type="checkbox" checked={sel.has(i.id)} onChange={() => alternar(i.id)} />
                  <span className="em" aria-hidden>{i.tipo === 'proyecto' ? '📁' : '📌'}</span>
                  <span className="med">
                    <span className="ti">{i.titulo}</span>
                    <span className="de">{i.sub}</span>
                  </span>
                  {/* ⚠️ «De otro cliente» se DICE, no se esconde: es el único lugar donde se
                      puede ver que algo quedó en el cliente equivocado. */}
                  {i.clienteLeadId === leadId && <Status tono="good">Suyo</Status>}
                  {deOtro && <Status tono="warn">De otro</Status>}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {falla && <p className="at-nota at-mal">{falla}</p>}

      <footer className="at-pie">
        <span className="at-n">{sel.size ? `${sel.size} elegido${sel.size === 1 ? '' : 's'}` : 'Nada elegido'}</span>
        <Button variant="secondary" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button onClick={() => void guardar()} disabled={!sel.size || guardando}>
          {todoSuyo ? 'Quitárselos' : `Asignar a ${nombre}`}
        </Button>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

const CSS = `
.at-cab{ display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin:-4px 0 14px;
  padding:4px 0 10px; border-bottom:1px solid var(--border); }
.at-volver{ background:none; border:0; padding:4px 8px 4px 0; font:inherit; font-size:13px;
  color:var(--dim); cursor:pointer; }
.at-volver:hover{ color:var(--ink); text-decoration:underline; text-underline-offset:3px; }
.at-tipo{ font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--faint); }

.at-mako{ display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin:0 0 12px;
  padding:9px 11px; border-radius:11px; background:var(--surface-2);
  border:1px solid var(--border); }
.at-mako .q{ font-size:13px; color:var(--dim); }
.at-mako button{ background:var(--surface); border:1px solid var(--border-strong);
  border-radius:8px; padding:5px 11px; font:inherit; font-size:12.5px; color:var(--ink);
  cursor:pointer; }
.at-mako button:hover:not(:disabled){ border-color:var(--primary); color:var(--primary); }
.at-mako button:disabled{ opacity:.55; cursor:default; }
.at-mako .r{ font-size:12.5px; color:var(--good); }

.at-filtros{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0 0 12px; }
.at-buscar{ flex:1 1 220px; min-width:0; padding:9px 12px; border-radius:10px;
  border:1px solid var(--border-strong); background:var(--surface-2); color:var(--ink);
  font:inherit; font-size:14px; outline:none; }
.at-chip{ flex:none; padding:5px 11px; border-radius:999px; border:1px solid var(--border-strong);
  background:var(--surface); color:var(--dim); font:inherit; font-size:12.5px; cursor:pointer; }
.at-chip.es{ border-color:var(--primary); background:var(--primary-bg); color:var(--primary); font-weight:700; }
.at-chip .n{ font-family:${MONO}; font-size:11px; opacity:.75; }

.at-lista{ list-style:none; margin:0; padding:0; max-height:46vh; overflow-y:auto; }
.at-fila{ display:flex; align-items:center; gap:10px; padding:8px 6px; border-radius:9px;
  cursor:pointer; }
.at-fila:hover{ background:var(--surface-2); }
.at-fila.es{ background:var(--primary-bg); }
.at-fila input{ flex:none; }
.at-fila .em{ flex:none; font-size:14px; line-height:1; }
.at-fila .med{ display:flex; flex-direction:column; gap:1px; min-width:0; flex:1; }
.at-fila .ti{ font-size:13.5px; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.at-fila .de{ font-size:11.5px; color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.at-nota{ font-size:13px; line-height:1.5; color:var(--dim); margin:14px 2px; }
.at-mal{ color:var(--bad); }

.at-pie{ display:flex; align-items:center; gap:10px; margin-top:14px; padding-top:13px;
  border-top:1px solid var(--border); }
.at-n{ flex:1; font-family:${MONO}; font-size:11px; color:var(--faint); }
`;
