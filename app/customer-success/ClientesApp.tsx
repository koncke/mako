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
import { ClienteCard, Avatar, colorDe, CSS_CLIENTE } from './ClienteCard';
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
          ancho={ANCHO_FICHA}
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

/**
 * ⚠️ 1040 Y NO LOS 600 DE LA CASA: «debe ser más ancho que largo» (26/09/2026). La regla
 * del ancho de `Modal` es para TEXTO —la medida de lectura— y acá adentro va una grilla de
 * tarjetas, que es lo contrario: con 600 entran dos por fila y la ficha se vuelve una
 * columna larguísima que hay que scrollear.
 *
 * (Y la constante existe para no escribir el comentario entre los atributos del JSX: tsc
 * lo acepta ahí, pero ya se cometieron dos errores de comentario mal ubicado en esta
 * pantalla y ninguno se ve en el diff.)
 */
const ANCHO_FICHA = 1040;

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
  const nombre = nombreDe(c);
  const color = colorDe(nombre);
  return (
    <div className="cl-cab">
      {/* ⚠️ EL BANNER SANGRA hasta los bordes del modal con un margen negativo que vale
          EXACTAMENTE el padding de `.mk-modal__cab` (20px 24px 16px, app/_ui/ui.css). Si
          ese padding cambia, acá queda un marco blanco alrededor del degradado — es la
          misma trampa del margen negativo que ya se pagó en la cabecera pegajosa del
          detalle, y por eso el número va escrito con su porqué y no «a ojo». */}
      <span className="cl-cab-banda" aria-hidden style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 26%, var(--surface)), color-mix(in srgb, ${color} 7%, var(--surface)))`,
      }} />
      <div className="cl-cab-fila">
        <Avatar nombre={nombre} tam={56} />
        <div className="cl-cab-txt">
          <span className="nom">{nombre}</span>
          <span className="emp">{c.empresa?.trim() || `Cliente ${n}`}</span>
        </div>
        {/* Al detalle del lead, no a la lista: el CRM tiene 1.511 filas y «buscalo vos» no
            es un destino. */}
        <Link href={`/crm/${c.leadId}`} className="cl-cab-crm">Ver en el CRM →</Link>
      </div>
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

/* El bloque entero sangra el padding de .mk-modal__cab para que el banner llegue a los
   bordes, igual que en la tarjeta de la grilla.
   ⚠️ Y EL align-self NO ES DECORATIVO: .mk-modal__tit es un flex column con
   align-items: flex-start (app/_ui/ui.css), así que su h2 se encoge al ancho del
   contenido y el banner llegaba hasta la mitad del modal. Se estira el h2, no el bloque:
   el que manda es el hijo directo del flex.
   (Y sin comillas invertidas: esto vive adentro de un template literal y una sola CIERRA
   la cadena. AGENTS.md lo tiene escrito y es la tercera vez en esta sesión.) */
.mk-modal__h:has(.cl-cab){ align-self:stretch; }
.cl-cab{ display:block; flex:1; min-width:0; margin:-20px -24px -16px; }
.cl-cab-banda{ display:block; height:74px; width:100%; }
/* El avatar montado sobre el banner, como en la tarjeta: sube la mitad de su alto. */
.cl-cab-fila{ display:flex; align-items:flex-end; gap:14px; padding:0 24px 14px;
  margin-top:-28px; }
.cl-cab-fila .cl-av{ flex:none; }
.cl-cab-txt{ display:flex; flex-direction:column; gap:1px; min-width:0; flex:1;
  padding-bottom:2px; }
.cl-cab-txt .nom{ font-size:20px; font-weight:670; letter-spacing:-.02em; line-height:1.2;
  color:var(--ink); overflow-wrap:anywhere; }
.cl-cab-txt .emp{ font-size:13px; color:var(--dim); overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; }
.cl-cab-crm{ flex:none; margin-bottom:2px; font-size:12.5px; color:var(--dim);
  background:var(--surface); border:1px solid var(--border-strong); border-radius:999px;
  padding:6px 13px; text-decoration:none; white-space:nowrap; }
.cl-cab-crm:hover{ color:var(--primary); border-color:var(--primary); }
`;
