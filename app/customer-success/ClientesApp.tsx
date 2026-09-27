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

import { useState, useTransition } from 'react';
import { Pagina, PageHeader, Banner, EmptyState, ErrorState, Status } from '@/app/_ui';

import type { ClienteCruce } from './cruce';
import type { ResumenTrabajo, TableroCartera } from './trabajo';
import { ClienteCard, CSS_CLIENTE } from './ClienteCard';
import { FichaCliente } from './FichaCliente';
import type { TrabajoDeCliente } from './trabajo';
import type { BoardUser } from '@/app/plan/board/types';
import { NuevoCliente } from './NuevoCliente';
import { guardarImagenClienteAction, autoasignarAction } from './actions';

/** Lo que se le cambió a un cliente sin recargar la página. */
type Imagen = { avatarUrl?: string | null; portada?: string | null; portadaY?: number | null; avatarY?: number | null; icono?: string | null };

export function ClientesApp({ clientes, tablero, trabajo, user, error }: {
  /** Los leads GANADOS del workspace, en orden de `id` — o sea, de antigüedad como
   *  cliente. Ese orden es el que numera («Cliente 1»); la grilla se ordena aparte. */
  clientes: ClienteCruce[];
  tablero: TableroCartera;
  /** El trabajo de TODOS, leído en el server. Es lo que hace que abrir una ficha no
   *  tenga estado de carga. `null` = no se pudo leer; la grilla se dibuja igual. */
  trabajo: { dueno: boolean; porCliente: Record<number, TrabajoDeCliente> } | null;
  user: BoardUser;
  /** La lista no se pudo leer. NO es «no tenés clientes»: son dos pantallas. */
  error?: string;
}) {
  const [creando, setCreando] = useState(false);
  const [abiertoId, setAbiertoId] = useState<number | null>(null);
  /**
   * LO QUE SE CAMBIÓ ACÁ ADENTRO, encima de lo que trajo el server.
   *
   * ⚠️ NO ES UN CACHÉ NI UN DUPLICADO DEL DATO: es el resultado que ya devolvió el
   * server action, aplicado sin esperar a que `revalidatePath` vuelva con las 78 KB del
   * trabajo de toda la cartera. Cambiar una portada y quedarse mirando la vieja durante
   * medio segundo se lee como que el botón no hizo nada.
   */
  const [imgs, setImgs] = useState<Record<number, Imagen>>({});
  const [mal, setMal] = useState('');
  const [mako, setMako] = useState<string | null>(null);
  const [pensando, empezar] = useTransition();

  const resumenDe = (leadId: number): ResumenTrabajo | null =>
    (tablero.ok ? tablero.porLead[leadId] : null) ?? null;

  /** El cliente con lo que se le haya cambiado en esta sesión encima. */
  const conImagen = (c: ClienteCruce): ClienteCruce => ({ ...c, ...(imgs[c.leadId] ?? {}) });

  /**
   * El NÚMERO de cliente, y sale del orden de ALTA, no del de la pantalla.
   *
   * ⚠️ NO ES EL ID DEL LEAD, a pedido: «el ID ya no sería de lead, sino de cliente, sería
   * el cliente 1» (26/09/2026). Y no es la posición en la grilla: esa se ordena por
   * nombre, así que ganar un cliente nuevo le cambiaría el número a media cartera.
   * `clientes` llega ordenado por `id`, que es el orden en que se ganaron.
   */
  const numeroDe = new Map(clientes.map((c, i) => [c.leadId, i + 1]));

  const lista = [...clientes].map(conImagen).sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'));
  const abierto = abiertoId === null ? null : lista.find((c) => c.leadId === abiertoId) ?? null;

  /** Guarda la foto o la portada. Lo que se pinta es lo que el server dijo que quedó
   *  guardado, no lo que se pidió: si el saneo descartó la URL, se tiene que ver. */
  function guardarImagen(leadId: number, cambio: Imagen) {
    setMal('');
    empezar(async () => {
      const r = await guardarImagenClienteAction(leadId, cambio);
      if (!r.ok) { setMal(r.error); return; }
      // ⚠️ SE FIJA LO QUE QUEDÓ EN LA BASE, LOS CINCO CAMPOS. Copiar sólo los dos que
      // el gesto tocó deja los otros tres en `undefined`, y `conImagen` los mergea
      // encima del cliente: la portada se encuadraría bien y el ícono desaparecería.
      setImgs((v) => ({ ...v, [leadId]: { avatarUrl: r.avatarUrl, portada: r.portada, portadaY: r.portadaY, avatarY: r.avatarY, icono: r.icono } }));
    });
  }

  /**
   * Que MaKo asigne lo evidente sobre TODA la cartera.
   *
   * ⚠️ VIVE EN LA CABECERA Y NO ADENTRO DE UNA FICHA, que es de donde salió: la corrida
   * mira el tablero entero y reparte entre todos los clientes, así que abrirla desde uno
   * prometía algo que no era. Y no se fue con el botón de «Asignarle trabajo» porque no
   * es lo mismo: aquél elegía a mano lo que ESTA pantalla ya resuelve desde el detalle de
   * cada tarjeta, y esto es lo único que decide solo.
   */
  function correrMako() {
    setMal(''); setMako(null);
    empezar(async () => {
      const r = await autoasignarAction();
      if (!r.ok) { setMal(r.error); return; }
      const n = r.porNombre + r.porIA;
      // ⚠️ «NO PUDE PREGUNTAR» TIENE SU PROPIO TEXTO. Si la cascada de IA no contestó,
      // decir «ninguna es suya» sería afirmar un juicio que nadie emitió — y ya pasó: la
      // primera corrida reportó «0 de 43» sobre una respuesta vacía.
      setMako(n > 0 ? `${n} asignadas`
        : r.sinRespuesta ? `No pude preguntar por ${r.sinRespuesta}`
          : r.consultadas ? `Ninguna de ${r.consultadas} es de nadie`
            : 'Nada evidente');
    });
  }

  return (
    <Pagina ancho="completo">
      <PageHeader
        titulo="Clientes"
        estado={lista.length > 0
          ? <Status>{lista.length} {lista.length === 1 ? 'cliente' : 'clientes'}</Status>
          : undefined}
        accion={
          <span className="cl-acciones">
            {mako && <span className="cl-mako">{mako}</span>}
            {lista.length > 0 && (
              <button type="button" className="cl-auto" disabled={pensando} onClick={correrMako}>
                {pensando ? 'Mirando el tablero…' : 'MaKo: asignar lo evidente'}
              </button>
            )}
            <button type="button" className="cl-nuevo" onClick={() => setCreando(true)}>+ Nuevo cliente</button>
          </span>
        }
      />

      {/* ⚠️ «Cero resultados» no es «no hay». Si el tablero no se pudo leer, las tarjetas
          dirían 0 en los tres números sobre clientes que sí tienen trabajo. */}
      {!error && !tablero.ok && <Banner tono="bad">No pude leer el tablero. {tablero.error}</Banner>}
      {mal && <Banner tono="bad">{mal}</Banner>}

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
                onAbrir={() => setAbiertoId(c.leadId)} />
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <FichaCliente
          key={abierto.leadId}
          c={abierto}
          n={numeroDe.get(abierto.leadId) ?? 0}
          trabajo={trabajo?.porCliente[abierto.leadId]
            // Un cliente sin trabajo asignado no tiene entrada en el mapa, y eso NO es un
            // error: es el caso normal del día 1. Se le arma su tablero vacío.
            ?? (trabajo ? (trabajo.dueno
              ? { dueno: true as const, tareas: [], proyectos: [] }
              : { dueno: false as const, tareas: [], categorias: [] }) : null)}
          user={user}
          clientes={clientes}
          onImagen={(cambio) => guardarImagen(abierto.leadId, cambio)}
          onCerrar={() => setAbiertoId(null)}
        />
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

.cl-acciones{ display:flex; align-items:center; gap:10px; }
.cl-mako{ font-size:12.5px; color:var(--dim); }
.cl-auto{ background:none; border:0; font:inherit; font-size:12.5px; color:var(--dim); cursor:pointer;
  padding:7px 4px; }
.cl-auto:hover:not(:disabled){ color:var(--primary); }
.cl-auto:disabled{ color:var(--faint); cursor:default; }

.cl-nuevo{ background:var(--surface); border:1px solid var(--border-strong); border-radius:9px;
  padding:7px 13px; font:inherit; font-size:13px; color:var(--ink); cursor:pointer; }
.cl-nuevo:hover{ border-color:var(--primary); color:var(--primary); }
`;
