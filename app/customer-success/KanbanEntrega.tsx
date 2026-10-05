'use client';

// =============================================================================
// KanbanEntrega — en qué etapa de la entrega de UN servicio está cada cliente
// =============================================================================
// «si un CLIENTE actual llega a X etapa de mi SERVICIO (onboarding, hito 1, hito 2, o
// lo que sea que el usuario configure en su entrega de servicio…)» (Martín, 05/10/2026).
// Las columnas son las etapas de ESE servicio y las tarjetas son los clientes.
//
// ⚠️ ES POR SERVICIO Y NO POR CLIENTE, y eso lo decidió el pedido: «Todo por producto,
// siempre, justamente pueden tener muchos productos». Un cliente que compró la mentoría
// y el servicio mensual aparece en los dos tableros, en la etapa que le toca en cada uno
// — y en el CRM sigue siendo `ganado`, porque las dos etapas son simultáneas.
//
// ⚠️ LA TARJETA ES LA DE CLIENTE, LA MISMA PIEZA, no una compacta parecida. Pedido de
// Martín (05/10/2026): «dentro del kanban, las tarjetas no son como las del CRM, son
// como las nuevas que hicimos, de clientes». Antes acá había una tarjeta propia —avatar
// chico, nombre y un renglón— calcada del CRM; el reemplazo no es cosmético: la grilla
// de tarjetas DEJÓ DE EXISTIR en esta pantalla, así que si el kanban dibujara otra cosa,
// la tarjeta de cliente no se vería en ningún lado.
//
// Lo propio de esta pantalla entra por los dos huecos que `ClienteCard` ofrece:
// `chipExtra` (hace cuánto que no se mueve, que es de DÓNDE ESTÁ y no del cliente — la
// misma persona tiene uno distinto en cada servicio) y `accionExtra` (sacarlo de la
// entrega).
//
// ─────────────────────────────────────────────────────────────────────────────
// EL ARRASTRE: imagen VACÍA y la copia la dibujamos nosotros
// ─────────────────────────────────────────────────────────────────────────────
// La foto que sigue al cursor la dibuja el SISTEMA OPERATIVO y ninguna regla CSS la
// gobierna: en Windows, Chrome la pinta semitransparente y la ancla donde quiere. Por
// eso se le pasa un canvas de 1x1 y la copia se monta a mano, con `position: fixed` y
// `translate3d` sobre un ref — nunca con `setState`, que redibujaría el tablero sesenta
// veces por segundo. Es el mismo molde que ya usa el arrastre de columnas del CRM
// (`app/crm/CrmBoard.tsx`), y está documentado en AGENTS.md.
//
// Tres detalles que, sin ellos, el gesto se ve roto:
//   · el listener de `dragover` va en `document` y EN CAPTURA: el de las columnas no
//     cubre los huecos entre ellas ni el fondo, y ahí la copia se queda clavada;
//   · se limpia en `dragend` Y en `drop`, los dos, o queda un nodo colgado por arrastre;
//   · al nodo ORIGEN no se le toca el TAMAÑO (un borde y una sombra, nada de `height: 0`):
//     colapsarlo deja el gesto sin salida.
//
// Y el auto-scroll horizontal va adentro del `dragover`: durante un arrastre nativo el
// navegador congela `requestAnimationFrame` y los timers, así que un auto-scroll sobre
// rAF mueve 0 px.

import { useMemo, useRef, useState } from 'react';
import { Marca } from '@/app/_components/Marca';
import { EstilosTarjeta } from '@/app/_components/TarjetaEntidad';
import { Modal } from '@/app/_ui';
import type { ClienteCruce } from './cruce';
import type { CuentasProp } from './CuentaDeMaKo';
import type { ResumenTrabajo } from './trabajo';
import { ClienteCard, colorDe } from './ClienteCard';
import type { EtapaEntrega } from '@/lib/servicio-etapas';

/** Dónde está un cliente en esta entrega. */
export type Asignacion = { etapa: string; etapa_desde: string; por: string };

/**
 * Hace cuánto que está en su etapa, EN UNA FRASE.
 *
 * Una sola unidad: en una tarjeta, «3 días» informa y «3 días 4 h 12 min» ocupa el
 * lugar del nombre. Y devuelve la frase entera —«hace 3 días», «recién»— en vez de un
 * pedazo al que haya que ponerle «hace» afuera: con el prefijo del lado del que llama,
 * el caso corto sale «hace recién».
 */
function hace(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const ms = Date.now() - t;
  if (ms < 0) return null;
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `hace ${h} h`;
  return 'recién';
}

/** A partir de cuántos días sin moverse la tarjeta lo dice en ámbar. */
const DIAS_TRABADO = 21;

export function KanbanEntrega({
  etapas, origen, servicio, clientes, asignacion, numeroDe,
  trabajoDe, tableroOk, cuentas,
  onMover, onSacar, onAbrir, onEquipo, onNuevoCliente, onEditarEtapas, onError, puedeEditar,
}: {
  etapas: EtapaEntrega[];
  /** `default` = nadie configuró estas columnas. La pantalla lo DICE. */
  origen: 'declarado' | 'default';
  servicio: string;
  /** La cartera que la barra dejó a la vista, ya buscada y filtrada. */
  clientes: ClienteCruce[];
  /** leadId → su etapa en ESTE servicio. Lo que no está acá, no está en la entrega. */
  asignacion: Record<number, Asignacion>;
  numeroDe: Map<number, number>;
  /** Los tres números del tablero que la tarjeta pinta al pie. */
  trabajoDe: (leadId: number) => ResumenTrabajo | null;
  /** Con el tablero caído la tarjeta pone un renglón en vez de tres ceros: un 0 es una
   *  afirmación sobre su trabajo, y si la lectura falló nadie la hizo. */
  tableroOk: boolean;
  cuentas?: CuentasProp;
  onMover: (leadId: number, etapa: string) => void;
  onSacar: (leadId: number) => void;
  onAbrir: (leadId: number) => void;
  onEquipo: (leadId: number) => void;
  /** Crear un cliente. ⚠️ VIVE ACÁ PORQUE LA GRILLA SE FUE: era la primera tarjeta de
   *  la grilla, y sin este botón la única puerta de alta quedaba en la vista de tabla. */
  onNuevoCliente: () => void;
  onEditarEtapas: () => void;
  onError: (m: string) => void;
  puedeEditar: boolean;
}) {
  /**
   * La tarjeta en la mano, DOS VECES: un ref para DECIDIR y un estado para PINTAR.
   *
   * ⚠️ NO ES UNA DUPLICACIÓN: son dos preguntas con dos relojes. React vuelca un
   * `setState` un frame después, y los handlers del gesto corren ANTES — medido en el
   * navegador el 05/10/2026: con la decisión colgada del estado, el primer `dragover`
   * leía `null`, no hacía `preventDefault()` y el `drop` no llegaba nunca. Es la misma
   * familia que la foto del arrastre, que sale opaca aunque atenúes la tarjeta en el
   * mismo handler. Lo que decide va en el ref; el estado sólo mueve un borde.
   */
  const enMano = useRef<number | null>(null);
  const [agarrado, setAgarrado] = useState<number | null>(null);
  /** La columna sobre la que está el cursor. Sólo se repinta cuando CAMBIA. */
  const [encima, setEncima] = useState<string | null>(null);
  const [sumando, setSumando] = useState(false);
  const copia = useRef<HTMLElement | null>(null);
  const riel = useRef<HTMLDivElement | null>(null);

  /** Los clientes de esta entrega, por etapa. */
  const porEtapa = useMemo(() => {
    // ⚠️ SE INICIALIZA CON EL UNIVERSO. Una columna sin clientes tiene que existir como
    // lista VACÍA: si no entrara al mapa, el lector recibiría `undefined` y «nadie acá»
    // sería indistinguible de «no pude leer».
    const m: Record<string, ClienteCruce[]> = {};
    for (const e of etapas) m[e.key] = [];
    for (const c of clientes) {
      const a = asignacion[c.leadId];
      // Una etapa guardada que ya no está en el catálogo NO se dibuja en ningún lado, y
      // eso es un cliente invisible: lo junta la bolsa de abajo, que lo dice.
      if (a && m[a.etapa]) m[a.etapa].push(c);
    }
    return m;
  }, [etapas, clientes, asignacion]);

  /**
   * Los que están en la entrega con una etapa que el catálogo ya no tiene.
   *
   * ⚠️ ESTO NO PUEDE QUEDAR MUDO. `nuevaClaveEtapa` nunca reusa una clave borrada —para
   * que nadie reaparezca dentro de una columna nueva— así que el cliente de una etapa
   * eliminada queda sin columna. Sin este renglón se vería como que se fue de la
   * entrega, que es una afirmación falsa.
   */
  const huerfanos = useMemo(
    () => clientes.filter((c) => { const a = asignacion[c.leadId]; return a && !etapas.some((e) => e.key === a.etapa); }),
    [clientes, asignacion, etapas],
  );

  /** Los clientes de la cartera que todavía no están en esta entrega. */
  const afuera = useMemo(() => clientes.filter((c) => !asignacion[c.leadId]), [clientes, asignacion]);

  const enEntrega = clientes.length - afuera.length;

  // ── El gesto ───────────────────────────────────────────────────────────────

  function agarrar(e: React.DragEvent<HTMLElement>, leadId: number) {
    const tarjeta = e.currentTarget.closest<HTMLElement>('[data-tarjeta]');
    if (!tarjeta) return;
    enMano.current = leadId;
    setAgarrado(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(leadId));
    try {
      const vacio = document.createElement('canvas');
      vacio.width = 1; vacio.height = 1;
      e.dataTransfer.setDragImage(vacio, 0, 0);
    } catch { /* si el navegador no deja, queda la suya y el gesto igual funciona */ }

    const r = tarjeta.getBoundingClientRect();
    const clon = tarjeta.cloneNode(true) as HTMLElement;
    Object.assign(clon.style, {
      position: 'fixed', top: '0', left: '0', width: `${r.width}px`, margin: '0',
      // El fondo se fuerza OPACO: si el computado del original fuera transparente, la
      // copia hereda lo que haya detrás y se ve igual de fantasmal que la del sistema.
      background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '12px',
      boxShadow: '0 18px 40px rgba(18,21,27,.34)', pointerEvents: 'none', zIndex: '3000',
      transform: `translate3d(${r.left}px, ${r.top}px, 0)`, transition: 'none', opacity: '1',
    });
    document.body.appendChild(clon);
    copia.current = clon;

    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const seguir = (ev: globalThis.DragEvent) => {
      if (!copia.current) { document.removeEventListener('dragover', seguir, true); return; }
      copia.current.style.transform = `translate3d(${ev.clientX - dx}px, ${ev.clientY - dy}px, 0)`;
    };
    document.addEventListener('dragover', seguir, true);
    const fin = () => {
      document.removeEventListener('dragover', seguir, true);
      document.removeEventListener('dragend', fin, true);
      document.removeEventListener('drop', fin, true);
      copia.current?.remove();
      copia.current = null;
    };
    document.addEventListener('dragend', fin, true);
    document.addEventListener('drop', fin, true);
  }

  function soltarGesto() { enMano.current = null; setAgarrado(null); setEncima(null); }

  /** Auto-scroll horizontal. Va adentro del `dragover` porque es lo único que el
   *  navegador sigue entregando durante un arrastre nativo. */
  function autoScroll(e: React.DragEvent) {
    const el = riel.current;
    if (!el || enMano.current == null) return;
    const r = el.getBoundingClientRect();
    const BORDE = 90;
    const dir = e.clientX < r.left + BORDE ? -1 : e.clientX > r.right - BORDE ? 1 : 0;
    if (dir !== 0) el.scrollLeft += dir * 18;
  }

  function soltarEn(key: string) {
    const id = enMano.current;
    soltarGesto();
    if (id == null) return;
    // Soltar donde ya estaba no es un movimiento. El choke point también lo ignora,
    // pero cortar acá evita el viaje y el banner de «se movió» sobre algo que no.
    if (asignacion[id]?.etapa === key) return;
    onMover(id, key);
  }

  if (!etapas.length) {
    // No puede pasar —`entregaPorDefecto` nunca devuelve `[]`— y si pasara, un tablero
    // de cero columnas no se puede dibujar y hay que decirlo en vez de mostrar nada.
    return <p className="ke-nada">Este servicio no tiene etapas de entrega configuradas.</p>;
  }

  return (
    <div className="ke">
      <div className="ke-arriba">
        <span className="ke-cuenta">
          {enEntrega} de {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} en esta entrega
        </span>
        {/* ⚠️ «ORIGEN DEFAULT» SE DICE. Sin este renglón, las etapas genéricas se leen
            como una decisión del negocio — es el síntoma que ya se pagó con los funnels,
            donde tres productos nuevos mostraban lo mismo que el embudo del negocio y
            los tres parecían roto. */}
        {origen === 'default' && (
          <span className="ke-default">
            Etapas de ejemplo.{' '}
            {puedeEditar
              ? <button type="button" onClick={onEditarEtapas}>Define las tuyas</button>
              : 'Las define un administrador.'}
          </span>
        )}
        {origen === 'declarado' && puedeEditar && (
          <button type="button" className="ke-editar" onClick={onEditarEtapas}>Editar etapas</button>
        )}
        {/* ⚠️ CREAR UN CLIENTE VIVE ACÁ DESDE QUE LA GRILLA SE FUE. Era la primera
            tarjeta punteada de la grilla; al quedar sólo kanban y tabla, sin esto el
            alta sólo existía en la tabla — o sea, escondida detrás de cambiar de vista.
            No se confunde con «Sumar un cliente» de la primera columna: aquél mete a un
            cliente QUE YA EXISTE en esta entrega. */}
        <button type="button" className="ke-nuevo" onClick={onNuevoCliente}>＋ Nuevo cliente</button>
      </div>

      <div className="ke-riel" ref={riel} onDragOver={autoScroll}>
        {etapas.map((e, i) => {
          const cards = porEtapa[e.key] ?? [];
          return (
            <section key={e.key}
              className={`ke-col${encima === e.key ? ' ke-col-destino' : ''}`}
              onDragOver={(ev) => {
                if (enMano.current == null) return;
                ev.preventDefault();
                ev.dataTransfer.dropEffect = 'move';
                // Sólo se repinta cuando el destino CAMBIA: es la diferencia entre un
                // arrastre que se siente bien y uno que redibuja el tablero 60 veces
                // por segundo.
                setEncima((p) => (p === e.key ? p : e.key));
              }}
              onDrop={(ev) => { ev.preventDefault(); soltarEn(e.key); }}
            >
              <header className="ke-cab">
                <span className="ke-dot" style={{ background: e.dot }} aria-hidden />
                <span className="ke-label">{e.label}</span>
                <span className="ke-n">{cards.length}</span>
              </header>

              {/* Sumar vive en la PRIMERA columna, que es donde entra un cliente nuevo
                  a una entrega. En las demás sería ofrecer saltearse el onboarding. */}
              {i === 0 && (
                <button type="button" className="ke-sumar" onClick={() => setSumando(true)}
                  disabled={!afuera.length}
                  title={afuera.length ? 'Sumar un cliente a esta entrega' : 'Todos tus clientes ya están en esta entrega'}>
                  ＋ Sumar un cliente
                </button>
              )}

              <ul className="ke-cards">
                {cards.map((c) => {
                  const a = asignacion[c.leadId];
                  const desde = hace(a?.etapa_desde);
                  const dias = a?.etapa_desde ? (Date.now() - Date.parse(a.etapa_desde)) / 86_400_000 : 0;
                  const trabado = Number.isFinite(dias) && dias >= DIAS_TRABADO;
                  const nombre = c.nombre.trim() || 'Sin nombre';
                  return (
                    <li key={c.leadId}>
                      {/* ⚠️ EL `draggable` VA EN EL ENVOLTORIO Y NO EN LA TARJETA.
                          `TarjetaEntidad` cubre su superficie con un `<button>` absoluto
                          y pone todo lo demás en `pointer-events: none`. Medido en el
                          navegador: el `dragstart` igual burbujea desde ese botón hasta
                          acá, así que el gesto arranca; lo que NO viaja es el cursor, y
                          por eso la hoja de abajo le pone `grab` a mano. */}
                      <div data-tarjeta className={`ke-card${agarrado === c.leadId ? ' ke-card-mano' : ''}`}
                        draggable
                        onDragStart={(ev) => agarrar(ev, c.leadId)}
                        onDragEnd={soltarGesto}
                      >
                        <ClienteCard
                          c={c} n={numeroDe.get(c.leadId) ?? 0}
                          trabajo={trabajoDe(c.leadId)} tableroOk={tableroOk}
                          cuentas={cuentas} onError={onError}
                          onAbrir={() => onAbrir(c.leadId)}
                          onEquipo={() => onEquipo(c.leadId)}
                          chipExtra={desde && (
                            <span className={`ke-chip${trabado ? ' ke-chip-trabado' : ''}`}>
                              {trabado ? `${desde.replace(/^hace /, '')} sin moverse` : desde}
                            </span>
                          )}
                          accionExtra={(
                            <button type="button" className="ke-sacar"
                              title={`Sacar a ${nombre} de la entrega de ${servicio}`}
                              aria-label={`Sacar a ${nombre} de la entrega de ${servicio}`}
                              onClick={() => onSacar(c.leadId)}>Sacar</button>
                          )}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {/* ⚠️ UNA COLUMNA VACÍA LO DICE. Sin esto, una columna sin tarjetas y una
                  columna que no se pudo leer se ven iguales — y el hueco además no deja
                  claro que ahí se puede soltar. */}
              {!cards.length && <p className="ke-vacia">Sin clientes.</p>}
            </section>
          );
        })}
      </div>

      {/* ⚠️ LOS HUÉRFANOS NO SE CALLAN: ver la nota de arriba. */}
      {huerfanos.length > 0 && (
        <p className="ke-huerfanos">
          {huerfanos.length === 1 ? 'Un cliente está' : `${huerfanos.length} clientes están`} en una etapa
          que ya no existe: {huerfanos.map((c) => c.nombre.trim() || 'Sin nombre').join(', ')}. Muévelos a una columna.
        </p>
      )}

      {sumando && (
        <SumarCliente
          servicio={servicio} candidatos={afuera} numeroDe={numeroDe}
          etapa={etapas[0]}
          onElegir={(leadId) => { setSumando(false); onMover(leadId, etapas[0].key); }}
          onCerrar={() => setSumando(false)}
        />
      )}

      {/* ⚠️ LA HOJA DE LA TARJETA SE MONTA ACÁ. Hasta hoy la traía `GrillaTarjetas`, y
          al irse la grilla de esta pantalla el `<style>` se iba con ella: las tarjetas
          salían como spans sin banda, sin bordes y sin pie — no un error, una tarjeta
          mal hecha. */}
      <EstilosTarjeta />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/**
 * Quién entra a esta entrega.
 *
 * ⚠️ ES UN PICKER Y NO UNA COLUMNA «Sin empezar». Esa columna habría puesto la cartera
 * ENTERA a la izquierda del tablero —con veinte clientes, un muro— y además habría
 * afirmado que todos ésos deberían estar en esta entrega, que es un juicio que nadie
 * hizo: un cliente puede no haber comprado este servicio.
 */
function SumarCliente({ servicio, candidatos, numeroDe, etapa, onElegir, onCerrar }: {
  servicio: string;
  candidatos: ClienteCruce[];
  numeroDe: Map<number, number>;
  etapa: EtapaEntrega;
  onElegir: (leadId: number) => void;
  onCerrar: () => void;
}) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const lista = t
    ? candidatos.filter((c) => `${c.nombre} ${c.empresa ?? ''}`.toLowerCase().includes(t))
    : candidatos;

  return (
    <Modal titulo={`Sumar a la entrega de ${servicio}`} onCerrar={onCerrar} ancho={520}>
      <p className="ke-sub">Entra en <strong>{etapa.label}</strong>, la primera etapa.</p>
      <input className="ke-buscar" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o empresa…" aria-label="Buscar un cliente" autoFocus />
      <ul className="ke-lista">
        {lista.map((c) => {
          const nombre = c.nombre.trim() || 'Sin nombre';
          return (
            <li key={c.leadId}>
              <button type="button" onClick={() => onElegir(c.leadId)}>
                <Marca icono={c.icono ?? c.avatarUrl} nombre={nombre} tam={24}
                  y={c.avatarY} color={colorDe(nombre)} />
                <span className="ke-lnom">{nombre}</span>
                <span className="ke-lnum">Cliente {numeroDe.get(c.leadId) ?? 0}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {/* «No encontré» y «no hay» son dos pantallas. */}
      {!lista.length && (
        <p className="ke-nada">
          {candidatos.length ? 'Ningún cliente coincide con lo que buscaste.' : 'Todos tus clientes ya están en esta entrega.'}
        </p>
      )}
    </Modal>
  );
}

const CSS = `
.ke { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.ke-arriba { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ke-cuenta { font-size: 12.5px; color: var(--dim); }
.ke-default { font-size: 12.5px; color: var(--dim); }
.ke-default button, .ke-editar {
  background: none; border: none; padding: 0; font: inherit; color: var(--accent-ink);
  font-weight: 600; cursor: pointer; text-decoration: underline;
}
.ke-editar { margin-left: auto; }
.ke-nuevo {
  flex: none; padding: 6px 12px; border-radius: 9px; border: 1px solid var(--border-strong);
  background: var(--surface); color: var(--ink); cursor: pointer;
  font: inherit; font-size: 12.5px; font-weight: 600; white-space: nowrap;
}
.ke-nuevo:hover { border-color: var(--ink); }

/* El riel scrollea en horizontal: es CONTENIDO que se corre, no navegación. */
.ke-riel {
  display: flex; gap: 12px; overflow-x: auto; overflow-y: hidden;
  padding-bottom: 6px; align-items: flex-start; scrollbar-width: thin;
}
/* ⚠️ Y EL MINIMO DE ALTO ES UNA TARJETA, no un numero cualquiera: una columna vacia
   es un DESTINO, y con 140 px era un recuadro mas chico que lo que se le quiere soltar
   adentro. Con el alto de una tarjeta, soltar en la columna de al lado no exige apuntar.
   ⚠️ EL ANCHO LO DECIDE LA TARJETA, no el gusto. La de cliente mide 230 px de alto y
   su pie son TRES números con sus rótulos; medido en el navegador, «Recurrentes» entra
   desde los 258 px, y a 300 la banda de 74 px y la marca montada encima quedan en
   proporción en vez de parecer una tarjeta apretada. Con 300 entran cuatro columnas en
   1480; el riel scrollea, que es contenido corriéndose y no navegación escondida. */
.ke-col {
  flex: 0 0 300px; display: flex; flex-direction: column; gap: 8px;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 14px;
  padding: 11px; min-height: 248px;
  transition: background .12s, border-color .12s;
}
/* El destino se marca en la COLUMNA y no moviendo las tarjetas: un hueco más la copia
   que sigue al cursor hacen aparecer al mismo cliente tres veces. */
.ke-col-destino { background: var(--accent-bg); border-color: var(--accent); }
.ke-cab { display: flex; align-items: center; gap: 7px; padding: 0 2px; }
.ke-dot { width: 8px; height: 8px; border-radius: 999px; flex: none; }
.ke-label { font-size: 13px; font-weight: 700; color: var(--ink); flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ke-n { margin-left: auto; flex: none; font-size: 11.5px; font-weight: 700; color: var(--dim); background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 0 7px; }
.ke-sumar {
  width: 100%; border: 1px dashed var(--border-strong); background: none; border-radius: 10px;
  padding: 7px; font-size: 12.5px; font-weight: 600; color: var(--dim); cursor: pointer;
}
.ke-sumar:hover:not(:disabled) { color: var(--ink); border-color: var(--ink); }
.ke-sumar:disabled { opacity: .45; cursor: default; }
.ke-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
/* El envoltorio que se arrastra. La tarjeta de adentro trae su propia caja. */
.ke-card { display: flex; border-radius: 18px; }
.ke-card > * { width: 100%; }
/* ⚠️ EL CURSOR SE PONE A MANO. El botón que TarjetaEntidad monta en inset: 0 para
   que la tarjeta entera sea clicable declara cursor: pointer, y gana sobre el del
   envoltorio: sin esto, algo que se puede arrastrar muestra el cursor de un click. */
.ke-card .cl-abrir { cursor: grab; }
/* ⚠️ LA FILA DE ACCIONES BAJA DE RENGLON ACA, Y SOLO ACA. En la grilla medía 320 px y
   llevaba dos controles; en una columna mide 276 y, para una AGENCIA, lleva cuatro
   (entrar como, el menu, y el Sacar de esta pantalla). Un flex sin wrap no los apila:
   los desborda fuera de la tarjeta, que ademas tiene overflow hidden — o sea que el
   ultimo control desaparece sin dejar rastro. */
.ke-card .cl-acc { flex-wrap: wrap; row-gap: 7px; }
.ke-card:active .cl-abrir { cursor: grabbing; }
/* Al nodo ORIGEN no se le toca el TAMAÑO: un anillo, nada de altura cero. */
.ke-card-mano .cl-card { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-bg); }

/* El chip de hace cuánto, al lado del nombre: es de DÓNDE ESTÁ, no del cliente. */
.ke-chip { font-size: 10.5px; font-weight: 650; color: var(--dim);
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px;
  padding: 1px 8px; white-space: nowrap; }
.ke-chip-trabado { color: var(--bad); border-color: var(--bad); background: var(--bad-bg); }

/* ⚠️ flex: none Y CORTO: la fila de acciones es nowrap, así que un hijo ancho la
   desborda en vez de bajar de renglón. */
.ke-sacar {
  flex: none; padding: 6px 10px; border-radius: 9px; border: 1px solid var(--border);
  background: var(--surface); color: var(--dim); cursor: pointer;
  font: inherit; font-size: 12.5px; font-weight: 600; white-space: nowrap;
}
.ke-sacar:hover { color: var(--bad); border-color: var(--bad); }
.ke-vacia { margin: 0; padding: 10px 2px; font-size: 12px; color: var(--dim); }
.ke-huerfanos { margin: 0; font-size: 12.5px; color: var(--bad); }
.ke-nada { margin: 10px 0 0; font-size: 13px; color: var(--dim); }

.ke-sub { margin: 0 0 10px; font-size: 13px; color: var(--dim); }
.ke-buscar { width: 100%; padding: 9px 11px; border: 1px solid var(--border); border-radius: 10px; font: inherit; font-size: 13.5px; background: var(--surface); color: var(--ink); }
.ke-lista { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 340px; overflow-y: auto; }
.ke-lista button {
  width: 100%; display: flex; align-items: center; gap: 9px; text-align: left;
  background: none; border: 1px solid transparent; border-radius: 10px; padding: 7px 8px;
  font: inherit; cursor: pointer; color: var(--ink);
}
.ke-lista button:hover { background: var(--surface-2); border-color: var(--border); }
.ke-lnom { flex: 1 1 auto; min-width: 0; font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ke-lnum { flex: none; font-size: 11.5px; color: var(--dim); }
`;
