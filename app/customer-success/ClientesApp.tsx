'use client';

// =============================================================================
// Clientes — quién es cliente, y qué trabajo tiene
// =============================================================================
// Una grilla de tarjetas y, al abrir una: sus proyectos, sus tareas y sus recurrentes.
// Eso es toda la pantalla.
//
// ⚠️ LO QUE NO ESTÁ, NO FALTA. Se fueron la señal de atención en tres niveles, el reloj
// del contrato, los cuatro números de cabecera y las cinco tabs: venían de calcar la tab
// que UN cliente tenía armada para su negocio. Antes de agregarle algo: si no es un
// cliente, un proyecto, una tarea o una recurrente, no va acá.

import { useState } from 'react';
import { Pagina, PageHeader, Banner, EmptyState, ErrorState, Modal, Status } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import type { ClienteCruce } from './cruce';
import type { ResumenTrabajo, TableroCartera } from './trabajo';
import { TrabajoDelCliente } from './TrabajoCliente';
import { ClienteCard, Avatar, CSS_CLIENTE } from './ClienteCard';
import { NuevoCliente } from './NuevoCliente';

export function ClientesApp({ clientes, tablero, error }: {
  /** Los leads GANADOS del workspace, en orden de `id` — o sea, de antigüedad como
   *  cliente. Ese orden es el que numera («Cliente 1»); la grilla se ordena aparte. */
  clientes: ClienteCruce[];
  tablero: TableroCartera;
  /** La lista no se pudo leer. NO es «no tenés clientes»: son dos pantallas. */
  error?: string;
}) {
  const [abierto, setAbierto] = useState<ClienteCruce | null>(null);
  const [creando, setCreando] = useState(false);

  const resumenDe = (leadId: number): ResumenTrabajo | null =>
    (tablero.ok ? tablero.porLead[leadId] : null) ?? null;

  /**
   * El NÚMERO de cliente, y sale del orden de ALTA, no del de la pantalla.
   *
   * ⚠️ NO ES EL ID DEL LEAD, a pedido: «el ID ya no sería de lead, sino de cliente, sería
   * el cliente 1» (26/09/2026). Y no es la posición en la grilla: esa se ordena por
   * nombre, así que ganar un cliente nuevo le cambiaría el número a media cartera.
   * `clientes` llega ordenado por `id`, que es el orden en que se ganaron.
   */
  const numeroDe = new Map(clientes.map((c, i) => [c.leadId, i + 1]));

  const lista = [...clientes].sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'));

  return (
    <Pagina ancho="completo">
      <PageHeader
        titulo="Clientes"
        estado={lista.length > 0
          ? <Status>{lista.length} {lista.length === 1 ? 'cliente' : 'clientes'}</Status>
          : undefined}
        accion={<button type="button" className="cl-nuevo" onClick={() => setCreando(true)}>+ Nuevo cliente</button>}
      />

      {/* ⚠️ «Cero resultados» no es «no hay». Si el tablero no se pudo leer, las tarjetas
          dirían 0 en los tres números sobre clientes que sí tienen trabajo. */}
      {!error && !tablero.ok && <Banner tono="bad">No pude leer el tablero. {tablero.error}</Banner>}

      {error ? (
        <ErrorState titulo="No pude leer tus clientes" detalle={error} detalleTecnico={error} />
      ) : lista.length === 0 ? (
        // EL VACÍO ES EL CASO PRINCIPAL: un workspace que recién empieza no ganó a nadie
        // todavía. Y ahora tiene DOS salidas, porque no todo cliente pasó por el CRM.
        <EmptyState
          titulo="Todavía no tienes clientes"
          detalle="Cárgalo aquí, o marca la venta de un lead como ganada en el CRM."
          accion={{ label: 'Cargar un cliente', onClick: () => setCreando(true) }}
        />
      ) : (
        <ul className="cl-grid">
          {lista.map((c) => (
            <li key={c.leadId}>
              <ClienteCard c={c} n={numeroDe.get(c.leadId) ?? 0}
                trabajo={resumenDe(c.leadId)} tableroOk={tablero.ok}
                onAbrir={() => setAbierto(c)} />
            </li>
          ))}
        </ul>
      )}

      {/* ⚠️ ESTE COMENTARIO VA ACÁ Y NO ADENTRO DEL `{abierto && (`. Justo después del `(`
          se está en posición de EXPRESIÓN, no de hijo de JSX, y ahí un comentario con
          llaves es un objeto literal vacío que rompe el parse. AGENTS.md ya lo tiene
          escrito y se cometió igual — y de paso, la corrección lo cometió otra vez de otra
          forma: un comentario de JSX tampoco puede CONTENER el cierre de un comentario de
          bloque, porque lo termina antes de tiempo.
          El `titulo` de `Modal` acepta un nodo, así que la cabecera entera entra ahí sin
          inventar una prop nueva; `etiqueta` es el nombre en texto plano para el lector de
          pantalla, que es para lo que esa prop existe. */}
      {abierto && (
        <Modal
          titulo={<CabeceraCliente c={abierto} n={numeroDe.get(abierto.leadId) ?? 0} />}
          etiqueta={nombreDe(abierto)}
          onCerrar={() => setAbierto(null)}
        >
          {/* `key` por cliente: sin eso, al saltar de un cliente a otro se ve un instante
              el trabajo del anterior. */}
          <TrabajoDelCliente key={abierto.leadId} leadId={abierto.leadId} nombre={nombreDe(abierto)} />
        </Modal>
      )}

      {creando && <NuevoCliente onCerrar={() => setCreando(false)} />}

      <style dangerouslySetInnerHTML={{ __html: CSS_CLIENTE + CSS }} />
    </Pagina>
  );
}

/** Un lead ganado puede tener el nombre vacío: la tarjeta necesita algo que decir. */
const nombreDe = (c: ClienteCruce): string => c.nombre.trim() || 'Sin nombre';

/**
 * La cabecera de la ficha, con el molde de la del CRM: avatar, nombre, bajada.
 *
 * ⚠️ DONDE EL CRM PONE EL DESPLEGABLE DE ETAPA, ACÁ VA EL LINK AL CRM, a pedido: «el
 * status no es necesario, que dice "ganado", donde está ese desplegable podríamos poner
 * un botón de "ver en el CRM"» (26/09/2026). Y tiene razón de sobra: acá TODOS están
 * ganados —es la definición de estar en esta pantalla—, así que ese chip no distingue
 * nada. Un dato que vale lo mismo para todas las filas no es un dato.
 */
function CabeceraCliente({ c, n }: { c: ClienteCruce; n: number }) {
  return (
    <div className="cl-cab">
      <Avatar nombre={nombreDe(c)} tam={46} />
      <div className="cl-cab-txt">
        <span className="nom">{nombreDe(c)}</span>
        {c.empresa?.trim() && <span className="emp">{c.empresa.trim()}</span>}
        <span className="id">Cliente {n}</span>
      </div>
      {/* Al detalle del lead, no a la lista: el CRM tiene 1.511 filas y «buscalo vos» no
          es un destino. */}
      <Link href={`/crm/${c.leadId}`} className="cl-cab-crm">Ver en el CRM →</Link>
    </div>
  );
}

const CSS = `
.cl-grid{ list-style:none; margin:0; padding:0; display:grid; gap:16px;
  grid-template-columns:repeat(auto-fill, minmax(258px, 1fr)); }
.cl-grid > li{ display:flex; }

.cl-nuevo{ background:var(--surface); border:1px solid var(--border-strong); border-radius:9px;
  padding:7px 13px; font:inherit; font-size:13px; color:var(--ink); cursor:pointer; }
.cl-nuevo:hover{ border-color:var(--primary); color:var(--primary); }

.cl-cab{ display:flex; align-items:center; gap:13px; }
.cl-cab-txt{ display:flex; flex-direction:column; gap:1px; min-width:0; flex:1; }
.cl-cab-txt .nom{ font-size:19px; font-weight:660; letter-spacing:-.02em; line-height:1.2;
  color:var(--ink); overflow-wrap:anywhere; }
.cl-cab-txt .emp{ font-size:13px; color:var(--dim); overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; }
.cl-cab-txt .id{ font-size:11px; color:var(--faint); }
.cl-cab-crm{ flex:none; font-size:12.5px; color:var(--dim); border:1px solid var(--border-strong);
  border-radius:8px; padding:6px 11px; text-decoration:none; white-space:nowrap; }
.cl-cab-crm:hover{ color:var(--primary); border-color:var(--primary); }
`;
