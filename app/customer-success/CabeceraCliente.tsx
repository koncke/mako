'use client';

// =============================================================================
// CabeceraCliente — el banner de un cliente, arriba de su tablero
// =============================================================================
// El molde es la tarjeta de la grilla: banda con su color, avatar montado, nombre y
// bajada. Que sean la MISMA cara es todo el punto — se hace click en una tarjeta y lo que
// se abre tiene que verse como esa tarjeta, agrandada.
//
// ⚠️ TRES COSAS QUE SE REPORTARON DEL INTENTO ANTERIOR, y las tres eran del modal:
//   · «se corta a la derecha y no llega al final» — el banner vivía adentro de
//     `.mk-modal__cab`, cuyo `<h2>` no se estira. Acá no hay modal: es un bloque de la
//     página y llega de borde a borde sin sangrar el padding de nadie.
//   · «está muy angosto, debería ser más estirado» — 74 px de alto sobre 1040 de ancho se
//     leía como una franja. Acá el ancho es el de la pantalla y la banda baja a 56.
//   · «"Ver en el CRM" debería estar alineado al botón de cerrar» — ya no hay botón de
//     cerrar (es una página, se vuelve con el link de la izquierda), así que la acción va
//     arriba a la derecha, que es donde se la busca.

import type { ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { Avatar, colorDe } from './ClienteCard';

export function CabeceraCliente({ nombre, empresa, n, leadId, volver, acciones }: {
  nombre: string;
  empresa: string | null;
  /** Su número de cliente, o `null` si no se pudo saber. NO es el id del lead. */
  n: number | null;
  leadId: number;
  volver?: ReactNode;
  acciones?: ReactNode;
}) {
  const color = colorDe(nombre);
  return (
    <header className="cl-pag">
      <div className="cl-pag-banda" aria-hidden style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 26%, var(--surface)), color-mix(in srgb, ${color} 6%, var(--surface)))`,
      }}>
        <div className="cl-pag-top">
          {volver}
          <span style={{ flex: 1 }} />
          {/* Al detalle del lead, no a la lista: el CRM tiene 1.511 filas y «buscalo vos»
              no es un destino. */}
          <Link href={`/crm/${leadId}`} className="cl-pag-crm">Ver en el CRM →</Link>
        </div>
      </div>

      <div className="cl-pag-fila">
        <Avatar nombre={nombre} tam={62} />
        <div className="cl-pag-txt">
          <h1>{nombre}</h1>
          <span className="sub">
            {empresa?.trim() || (n ? `Cliente ${n}` : 'Cliente')}
            {empresa?.trim() && n ? <span className="id"> · Cliente {n}</span> : null}
          </span>
        </div>
        {acciones}
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </header>
  );
}

const CSS = `
.cl-pag{ flex:none; border-bottom:1px solid var(--border); background:var(--surface); }
/* 84 y no 56: «está muy angosto, debería ser más estirado» (26/09/2026). Con 56 la
   banda no alcanzaba a contener el renglón de arriba y el avatar quedaba pegado al
   texto — se leía como un encabezado apretado, no como la tarjeta agrandada. */
.cl-pag-banda{ display:block; height:84px; width:100%; }
.cl-pag-top{ display:flex; align-items:center; gap:10px; padding:13px 22px 0; }
.cl-pag-volver{ font-size:13px; color:var(--ink); text-decoration:none; opacity:.75; }
.cl-pag-volver:hover{ opacity:1; text-decoration:underline; text-underline-offset:3px; }
.cl-pag-crm{ font-size:12.5px; color:var(--ink); background:var(--surface);
  border:1px solid var(--border-strong); border-radius:999px; padding:5px 13px;
  text-decoration:none; white-space:nowrap; }
.cl-pag-crm:hover{ color:var(--primary); border-color:var(--primary); }

/* El avatar montado sobre la banda, igual que en la tarjeta de la grilla. */
/* El avatar monta sobre la banda la MITAD de su alto (62/2 = 31), que es lo que hace que
   se lea como la tarjeta de la grilla agrandada y no como dos bloques apilados. */
.cl-pag-fila{ display:flex; align-items:flex-end; gap:15px; padding:0 22px 14px;
  margin-top:-31px; }
.cl-pag-txt{ display:flex; flex-direction:column; gap:1px; min-width:0; flex:1;
  padding-bottom:2px; }
.cl-pag-txt h1{ margin:0; font-size:21px; font-weight:670; letter-spacing:-.02em;
  line-height:1.2; color:var(--ink); overflow-wrap:anywhere; }
.cl-pag-txt .sub{ font-size:13px; color:var(--dim); overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.cl-pag-txt .id{ color:var(--faint); }
`;
