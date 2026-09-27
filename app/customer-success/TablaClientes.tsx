'use client';

// =============================================================================
// TablaClientes — la misma cartera, para barrerla de un vistazo
// =============================================================================
// La otra mitad del interruptor tarjetas/tabla que pidió el dueño para esta
// pantalla (27/09/2026), con el mismo criterio que la del tablero: la tarjeta es
// para RECONOCER —foto, portada, el nombre grande— y la tabla es para COMPARAR.
// Con doce clientes, «¿quién tiene más abierto?» en tarjetas es scrollear y
// acordarse; en una tabla es mirar una columna.
//
// ⚠️ NO REPITE LO QUE LA TARJETA YA DICE MEJOR. No lleva portada ni números
// grandes: lleva las mismas tres cuentas en columnas alineadas, que es lo único
// que cambia el modo de leerlas. Una tabla que dibuja las mismas cajas en fila es
// la tarjeta otra vez, más angosta.

import type { ClienteCruce } from './cruce';
import type { ResumenTrabajo } from './trabajo';
import { Marca } from '@/app/_components/Marca';
import { colorDe } from './ClienteCard';

export function TablaClientes({ filas, numeroDe, resumenDe, tableroOk, onAbrir, onNuevo }: {
  filas: ClienteCruce[];
  numeroDe: Map<number, number>;
  resumenDe: (leadId: number) => ResumenTrabajo | null;
  tableroOk: boolean;
  onAbrir: (leadId: number) => void;
  onNuevo: () => void;
}) {
  return (
    <>
      {/* ⚠️ EN TABLA, CREAR ES UN BOTÓN ARRIBA — como «+ Crear proyecto» en la tabla
          del tablero. «Falta el botón de nuevo cliente cuando está en la vista de
          tabla» (27/09/2026): lo había puesto como último RENGLÓN, y ahí no se ve.
          Una fila de acción al final de una lista se lee como un dato más, y con la
          tabla scrolleada ni siquiera está en pantalla. En tarjetas puede vivir
          DENTRO de la grilla porque una tarjeta punteada no se confunde con un dato;
          un renglón de tabla sí. La misma acción, dos formas, por la misma razón. */}
      <div className="tc-arriba">
        <button type="button" className="tc-nuevo" onClick={onNuevo}>＋ Nuevo cliente</button>
      </div>
      <div className="tc-caja">
      <table className="tc">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Empresa</th>
            <th className="num">Proyectos</th>
            <th className="num">Abiertas</th>
            <th className="num">Se repiten</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((c) => {
            const nombre = c.nombre.trim() || 'Sin nombre';
            const r = resumenDe(c.leadId);
            // ⚠️ SIN TABLERO, UN GUION Y NO UN CERO. Un 0 es una afirmación sobre su
            // trabajo; si la lectura falló, es una que nadie hizo. Es la misma regla
            // que ya cumple la tarjeta con `tableroOk`.
            const n = (v: number | undefined) => (tableroOk ? String(v ?? 0) : '—');
            return (
              <tr key={c.leadId} onClick={() => onAbrir(c.leadId)} tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(c.leadId); }}>
                <td>
                  <span className="tc-quien">
                    <Marca icono={c.icono ?? c.avatarUrl} nombre={nombre} tam={26}
                      y={c.avatarY} color={colorDe(nombre)} />
                    <span className="tc-nom">{nombre}</span>
                    <span className="tc-num">Cliente {numeroDe.get(c.leadId) ?? 0}</span>
                  </span>
                </td>
                <td className="tc-emp">{c.empresa?.trim() || <span className="tc-vacio">—</span>}</td>
                <td className="num">{n(r?.proyectos)}</td>
                <td className="num">{n(r?.abiertas)}</td>
                <td className="num">{n(r?.recurrentes)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </div>
    </>
  );
}

const CSS = `
/* El mismo ancho y el mismo centrado que la grilla y que la barra (ver alla). */
.tc-caja{ border:1px solid var(--border); border-radius:14px; overflow:hidden;
  background:var(--surface); max-width:1180px; margin:0 auto; }
.tc{ width:100%; border-collapse:collapse; font-size:13.5px; }
.tc th{ text-align:left; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--faint); font-weight:700; padding:11px 14px; border-bottom:1px solid var(--border);
  background:var(--surface-2); white-space:nowrap; }
.tc td{ padding:11px 14px; border-bottom:1px solid var(--border); color:var(--ink); vertical-align:middle; }
.tc tbody tr{ cursor:pointer; }
.tc tbody tr:hover td{ background:var(--surface-2); }
.tc tbody tr:last-child td{ border-bottom:0; }
.tc .num{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.tc-quien{ display:inline-flex; align-items:center; gap:9px; min-width:0; }
.tc-nom{ font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tc-num{ font-size:11.5px; color:var(--faint); white-space:nowrap; }
.tc-emp{ color:var(--dim); }
.tc-vacio{ color:var(--faint); }
/* El boton de crear, arriba y alineado con la caja de la tabla. */
.tc-arriba{ display:flex; justify-content:flex-end; max-width:1180px; margin:0 auto 12px; }
.tc-nuevo{ border:1px solid var(--border-strong); background:var(--surface); border-radius:9px;
  padding:8px 14px; font:inherit; font-size:13px; font-weight:600; color:var(--ink); cursor:pointer; }
.tc-nuevo:hover{ border-color:var(--primary); color:var(--primary); }
`;
