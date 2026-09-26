'use client';

// =============================================================================
// Clientes — quién es cliente, y qué trabajo tiene
// =============================================================================
// Una grilla de cards con el nombre y sus números, y al abrir una: sus
// proyectos, sus tareas y sus recurrentes, con el detalle de cada uno. Eso es
// toda la pantalla.
//
// ⚠️ LO QUE NO ESTÁ, NO FALTA (26/09/2026). Se fueron la señal de atención en
// tres niveles, el reloj del contrato con su barra, los cuatro números de
// cabecera, las cinco tabs de la ficha y los tres botones de estado. El pedido
// es «SOLO clientes que pueden tener proyectos y tareas y recurrentes, lo MÁS
// minimalista posible», y todo eso venía de calcar la tab que UN cliente tenía
// armada para su negocio. Antes de agregarle algo a esta pantalla: si no es un
// cliente, un proyecto, una tarea o una recurrente, no va acá.
//
// La ficha sigue siendo la del CRM: acá se ve la ENTREGA, y el link al final de
// la card de nadie — se entra al cliente y se sale al tablero, que es donde se
// edita.

import { useState } from 'react';
import { Pagina, PageHeader, Banner, EmptyState, ErrorState, Modal, Status, MONO } from '@/app/_ui';
import type { ClienteCruce } from './cruce';
import type { ResumenTrabajo, TableroCartera } from './trabajo';
import { TrabajoDelCliente } from './TrabajoCliente';

/**
 * El trabajo de un cliente, en una línea.
 *
 * ⚠️ Las RECURRENTES se dicen aparte y NO se suman a las abiertas: algo que se
 * repite para siempre no se puede terminar, así que contarlo como pendiente
 * miente en la dirección tranquilizadora.
 *
 * ⚠️ Y los tres estados son DISTINTOS: no pude leer el tablero / no cruzó con
 * ningún proyecto / cruzó y no tiene nada abierto. `como === null` es el
 * segundo, y sin esa rama se veía igual que el tercero — medido en el ws1: 11 de
 * 13 clientes no tienen proyecto propio y la card les decía «0 abiertas», o sea
 * que miramos y no había nada.
 */
export function trabajoTexto(t: ResumenTrabajo | null, tableroOk: boolean): string {
  if (!tableroOk) return 'No pude leer el tablero';
  if (!t || t.como === null) return 'Sin trabajo suyo en el tablero';
  const partes: string[] = [];
  if (t.proyectos) partes.push(`${t.proyectos} ${t.proyectos === 1 ? 'proyecto' : 'proyectos'}`);
  partes.push(`${t.abiertas} ${t.abiertas === 1 ? 'abierta' : 'abiertas'}`);
  if (t.recurrentes) partes.push(`${t.recurrentes} se ${t.recurrentes === 1 ? 'repite' : 'repiten'}`);
  return partes.join(' · ');
}

export function ClientesApp({ clientes, tablero, error }: {
  /** Los leads GANADOS del workspace. Nombre, empresa y nada más. */
  clientes: ClienteCruce[];
  /** Qué sabe el TABLERO de cada uno. Números nada más; el detalle lo pide la ficha. */
  tablero: TableroCartera;
  /** La lista no se pudo leer. NO es «no tenés clientes»: son dos pantallas. */
  error?: string;
}) {
  const [abierto, setAbierto] = useState<ClienteCruce | null>(null);

  const resumenDe = (leadId: number): ResumenTrabajo | null =>
    (tablero.ok ? tablero.porLead[leadId] : null) ?? null;

  // Por nombre, y no por «quién tiene más trabajo»: un orden que se calcula es un
  // orden que hay que explicar, y acá la card ya dice cuánto tiene cada uno.
  const lista = [...clientes].sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'));

  return (
    <Pagina ancho="completo">
      <PageHeader
        titulo="Clientes"
        estado={lista.length > 0
          ? <Status>{lista.length} {lista.length === 1 ? 'cliente' : 'clientes'}</Status>
          : undefined}
      />

      {/* ⚠️ «Cero resultados» no es «no hay». Si el tablero no se pudo leer, las cards
          dirían «sin trabajo» sobre clientes que sí lo tienen cargado. */}
      {!error && !tablero.ok && <Banner tono="bad">No pude leer el tablero. {tablero.error}</Banner>}

      {error ? (
        <ErrorState titulo="No pude leer tus clientes" detalle={error} detalleTecnico={error} />
      ) : lista.length === 0 ? (
        // EL VACÍO ES EL CASO PRINCIPAL: un workspace que recién empieza no ganó a
        // nadie todavía, y ésta es la pantalla que más se va a ver. Dice en UNA
        // frase de dónde salen los clientes.
        <EmptyState
          titulo="Todavía no tienes clientes"
          detalle="Un lead entra aquí cuando marcas su venta como ganada en el CRM."
          accion={{ label: 'Abrir el CRM', href: '/crm' }}
        />
      ) : (
        <ul className="cl-grid">
          {lista.map((c) => (
            <li key={c.leadId}>
              <Card c={c} trabajo={resumenDe(c.leadId)} tableroOk={tablero.ok}
                onAbrir={() => setAbierto(c)} />
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <Modal titulo={nombreDe(abierto)} onCerrar={() => setAbierto(null)}>
          {/* `key` por cliente: sin eso, al saltar de un cliente a otro se ve un
              instante el trabajo del anterior. */}
          <TrabajoDelCliente key={abierto.leadId} leadId={abierto.leadId}
            nombre={nombreDe(abierto)} resumen={resumenDe(abierto.leadId)} />
        </Modal>
      )}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Pagina>
  );
}

/** Un lead ganado puede tener el nombre vacío: la card necesita algo que decir. */
const nombreDe = (c: ClienteCruce): string => c.nombre.trim() || 'Sin nombre';

/**
 * La card de un cliente: nombre, empresa y sus números.
 *
 * El molde es `ProyectoCardTile` (app/plan/board/BoardShell.tsx): superficie,
 * borde de 1 px, radio 14 y el pie anclado abajo con un espaciador `flex:1`.
 *
 * ⚠️ ES UN `<button>`, así que lleva `text-align`, `font` y `color` escritos: un
 * botón NO los hereda y sin eso la card sale centrada (AGENTS.md, «cambiar la
 * ETIQUETA de un elemento arrastra su hoja por defecto»).
 */
function Card({ c, trabajo, tableroOk, onAbrir }: {
  c: ClienteCruce; trabajo: ResumenTrabajo | null; tableroOk: boolean; onAbrir: () => void;
}) {
  return (
    <button className="cl-card" onClick={onAbrir}>
      <span className="cl-n">{nombreDe(c)}</span>
      {c.empresa && <span className="cl-e">{c.empresa}</span>}
      <span className="cl-sp" />
      <span className="cl-pie">{trabajoTexto(trabajo, tableroOk)}</span>
    </button>
  );
}

const CSS = `
/* auto-fill, no auto-fit: con dos clientes, auto-fit estira cada card a media
   pantalla y una card de 700 px de ancho no se lee como una card. */
.cl-grid{ list-style:none; margin:0; padding:0; display:grid; gap:14px;
  grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); }
.cl-grid > li{ display:flex; }

.cl-card{ display:flex; flex-direction:column; gap:4px; width:100%;
  background:var(--surface); border:1px solid var(--border); border-radius:14px;
  padding:15px 16px 13px; min-height:118px; cursor:pointer; text-align:left;
  font:inherit; color:inherit; transition:border-color .12s; }
.cl-card:hover{ border-color:var(--border-strong); }
.cl-card:focus-visible{ outline:none; box-shadow:var(--focus-ring); }
.cl-n{ display:block; font-size:var(--fs-card); font-weight:600; line-height:1.3;
  color:var(--ink); overflow-wrap:anywhere; }
.cl-e{ display:block; font-size:var(--fs-meta); color:var(--faint); line-height:1.35;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cl-sp{ flex:1; min-height:12px; }
.cl-pie{ display:block; font-family:${MONO}; font-size:10.5px; color:var(--faint);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

@media(prefers-reduced-motion:reduce){ .cl-card{ transition:none; } }
`;
