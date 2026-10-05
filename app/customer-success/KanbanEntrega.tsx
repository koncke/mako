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
import type { ClienteCruce } from './cruce';
import type { CuentasProp } from './CuentaDeMaKo';
import type { ResumenTrabajo } from './trabajo';
import { ClienteCard } from './ClienteCard';
import { repartirEnEtapas, type EtapaEntrega } from '@/lib/servicio-etapas';
// ⚠️ EL MISMO MOLDE QUE EL PLAN, no una copia. «La animación de arrastrar tarjetas por
// el kanban, eso replicalo tal cual de como lo hacemos en PLAN» (Martín, 05/10/2026).
// Estaba inline en `BoardShell.tsx` y salió a su módulo para que las dos pantallas usen
// la misma pieza: todo lo que ahí está medido —la foto que pinta el sistema operativo,
// el `transform` sobre un ref, el listener en captura, el auto-scroll adentro del
// `dragover`— viajó con el código en vez de volver a escribirse.
import { fotoVaciaDeArrastre, useArrastreCopia } from '@/app/plan/board/arrastre-copia';

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
  onMover, onAbrir, onEquipo, onNuevoCliente, onError,
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
  onAbrir: (leadId: number) => void;
  onEquipo: (leadId: number) => void;
  /**
   * Crear un cliente, naciendo en ESA etapa.
   *
   * ⚠️ RECIBE LA ETAPA, y no es un detalle: un botón de alta por columna que crea
   * siempre en la primera es un control que promete algo que no hace. La etapa viaja
   * para que el alta termine donde se apretó.
   */
  onNuevoCliente: (etapa: string) => void;
  onError: (m: string) => void;
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
  /**
   * DÓNDE VA A CAER: la columna Y el índice exacto. Sólo se repinta cuando CAMBIA.
   *
   * ⚠️ ES LO QUE CONVIERTE «la estoy soltando en esta columna» EN «la estoy soltando
   * ACÁ». Antes esto era sólo la columna, y lo único que se veía era el fondo teñido:
   * el hueco es la mitad del gesto que el Plan sí tiene.
   */
  const [ins, setIns] = useState<{ etapa: string; idx: number } | null>(null);
  const copia = useRef<HTMLElement | null>(null);
  const riel = useRef<HTMLDivElement | null>(null);

  /**
   * Cada cliente en su columna.
   *
   * ⚠️ UN CLIENTE SIN FILA ESTÁ EN LA PRIMERA, no afuera del tablero: la regla y su
   * porqué viven en `repartirEnEtapas`. Acá lo que importa es que el reparto NO se
   * escribe dos veces — el editor de etapas cuenta con la misma función, y si una de
   * las dos supiera la regla y la otra no, el editor diría «0 en Onboarding» sobre una
   * columna con catorce tarjetas a la vista.
   */
  const { porEtapa, huerfanos } = useMemo(
    () => repartirEnEtapas(etapas, clientes, (c) => asignacion[c.leadId]?.etapa),
    [etapas, clientes, asignacion],
  );

  // ── El gesto ───────────────────────────────────────────────────────────────

  /**
   * LOS PUNTOS MEDIOS DE CADA TARJETA, MEDIDOS UNA SOLA VEZ Y EN COORDENADAS DE PÁGINA.
   *
   * ⚠️ UNA VEZ, porque leer layout en cada `dragover` es lo que hace que un arrastre se
   * sienta pegajoso: el tablero del Plan se reportó roto siete veces por re-medir las 55
   * tarjetas de una columna sesenta veces por segundo.
   *
   * ⚠️ Y DE PÁGINA (`+ window.scrollY`), porque el auto-scroll invalida cualquier
   * rectángulo medido contra la ventana — después de correr 600 px, los medidos al agarrar
   * apuntan 600 px arriba del cursor. O sea que el scroll rompía el drop justo cuando
   * hacía su trabajo.
   */
  const medidas = useRef<Record<string, number[]>>({});

  // La copia que sigue al cursor y el empuje VERTICAL salen del molde del Plan. El empuje
  // HORIZONTAL del riel se queda acá: `scrollerDe` sólo mira `overflowY`, así que un riel
  // `overflow-x: auto` no es un scroller para él y devuelve la ventana.
  const { empujarScroll, pararScroll, montarCopia, soltarCopia } = useArrastreCopia();

  function agarrar(e: React.DragEvent<HTMLElement>, leadId: number) {
    const tarjeta = e.currentTarget.closest<HTMLElement>('[data-tarjeta]');
    if (!tarjeta) return;
    enMano.current = leadId;
    setAgarrado(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(leadId));
    fotoVaciaDeArrastre(e.dataTransfer);

    const r = tarjeta.getBoundingClientRect();
    montarCopia(tarjeta, e.clientX - r.left, e.clientY - r.top);

    const out: Record<string, number[]> = {};
    for (const col of document.querySelectorAll<HTMLElement>('[data-etapa]')) {
      out[col.dataset.etapa ?? ''] = [...col.querySelectorAll<HTMLElement>('[data-tarjeta]')]
        .map((el) => { const q = el.getBoundingClientRect(); return q.top + q.height / 2 + window.scrollY; });
    }
    medidas.current = out;
  }

  function soltarGesto() {
    enMano.current = null;
    setAgarrado(null);
    setIns(null);
    medidas.current = {};
    pararScroll();
    soltarCopia();
  }

  /**
   * El empuje HORIZONTAL del riel. Va adentro del `dragover` por lo mismo que el vertical:
   * durante un arrastre nativo el navegador congela `requestAnimationFrame` y los timers, y
   * lo único que sigue entregando es este evento.
   */
  function autoScroll(e: React.DragEvent) {
    const el = riel.current;
    if (!el || enMano.current == null) return;
    const r = el.getBoundingClientRect();
    const BORDE = 110;
    const dir = e.clientX < r.left + BORDE ? -1 : e.clientX > r.right - BORDE ? 1 : 0;
    if (dir !== 0) el.scrollLeft += dir * 18;
  }

  function soltarEn(key: string) {
    const id = enMano.current;
    soltarGesto();
    if (id == null) return;
    // Soltar donde ya estaba no es un movimiento, y el choke point también lo ignora:
    // cortar acá evita el viaje y el cartel de «se movió» sobre algo que no se movió.
    if ((asignacion[id]?.etapa ?? etapas[0]?.key) === key) return;
    onMover(id, key);
  }

  if (!etapas.length) {
    // No puede pasar —`entregaPorDefecto` nunca devuelve `[]`— y si pasara, un tablero
    // de cero columnas no se puede dibujar y hay que decirlo en vez de mostrar nada.
    return <p className="ke-nada">Este servicio no tiene etapas de entrega configuradas.</p>;
  }

  return (
    <div className="ke">
      {/* ⛔ ACÁ HUBO UNA CABECERA Y YA NO HAY NINGUNA (05/10/2026). Se fueron, en este
          orden: «N de M clientes en esta entrega» —que dejó de tener sentido el día que
          TODOS los clientes entran al tablero—, «Etapas de ejemplo · Define las tuyas»
          —una glosa arriba del tablero sobre algo que se arregla en otro lado—, un
          «＋ Nuevo cliente» —que ahora vive en cada columna y además dice en qué etapa
          nace— y «Editar etapas», que se mudó al LÁPIZ del desplegable de servicios: ahí
          edita las etapas de CUALQUIERA de los servicios, no sólo del que estás mirando.
          Un renglón entero para un solo link era, además, el único que separaba la barra
          del tablero. */}
      <div className="ke-riel" ref={riel} onDragOver={autoScroll}>
        {etapas.map((e, i) => {
          const cards = porEtapa[e.key] ?? [];
          return (
            <section key={e.key}
              data-etapa={e.key}
              className={`ke-col${ins?.etapa === e.key ? ' ke-col-destino' : ''}`}
              /* ⚠️ LA LÍNEA DE ARRIBA SALE DE LA ETAPA, no de una banda. El CRM la saca de
                 `CATEGORY[bandToCategory(c.band)]`, que son TRES colores (avanza / nutre /
                 sale); una etapa de entrega no tiene banda —a propósito: acá no hay
                 nutrición ni descarte— así que copiado tal cual pintaría las cinco columnas
                 del mismo verde. `dot` ya es un color por etapa y es el mismo que el punto
                 de la cabecera, así que la línea y el punto no pueden desincronizarse. */
              style={{ borderTop: `3px solid ${e.dot}` }}
              /* `preventDefault` es lo que HABILITA el drop: sin él el navegador lo
                 rechaza y no pasa nada, que se lee como que el arrastre no anda. */
              onDragOver={(ev) => {
                if (enMano.current == null) return;
                ev.preventDefault();
                ev.dataTransfer.dropEffect = 'move';
                const y = ev.clientY + window.scrollY;
                const ms = medidas.current[e.key] ?? [];
                let idx = ms.length;
                for (let k = 0; k < ms.length; k++) { if (y < ms[k]) { idx = k; break; } }
                // Y sólo se re-renderiza cuando el destino cambia DE VERDAD.
                setIns((p) => (p && p.etapa === e.key && p.idx === idx ? p : { etapa: e.key, idx }));
              }}
              onDragLeave={(ev) => {
                if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) {
                  setIns((p) => (p?.etapa === e.key ? null : p));
                }
              }}
              onDrop={(ev) => { ev.preventDefault(); soltarEn(e.key); }}
            >
              <header className="ke-cab">
                <span className="ke-dot" style={{ background: e.dot }} aria-hidden />
                <span className="ke-label">{e.label}</span>
                <span className="ke-n">{cards.length}</span>
              </header>

              {/* ⚠️ CREAR VIVE EN CADA COLUMNA, como «＋ Nuevo lead» en el CRM. Antes era
                  «Sumar un cliente» y SÓLO en la primera, porque un cliente podía estar
                  afuera del tablero; desde que todos están adentro, «sumar» no existe como
                  acción — lo que falta es dar de alta a uno nuevo, y desde una columna eso
                  dice además en qué etapa nace. */}
              <button type="button" className="ke-nuevo-col" onClick={() => onNuevoCliente(e.key)}>
                ＋ Nuevo cliente
              </button>

              {/* EL HUECO: un recuadro punteado del alto de una tarjeta, en el índice
                  exacto donde va a caer y SÓLO en la columna bajo el cursor. Es lo que
                  convierte «la estoy soltando en esta columna» en «la estoy soltando ACÁ».
                  ⚠️ El `+ '1f'` es un sufijo de alfa HEX y sólo funciona con hex de 6
                  dígitos: `dot` lo es (lib/servicio-etapas.ts). Con un `rgb()` o un
                  `var()` el color sale inválido y el navegador lo descarta en silencio. */}
              <ul className="ke-cards">
                {cards.map((c, iCard) => {
                  const a = asignacion[c.leadId];
                  const desde = hace(a?.etapa_desde);
                  const dias = a?.etapa_desde ? (Date.now() - Date.parse(a.etapa_desde)) / 86_400_000 : 0;
                  const trabado = Number.isFinite(dias) && dias >= DIAS_TRABADO;
                  const hueco = ins?.etapa === e.key && ins.idx === iCard;
                  return (
                    <li key={c.leadId}>
                      {hueco && <div className="ke-hueco" style={{ borderColor: e.dot, background: `${e.dot}1f` }} />}
                      {/* ⚠️ EL `draggable` VA EN EL ENVOLTORIO Y NO EN LA TARJETA.
                          `TarjetaEntidad` cubre su superficie con un `<button>` absoluto
                          y pone todo lo demás en `pointer-events: none`. Medido en el
                          navegador: el `dragstart` igual burbujea desde ese botón hasta
                          acá, así que el gesto arranca; lo que NO viaja es el cursor, y
                          por eso la hoja de abajo le pone `grab` a mano. */}
                      {/* ⚠️ AL NODO ORIGEN NO SE LE HACE NADA, y es una decisión medida del
                          Plan, no un olvido: se probaron `opacity: .5`, un borde de color y
                          un `scale`, y los tres se reportaron como ruido — con la copia
                          siguiendo al cursor Y el hueco marcando el destino, atenuar el
                          original hace aparecer la misma tarjeta tres veces. */}
                      <div data-tarjeta className="ke-card"
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
                        />
                      </div>
                    </li>
                  );
                })}
                {/* El hueco del final: soltar DEBAJO de la última tarjeta, y el único que
                    se ve en una columna vacía. */}
                {ins?.etapa === e.key && ins.idx >= cards.length && (
                  <li><div className="ke-hueco" style={{ borderColor: e.dot, background: `${e.dot}1f` }} /></li>
                )}
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

      {/* La hoja de la tarjeta la monta la PANTALLA (ClientesApp), no este tablero: la
          vista de tabla también la necesita. */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
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
/* ⚠️ EL FONDO ES --surface (BLANCO) Y LA TARJETA PASA A --surface-2, igual que en el
   CRM y al revés de como estaba. «Copia el estilo de las columnas... Que no sean
   transparentes» (Martín, 05/10/2026) — y no eran transparentes: la columna estaba en
   --surface-2 (#F5F7FA) sobre un --bg de #F4F6F9, o sea UNA unidad por canal. Tenía
   fondo, y era el mismo fondo de la página. No es transparencia, es contraste cero, y
   sólo pasa en el tema claro por defecto: en oscuro y en true-north los dos tokens sí se
   distinguen. Dar vuelta el par es lo que lo arregla en los tres a la vez.
   ⚠️ Y EL MINIMO DE ALTO ES UNA TARJETA: una columna vacia es un DESTINO, y con 140 px
   era un recuadro mas chico que lo que se le quiere soltar adentro.
   ⚠️ EL ANCHO LO DECIDE LA TARJETA, no el gusto. La de cliente mide 230 px de alto y
   su pie son TRES números con sus rótulos; medido en el navegador, «Recurrentes» entra
   desde los 258 px, y a 300 la banda de 74 px y la marca montada encima quedan en
   proporción en vez de parecer una tarjeta apretada. Con 300 entran cuatro columnas en
   1480; el riel scrollea, que es contenido corriéndose y no navegación escondida. */
.ke-col {
  flex: 0 0 300px; display: flex; flex-direction: column; gap: 8px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 11px; min-height: 248px;
  transition: background .12s, border-color .12s;
}
/* ⚠️ LA TARJETA SE DA VUELTA ADENTRO DE LA COLUMNA, y acá, no en TarjetaEntidad: esa
   pieza la usan /admin y la ficha de un workspace, donde la columna no existe. */
.ke-card .cl-card { background: var(--surface-2); }
/* El destino se marca en la COLUMNA, sin mover nada. El HUECO dice el lugar exacto. */
.ke-col-destino { background: var(--primary-weak, var(--accent-bg)); border-color: var(--primary, var(--accent)); }

/* El hueco: el alto de una tarjeta, punteado del color de la etapa. */
.ke-hueco { height: 230px; border-radius: 18px; border: 2px dashed currentColor; margin-bottom: 10px; }
.ke-cards > li:last-child > .ke-hueco:only-child { margin-bottom: 0; }

.ke-cab { display: flex; align-items: center; gap: 7px; padding: 0 2px; }
.ke-dot { width: 8px; height: 8px; border-radius: 999px; flex: none; }
.ke-label { font-size: 13px; font-weight: 700; color: var(--ink); flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* El pill contrasta contra la columna, que ahora es --surface: va en --surface-2. */
.ke-n { margin-left: auto; flex: none; font-size: 11.5px; font-weight: 700; color: var(--dim); background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 0 7px; }
/* Va PRIMERO adentro de la columna, arriba de las tarjetas, igual que el del CRM. */
.ke-nuevo-col {
  width: 100%; border: 1px dashed var(--border-strong); background: none; border-radius: 10px;
  padding: 8px; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--dim); cursor: pointer;
  transition: background .12s, border-color .12s, color .12s;
}
.ke-nuevo-col:hover { color: var(--ink); border-color: var(--ink); background: var(--surface-2); }
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
