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
import { Pagina, PageHeader, Banner, EmptyState, ErrorState, Status } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import type { ClienteCruce } from './cruce';
import type { ResumenTrabajo, TableroCartera } from './trabajo';
import { ClienteCard, CSS_CLIENTE } from './ClienteCard';
import { NuevoCliente } from './NuevoCliente';

export function ClientesApp({ clientes, tablero, error }: {
  /** Los leads GANADOS del workspace, en orden de `id` — o sea, de antigüedad como
   *  cliente. Ese orden es el que numera («Cliente 1»); la grilla se ordena aparte. */
  clientes: ClienteCruce[];
  tablero: TableroCartera;
  /** La lista no se pudo leer. NO es «no tenés clientes»: son dos pantallas. */
  error?: string;
}) {
  const [creando, setCreando] = useState(false);
  const router = useRouter();

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
                onAbrir={() => router.push(`/customer-success/${c.leadId}`)} />
            </li>
          ))}
        </ul>
      )}

      {creando && <NuevoCliente onCerrar={() => setCreando(false)} />}

      <style dangerouslySetInnerHTML={{ __html: CSS_CLIENTE + CSS }} />
    </Pagina>
  );
}


/** Un lead ganado puede tener el nombre vacío: la tarjeta necesita algo que decir. */
const nombreDe = (c: ClienteCruce): string => c.nombre.trim() || 'Sin nombre';

const CSS = `
.cl-grid{ list-style:none; margin:0; padding:0; display:grid; gap:16px;
  grid-template-columns:repeat(auto-fill, minmax(258px, 1fr)); }
.cl-grid > li{ display:flex; }

.cl-nuevo{ background:var(--surface); border:1px solid var(--border-strong); border-radius:9px;
  padding:7px 13px; font:inherit; font-size:13px; color:var(--ink); cursor:pointer; }
.cl-nuevo:hover{ border-color:var(--primary); color:var(--primary); }


`;
