'use client';

// =============================================================================
// Clientes — los leads GANADOS del workspace, y cómo va lo que se les vendió
// =============================================================================
// La pantalla contesta cuatro preguntas, en este orden:
//
//   1. ¿Quiénes son mis clientes?   los `estado_lead = 'ganado'` del CRM
//   2. ¿Cuál necesita atención HOY? la SEÑAL, y es lo que ORDENA la lista
//   3. ¿Qué le prometí?             la ficha, tab «Contrato»
//   4. ¿Qué le debo?                la ficha, tab «Trabajo»
//
// ⚠️ ESTA PANTALLA ES PARA CUALQUIER WORKSPACE. Se rearmó de cero el 26/09/2026
// porque la anterior giraba sobre el programa de 44 clases de UN cliente: el
// temario, Whop, «clases vistas» y el link del cuestionario. Nada de eso es
// universal, y la mitad de la card afirmaba cosas que para 13 de los 27 clientes
// del producto no se podían ni calcular.
//
// ⚠️ LA SEÑAL NO SE CALCULA ACÁ. Viene resuelta en `c.senal` desde
// `lib/cs-senal.ts`, que es una función pura con test, y la lista llega YA
// ORDENADA por `ordenCartera` desde la página. Esta pantalla no vuelve a
// ordenar: dos lugares que contestan «¿cuál necesita atención hoy?» son dos
// respuestas que van a divergir, y la que gana sería la que nadie testea.
//
// ⚠️ «NO LO SÉ» Y «ESTÁ BIEN» SON DOS COSAS, y por eso son dos grupos. El nivel
// `null` va ARRIBA de `bien`: un cliente sin contrato cargado o sin una sola
// conversación leída necesita que lo miren más que uno que se midió y está al día.

import { useState } from 'react';
import { Pagina, PageHeader, Banner, EmptyState, ErrorState, Status, MONO, useToast, Toast, type Tono } from '@/app/_ui';
import type { ClienteCartera, EstadoCliente } from '@/lib/cs-cartera';
import { claveNivel, type ClaveNivel } from '@/lib/cs-senal';
import type { ResumenTrabajo, TableroCartera } from './trabajo';
import { marcarEstadoAction } from './actions';
import { DetalleCliente } from './DetalleCliente';

/** El color de cada nivel. NUNCA es el único portador: la card escribe el motivo
 *  al lado, y el grupo lleva su título.
 *
 *  ⚠️ `claveNivel` NO se reescribe acá: sale de `lib/cs-senal.ts`, que es donde
 *  vive el nivel. Un ternario propio es la segunda copia de la misma regla, y el
 *  día que se escriba al revés la pantalla va a decir que un cliente sin datos
 *  está al día. */
export const TONO_SENAL: Record<ClaveNivel, Tono> = {
  atencion: 'bad', 'sin-datos': 'neutral', bien: 'good',
};

const COLOR_BANDA: Record<ClaveNivel, string> = {
  atencion: 'var(--bad)', 'sin-datos': 'var(--border-strong)', bien: 'var(--good)',
};

const GRUPOS: { clave: ClaveNivel; titulo: string }[] = [
  { clave: 'atencion', titulo: 'Necesitan algo hoy' },
  { clave: 'sin-datos', titulo: 'Sin datos para saberlo' },
  { clave: 'bien', titulo: 'Al día' },
];

/** «Semana 10 de 16», o «Semana 10» si el contrato no dice cuántas dura. */
export function relojTexto(r: ClienteCartera['reloj']): string {
  if (r.semana === null) return 'Sin fecha de arranque';
  if (r.semanasTotales) return `Semana ${r.semana} de ${r.semanasTotales}`;
  return `Semana ${r.semana}`;
}

/**
 * El trabajo abierto, en un número.
 *
 * ⚠️ Las RECURRENTES se dicen aparte y NO se suman a las abiertas: algo que se
 * repite para siempre no se puede terminar, así que contarlo como pendiente
 * miente en la dirección tranquilizadora.
 *
 * ⚠️ Y los tres estados son DISTINTOS: no pude leer el tablero / no cruzó con
 * ningún proyecto / cruzó y no tiene nada abierto.
 */
export function trabajoTexto(t: ResumenTrabajo | null, tableroOk: boolean): string {
  if (!tableroOk) return 'No pude leer el tablero';
  // ⚠️ `como === null` es «no cruzó con NINGÚN proyecto», y el tablero devuelve una
  // fila en cero para todos los de la cartera —así que sin esta rama los dos casos
  // salían iguales, «0 abiertas». Medido en el ws1: 11 de 13 clientes no tienen
  // proyecto propio y la card les decía que miramos y no había nada.
  if (!t || t.como === null) return 'Sin proyecto suyo en el tablero';
  const partes: string[] = [];
  if (t.proyectos) partes.push(`${t.proyectos} ${t.proyectos === 1 ? 'proyecto' : 'proyectos'}`);
  partes.push(`${t.abiertas} ${t.abiertas === 1 ? 'abierta' : 'abiertas'}`);
  if (t.recurrentes) partes.push(`${t.recurrentes} se ${t.recurrentes === 1 ? 'repite' : 'repiten'}`);
  return partes.join(' · ');
}

export function ClientesApp({ clientes, tablero, error }: {
  /** Ya vienen ORDENADOS por `ordenCartera` (lib/cs-senal.ts) y con su señal
   *  resuelta contra el tablero. Acá sólo se agrupan. */
  clientes: ClienteCartera[];
  /** Qué sabe el TABLERO de cada uno. Números nada más; el detalle lo pide la ficha. */
  tablero: TableroCartera;
  /** La cartera no se pudo leer. NO es «no tenés clientes»: son dos pantallas. */
  error?: string;
}) {
  const [abierto, setAbierto] = useState<ClienteCartera | null>(null);
  const [verCerrados, setVerCerrados] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const { toast, show, clear } = useToast();

  async function marcar(c: ClienteCartera, estado: EstadoCliente) {
    setGuardando(true); setAbierto(null);
    const r = await marcarEstadoAction(c.leadId, estado);
    setGuardando(false);
    show(r.ok ? 'Estado guardado' : (r.error ?? 'No se pudo guardar'), undefined, r.ok ? 'good' : 'bad');
  }

  const resumenDe = (leadId: number): ResumenTrabajo | null =>
    (tablero.ok ? tablero.porLead[leadId] : null) ?? null;

  const activos = clientes.filter((c) => c.estado === 'activo' || c.estado === 'pausado');
  const cerrados = clientes.filter((c) => c.estado === 'graduado' || c.estado === 'baja');

  return (
    <Pagina ancho="completo">
      <PageHeader
        titulo="Clientes"
        estado={activos.length > 0
          ? <Status>{activos.length} {activos.length === 1 ? 'activo' : 'activos'}</Status>
          : undefined}
      />

      {/* ⚠️ «Cero resultados» no es «no hay». Si el tablero no se pudo leer, las cards
          dirían «sin proyecto» sobre clientes que sí tienen trabajo cargado. */}
      {!error && !tablero.ok && <Banner tono="bad">No pude leer el tablero. {tablero.error}</Banner>}

      {/* Lo que NO cruzó, arriba y no escondido: un cliente sin proyecto y un proyecto
          sin cliente casi siempre son el mismo, con el nombre corrido una palabra. */}
      {tablero.ok && tablero.huerfanos.length > 0 && (
        <Banner tono="warn">
          {tablero.huerfanos.length === 1 ? '1 proyecto de cliente' : `${tablero.huerfanos.length} proyectos de cliente`}
          {' no cruzan con nadie: '}
          {/* Comillas y no un separador pelado: un nombre de proyecto puede TRAER un
              «·» adentro (medido en el ws1: «HMO · Cliente: Macario Romero»), y ahí
              la lista se lee con un ítem de más. */}
          {tablero.huerfanos.map((h) => `«${h.nombre}»`).join(' ')}
        </Banner>
      )}

      {error ? (
        <ErrorState titulo="No pude leer tus clientes" detalle={error} detalleTecnico={error} />
      ) : activos.length === 0 && cerrados.length === 0 ? (
        // EL VACÍO ES EL CASO PRINCIPAL: un workspace que recién empieza no ganó a
        // nadie todavía, y ésta es la pantalla que más se va a ver. Se lee como
        // «todavía no», y dice en UNA frase de dónde salen los clientes.
        <EmptyState
          titulo="Todavía no tienes clientes"
          detalle="Un lead entra aquí cuando marcas su venta como ganada en el CRM."
          accion={{ label: 'Abrir el CRM', href: '/crm' }}
        />
      ) : GRUPOS.map((g) => {
        // `filter` preserva el orden que trajo la página: acá NO se vuelve a ordenar.
        const del = activos.filter((c) => claveNivel(c.senal.nivel) === g.clave);
        if (!del.length) return null;
        return (
          <section key={g.clave} className="cl-grupo">
            <header>
              <h2>{g.titulo}</h2>
              <span className="n">{del.length}</span>
            </header>
            {/* La grilla va SUELTA, sin caja de sección: la caja la tiene la card del
                cliente, y una card adentro de otra card está siempre mal. */}
            <ul className="cl-grid">
              {del.map((c) => (
                <li key={c.leadId}>
                  <Card c={c} trabajo={resumenDe(c.leadId)} tableroOk={tablero.ok}
                    onAbrir={() => setAbierto(c)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {cerrados.length > 0 && (
        <section className="cl-cerrados">
          <button onClick={() => setVerCerrados((v) => !v)}>
            {verCerrados ? 'Ocultar' : 'Ver'} los {cerrados.length} que ya cerraron
          </button>
          {/* Una lista con filete, no una pila de cajas: acá cada uno es un nombre y
              un estado, y N cajas iguales de eso son el contenedor perezoso. */}
          {verCerrados && (
            <ul>
              {cerrados.map((c) => (
                <li key={c.leadId}>
                  <button onClick={() => setAbierto(c)}>
                    <span className="n">{c.nombre}</span>
                    {c.empresa && <span className="e">{c.empresa}</span>}
                    <span className="s">
                      <Status tono={c.estado === 'graduado' ? 'good' : 'neutral'}>
                        {c.estado === 'graduado' ? 'Terminado' : 'Baja'}
                      </Status>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {abierto && (
        <DetalleCliente
          cliente={abierto}
          trabajo={resumenDe(abierto.leadId)}
          tableroOk={tablero.ok}
          guardando={guardando}
          onCerrar={() => setAbierto(null)}
          onMarcar={(e) => void marcar(abierto, e)}
        />
      )}

      <Toast state={toast} onClose={clear} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Pagina>
  );
}

/**
 * La card de un cliente.
 *
 * El molde es `ProyectoCardTile` (app/plan/board/BoardShell.tsx): superficie +
 * borde de 1 px + una BANDA de 3 px arriba con el color de la entidad + radio 14
 * + el pie anclado con un espaciador `flex:1`. El color no pinta el fondo ni el
 * texto, y el hover sube el borde a `--border-strong` sin comerse la banda.
 *
 * ⚠️ LA CARD SE GANA porque muestra cinco cosas de tipos distintos —señal,
 * nombre, empresa, reloj y trabajo— que sólo conviven acá. El día que quedara en
 * nombre + empresa + un chip, el propio molde estaría diciendo que ahí va una
 * lista con filete.
 *
 * ⚠️ ES UN `<button>`, así que lleva `text-align`, `font` y `color` escritos: un
 * botón NO los hereda y sin eso la card sale centrada (AGENTS.md, «cambiar la
 * ETIQUETA de un elemento arrastra su hoja por defecto»). Y no lleva ningún
 * control en el pie a propósito: un `<button>` adentro de otro es HTML inválido.
 */
function Card({ c, trabajo, tableroOk, onAbrir }: {
  c: ClienteCartera; trabajo: ResumenTrabajo | null; tableroOk: boolean; onAbrir: () => void;
}) {
  const nivel = claveNivel(c.senal.nivel);
  const r = c.reloj;
  const pct = r.semana && r.semanasTotales
    ? Math.min(100, Math.round((r.semana / r.semanasTotales) * 100))
    : null;

  return (
    <button className="cl-card" onClick={onAbrir} style={{ borderTopColor: COLOR_BANDA[nivel] }}>
      <span className="cl-senal"><Status tono={TONO_SENAL[nivel]}>{c.senal.motivo}</Status></span>

      <span className="cl-n">{c.nombre}</span>
      {c.empresa && <span className="cl-e">{c.empresa}</span>}

      <span className="cl-sp" />

      <span className="cl-reloj">{relojTexto(r)}</span>
      {pct !== null && (
        // El tiempo transcurrido del contrato. Se recorta al 100%: un contrato
        // vencido pasaría del carril y desbordaría la card.
        <span className="cl-bar" aria-hidden><span style={{ width: `${pct}%` }} /></span>
      )}

      <span className="cl-pie">{trabajoTexto(trabajo, tableroOk)}</span>
    </button>
  );
}

const CSS = `
.cl-grupo{ margin:0 0 28px; }
.cl-grupo > header{ display:flex; align-items:baseline; gap:10px; margin:0 0 12px;
  padding-bottom:8px; border-bottom:1px solid var(--border); }
.cl-grupo h2{ margin:0; font-size:15px; font-weight:640; letter-spacing:-.01em; color:var(--ink); }
.cl-grupo .n{ font-family:${MONO}; font-size:11px; font-variant-numeric:tabular-nums;
  color:var(--dim); background:var(--surface-2); border-radius:999px; padding:1px 8px; }

/* auto-fill, no auto-fit: con dos clientes, auto-fit estira cada card a media
   pantalla y una card de 700 px de ancho no se lee como una card. */
.cl-grid{ list-style:none; margin:0; padding:0; display:grid; gap:14px;
  grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); }
.cl-grid > li{ display:flex; }

.cl-card{ display:flex; flex-direction:column; gap:6px; width:100%;
  background:var(--surface); border:1px solid var(--border); border-top-width:3px;
  border-top-style:solid; border-radius:14px; padding:14px 16px 13px;
  min-height:190px; cursor:pointer; text-align:left; font:inherit; color:inherit;
  transition:border-color .12s; }
.cl-card:hover{ border-color:var(--border-strong); }
.cl-card:focus-visible{ outline:none; box-shadow:var(--focus-ring); }
.cl-senal{ display:block; margin:0 0 4px; }
.cl-n{ display:block; font-size:var(--fs-card); font-weight:600; line-height:1.3;
  color:var(--ink); overflow-wrap:anywhere; }
.cl-e{ display:block; font-size:var(--fs-meta); color:var(--faint); line-height:1.35;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cl-sp{ flex:1; min-height:10px; }
.cl-reloj{ display:block; font-size:var(--fs-sm); color:var(--dim);
  font-variant-numeric:tabular-nums; }
.cl-bar{ display:block; height:4px; border-radius:99px; background:var(--border);
  overflow:hidden; }
.cl-bar > span{ display:block; height:100%; background:var(--ink); }
.cl-pie{ display:block; margin-top:2px; font-family:${MONO}; font-size:10.5px;
  color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.cl-cerrados{ margin:4px 0 28px; }
.cl-cerrados > button{ background:none; border:0; padding:8px 0; font:inherit;
  font-size:13px; color:var(--dim); cursor:pointer; }
.cl-cerrados > button:hover{ color:var(--ink); }
.cl-cerrados ul{ list-style:none; margin:6px 0 0; padding:0; }
.cl-cerrados li > button{ display:flex; align-items:center; gap:12px; width:100%;
  background:none; border:0; border-top:1px solid var(--border); padding:11px 2px;
  text-align:left; font:inherit; color:inherit; cursor:pointer; }
.cl-cerrados li:first-child > button{ border-top:0; }
.cl-cerrados li > button:hover{ background:var(--surface-2); }
.cl-cerrados .n{ font-size:14px; color:var(--ink); }
.cl-cerrados .e{ font-size:12.5px; color:var(--faint); }
.cl-cerrados .s{ margin-left:auto; }

@media(prefers-reduced-motion:reduce){ .cl-card{ transition:none; } }
`;
