'use client';

// =============================================================================
// FichaEntrega — el producto y la etapa del cliente, en la cabecera de su ficha
// =============================================================================
// Pedido de Martín (06/10/2026): «Elimina la sección de "Entrega" y para eso, tal como está
// en el CRM, un desplegable con la etapa actual y que se pueda cambiar a otra etapa. Como
// también debería aparecer el desplegable de productos, por si quiero poner a ese cliente
// en otro producto».
//
// ⚠️ EL DESPLEGABLE DE PRODUCTO ELIGE QUÉ ENTREGA SE MIRA, NO MUEVE AL CLIENTE. A diferencia
// del CRM —donde un lead vive en UN embudo y elegir otro lo MUEVE—, acá un cliente puede
// estar en varios productos a la vez («un cliente puede estar en varios productos, lo mismo
// que el CRM»), así que mover sería sacarlo de uno que nadie pidió tocar. Elegir un producto
// en el que no está ofrece «Agregar a…», que le crea su fila en la primera etapa. Es el
// mismo molde que el CRM usa para «si ese lead NO está en el producto que seleccioné, que me
// de la opción de cargarlo».
//
// ⚠️ MUEVE POR EL MISMO CAMINO QUE EL KANBAN (`onMover` = `moverEntrega` de ClientesApp), con
// su deshacer y su reloj. Y lee la asignación CON LO MOVIDO ENCIMA (`asignacionDe`): con otra
// fuente, la ficha diría una etapa y la tarjeta de atrás otra.
//
// ⚠️ EL MENÚ DE ETAPAS ES EL MISMO QUE EL CHIP DE LA TABLA Y «Mover a…» (`opcionesDeEtapas`):
// tres menús para la misma pregunta se terminan agrupando distinto.

import { useState } from 'react';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import type { Servicio } from './entrega';
import type { Asignacion } from './KanbanEntrega';
import { opcionesDeEtapas } from './LoteClientes';
import { esDelProducto } from './pertenencia';

export type EntregaFicha = {
  servicios: Servicio[];
  asignacionDe: (productoId: number) => Record<number, Asignacion>;
  casa: Readonly<Record<number, number | null>>;
  /** El producto que se está mirando en el tablero de atrás: si es suyo, abre en ése. */
  inicial: number | null;
  onMover: (etapa: string, productoId: number) => void;
  /** «Quitar de este producto». Se ofrece sólo con dos o más (ver abajo). */
  onQuitar: (productoId: number) => void;
};

export function FichaEntrega({ leadId, nombre, e }: { leadId: number; nombre: string; e: EntregaFicha }) {
  const suyos = e.servicios.filter((s) => esDelProducto(leadId, s.productoId, e.casa, e.asignacionDe(s.productoId)));
  const [elegido, setElegido] = useState<number | null>(() => {
    if (e.inicial != null && suyos.some((s) => s.productoId === e.inicial)) return e.inicial;
    return suyos[0]?.productoId ?? e.servicios[0]?.productoId ?? null;
  });
  const s = e.servicios.find((x) => x.productoId === elegido) ?? null;
  if (!s) return null;

  const asig = e.asignacionDe(s.productoId);
  const esSuyo = esDelProducto(leadId, s.productoId, e.casa, asig);
  // Sin fila está en la PRIMERA etapa: la misma regla derivada que dibuja el kanban.
  const etapa = asig[leadId]?.etapa ?? s.etapas[0]?.key ?? '';
  const menu = opcionesDeEtapas(s.etapas, s.fases);

  // ⚠️ LOS PRODUCTOS EN LOS QUE NO ESTÁ SE OFRECEN IGUAL, con su aclaración en gris: el
  // pedido es justamente poder ponerlo en otro. Sin el `sub`, elegir uno y ver «Agregar a…»
  // en vez de su etapa se leería como que se perdió.
  //
  // ⚠️ «QUITAR DE ESTE PRODUCTO» VIVE EN EL RENGLÓN DE CADA PRODUCTO SUYO, y sólo con DOS o
  // más: «agregá "Quitar de este producto", pero solo para los leads que estén en más de 1
  // producto» (Martín, 06/10/2026). Con uno solo, quitarlo lo dejaría en ningún tablero. Es el
  // patrón del primitive para mantener una lista desde el desplegable (`acciones` del renglón),
  // y el server vuelve a contar antes de escribir.
  const varios = suyos.length > 1;
  const productos: DropdownOption[] = e.servicios.map((x) => {
    const suyo = suyos.some((y) => y.productoId === x.productoId);
    return {
      value: String(x.productoId),
      label: x.nombre,
      sub: suyo ? undefined : 'No está',
      acciones: suyo && varios
        ? [{ icono: <IconoQuitar />, title: 'Quitar de este producto', tone: 'bad' as const, cierra: true, onClick: () => e.onQuitar(x.productoId) }]
        : undefined,
    };
  });

  return (
    <span className="fe">
      {/* Con un solo producto no hay nada que elegir: un desplegable de una opción promete
          una decisión que no existe (la misma regla que el del CRM). */}
      {e.servicios.length > 1 && (
        <Dropdown value={String(s.productoId)} options={productos} onChange={(v) => setElegido(Number(v))}
          align="right" alContenido ariaLabel={`Producto: ${s.nombre}`}
          buttonStyle={{ fontSize: 13, fontWeight: 600 }} />
      )}
      {!s.etapas.length ? null : esSuyo ? (
        <Dropdown value={etapa} options={menu.options} alContenido
          placeholder="Etapa borrada" align="right" ariaLabel={`Etapa de ${nombre} en ${s.nombre}`}
          onChange={(v) => { if (v && v !== etapa) e.onMover(v, s.productoId); }}
          buttonStyle={{ fontSize: 13, fontWeight: 600 }} />
      ) : (
        <button type="button" className="fe-agregar" onClick={() => e.onMover(s.etapas[0].key, s.productoId)}>
          ＋ Agregar a {s.nombre}
        </button>
      )}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </span>
  );
}

/** Una cruz chica, del molde de los íconos de la barra de lote (viewBox 16, trazo 1.5). */
function IconoQuitar() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

const CSS = `
.fe{ display:inline-flex; align-items:center; gap:8px; flex:none; flex-wrap:wrap; justify-content:flex-end; }
.fe-agregar{ border:1px dashed var(--border-strong); background:none; border-radius:9px; padding:7px 12px;
  font:inherit; font-size:13px; font-weight:600; color:var(--dim); cursor:pointer; white-space:nowrap; }
.fe-agregar:hover{ color:var(--primary); border-color:var(--primary); }
`;
