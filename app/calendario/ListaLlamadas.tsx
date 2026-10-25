'use client';

// =============================================================================
// ListaLlamadas — «Llamadas» del Calendario: las citas de venta como una lista de trabajo (24/10/2026)
// =============================================================================
// La llamada con Leandro (24/10, f07): «se ve muy como calendario de Google», y que muestre lo que ya existe en MaKo: las
// llamadas de ventas y las tareas del Plan con deadline. COPIADA DEL «Appointment List View» de HighLevel (su ayuda, mirada
// el 24/10): las pestañas Próximas · Pasadas · Canceladas con su número, una tabla con el contacto, la reunión, cuándo, quién
// la toma y el ESTADO como una pastilla (Agendada, Asistió, No vino, Sin marcar, Cancelada), y cada fila lleva a la ficha.
// A la derecha, las tareas del Plan con fecha, que en HighLevel no existen y en MaKo sí.
//
// El estado y las pestañas salen de lib/calendario-llamadas.ts (puro, con test); los datos, de `leerLlamadasDeVenta` y
// `leerTareasConFecha` (lib/calendario.ts), lo mismo que dibujan las capas «Llamadas» y «Plan» de la grilla. Marcar la
// asistencia se hace en la ficha del lead (cambia la etapa y lo que se le manda a Meta) o pidiéndoselo a MaKo.
// =============================================================================

import { useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import { diaDe, fechaLarga, horaDe, horaGoogle, sumarDias, type ItemCalendario } from '@/lib/calendario-modelo';
import {
  PESTANAS_LLAMADAS, TEXTO_ESTADO_LLAMADA, cuentaPorPestana, estadoDeLlamada, llamadasDeLaPestana,
  type EstadoLlamada, type LlamadaDeVenta, type PestanaLlamadas,
} from '@/lib/calendario-llamadas';
import { CSS_GC } from './gc-css';
import { PestanasCalendario } from './Pestanas';

const CSS_LISTA = `
.gl-cuerpo{display:flex;flex:1;min-height:0;gap:16px;padding:0 16px 0 8px}
.gl-hoja{flex:1;min-width:0;background:var(--gc-hoja);border-radius:24px 24px 0 0;display:flex;flex-direction:column;overflow:hidden}
.gl-cabeza{padding:20px 24px 0}
.gl-cabeza h2{margin:0 0 4px;font-size:22px;font-weight:600;color:var(--gc-tinta)}
.gl-cabeza p{margin:0 0 14px;color:var(--gc-gris);font-size:14px}
.gl-tabs{display:flex;gap:4px;border-bottom:1px solid var(--gc-borde)}
.gl-tab{border:0;background:transparent;font:inherit;font-size:14px;font-weight:500;color:var(--gc-gris);padding:10px 14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.gl-tab[aria-selected="true"]{color:var(--gc-azul);border-bottom-color:var(--gc-azul)}
.gl-tab b{display:inline-block;min-width:20px;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:12px;background:color-mix(in srgb,var(--gc-tinta) 8%,transparent);color:inherit}
.gl-scroll{flex:1;overflow:auto;padding:0 8px 24px}
.gl-tabla{width:100%;border-collapse:collapse;font-size:14px}
.gl-tabla th{position:sticky;top:0;background:var(--gc-hoja);text-align:left;font-size:12px;font-weight:600;color:var(--gc-gris);padding:12px 16px;border-bottom:1px solid var(--gc-borde)}
.gl-tabla td{padding:12px 16px;border-bottom:1px solid var(--gc-borde);color:var(--gc-tinta);vertical-align:middle}
.gl-tabla tr:hover td{background:color-mix(in srgb,var(--gc-azul) 5%,transparent)}
.gl-lead{display:flex;align-items:center;gap:10px;color:var(--gc-tinta);text-decoration:none;font-weight:600}
.gl-lead:hover{color:var(--gc-azul)}
.gl-ini{width:30px;height:30px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:13px;font-weight:700;color:#fff;background:#039be5}
.gl-reunion{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:6px;background:color-mix(in srgb,var(--gc-tinta) 7%,transparent);color:var(--gc-gris)}
.gl-cuando b{display:block;font-weight:600}
.gl-cuando span{color:var(--gc-gris);font-size:13px}
.gl-estado{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;padding:4px 10px;border-radius:999px}
.gl-estado::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.gl-estado.agendada{color:#1a73e8;background:#e8f0fe}
.gl-estado.asistio{color:#137333;background:#e6f4ea}
.gl-estado.no-vino{color:#c5221f;background:#fce8e6}
.gl-estado.sin-marcar{color:#9a6700;background:#fef7e0}
.gl-estado.cancelada{color:#5f6368;background:#f1f3f4}
.gl-abrir{color:var(--gc-azul);font-weight:600;text-decoration:none;white-space:nowrap}
.gl-oculto{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.gl-vacio{padding:48px 24px;text-align:center;color:var(--gc-gris)}
.gl-vacio b{display:block;color:var(--gc-tinta);font-size:16px;margin-bottom:6px}
.gl-error{margin:12px 24px 0;padding:10px 14px;border-radius:10px;background:#fef7e0;color:#5c4a12;font-size:14px}
.gl-tareas{width:300px;flex:none;background:var(--gc-hoja);border-radius:24px 24px 0 0;display:flex;flex-direction:column;overflow:hidden}
.gl-tareas h3{margin:0;padding:22px 20px 4px;font-size:16px;font-weight:600;color:var(--gc-tinta)}
.gl-tareas p.gl-sub{margin:0;padding:0 20px 12px;color:var(--gc-gris);font-size:13px;border-bottom:1px solid var(--gc-borde)}
.gl-tareas ul{list-style:none;margin:0;padding:6px 8px 88px;overflow:auto;flex:1}
.gl-tarea a{display:block;padding:10px 12px;border-radius:12px;text-decoration:none;color:var(--gc-tinta)}
.gl-tarea a:hover{background:color-mix(in srgb,var(--gc-tinta) 5%,transparent)}
.gl-tarea b{display:block;font-size:14px;font-weight:600}
.gl-tarea span{font-size:12.5px;color:var(--gc-gris)}
.gl-tarea .gl-vence{color:#c5221f;font-weight:600}
@media (max-width:1100px){.gl-tareas{display:none}}
@media (max-width:700px){.gl-col-closer,.gl-col-abrir{display:none}.gl-tabla td,.gl-tabla th{padding:10px 8px}}
`;

/** «Hoy», «Mañana» o la fecha larga: lo primero que se lee en una agenda de ventas. */
function rotuloDia(dia: string, hoy: string): string {
  if (dia === hoy) return 'Hoy';
  if (dia === sumarDias(hoy, 1)) return 'Mañana';
  if (dia === sumarDias(hoy, -1)) return 'Ayer';
  const f = fechaLarga(dia);
  return f.charAt(0).toUpperCase() + f.slice(1);
}

export function ListaLlamadas({ llamadas, tareas, hoy, tz, ahora, fallos }: {
  llamadas: readonly LlamadaDeVenta[];
  tareas: readonly ItemCalendario[];
  hoy: string;
  tz: string;
  /** El instante del server: qué ya pasó lo decide el mismo reloj en el server y en el navegador. */
  ahora: string;
  fallos: { llamadas?: boolean; tareas?: boolean };
}) {
  const [pestana, setPestana] = useState<PestanaLlamadas>('proximas');
  const cuentas = useMemo(() => cuentaPorPestana(llamadas, ahora), [llamadas, ahora]);
  const filas = useMemo(() => llamadasDeLaPestana(llamadas, pestana, ahora), [llamadas, pestana, ahora]);
  const proximasTareas = useMemo(() => [...tareas].sort((a, b) => a.inicio.localeCompare(b.inicio)), [tareas]);
  return (
    <div className="gc" data-calendario="" style={{ paddingLeft: 'var(--ancho-panel-mako, 0px)' }}>
      <style>{CSS_GC + CSS_LISTA}</style>
      <MakoEnLaTab tab="Calendario" />
      <header className="gc-barra">
        <span className="gc-logo">
          <span className="gc-logo-dia" aria-hidden>{Number(hoy.slice(8))}</span>
          <span className="gc-logo-txt">Calendario</span>
        </span>
        <h1 className="gc-titulo" id="gl-titulo">Llamadas de venta</h1>
        <div className="gc-derecha"><PestanasCalendario activa="llamadas" /></div>
      </header>
      <div className="gl-cuerpo">
        <main className="gl-hoja" aria-labelledby="gl-titulo">
          <div className="gl-cabeza">
            <p>Las reuniones de tus leads del CRM. Toca una para abrir su ficha y marcar si asistió.</p>
            <div className="gl-tabs" role="tablist" aria-label="Qué llamadas">
              {PESTANAS_LLAMADAS.map((p) => (
                <button key={p.id} type="button" role="tab" className="gl-tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}>
                  {p.nombre}<b>{cuentas[p.id]}</b>
                </button>
              ))}
            </div>
          </div>
          {fallos.llamadas && <p className="gl-error" role="alert">No pudimos leer las llamadas del CRM. Prueba otra vez en un minuto.</p>}
          <div className="gl-scroll">
            {filas.length === 0
              ? <Vacio pestana={pestana} />
              : (
                <table className="gl-tabla">
                  <thead>
                    <tr><th>Lead</th><th>Reunión</th><th>Cuándo</th><th className="gl-col-closer">Closer</th><th>Estado</th><th className="gl-col-abrir"><span className="gl-oculto">Abrir</span></th></tr>
                  </thead>
                  <tbody>
                    {filas.map((l) => {
                      const dia = diaDe(l.inicio, tz);
                      const estado: EstadoLlamada = estadoDeLlamada(l, ahora);
                      return (
                        <tr key={l.id}>
                          <td><Link className="gl-lead" href={`/crm/${l.leadId}`}><span className="gl-ini" aria-hidden>{l.nombre.trim().charAt(0).toUpperCase() || '·'}</span>{l.nombre}</Link></td>
                          <td><span className="gl-reunion">{l.cual}</span></td>
                          <td className="gl-cuando"><b>{rotuloDia(dia, hoy)}</b><span>{l.diaCompleto ? 'Sin hora' : horaGoogle(horaDe(l.inicio, tz))}</span></td>
                          <td className="gl-col-closer">{l.closer ?? '—'}</td>
                          <td><span className={`gl-estado ${estado}`}>{TEXTO_ESTADO_LLAMADA[estado]}</span></td>
                          <td className="gl-col-abrir"><Link className="gl-abrir" href={`/crm/${l.leadId}`}>Abrir ficha →</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
        </main>
        <aside className="gl-tareas" aria-labelledby="gl-tareas-titulo">
          <h3 id="gl-tareas-titulo">Tareas con fecha</h3>
          <p className="gl-sub">Del Plan, las que vencen pronto.</p>
          {fallos.tareas && <p className="gl-error" role="alert">No pudimos leer el Plan.</p>}
          {proximasTareas.length === 0
            ? <div className="gl-vacio"><b>Nada por vencer</b>Las tareas del Plan con fecha aparecen aquí.</div>
            : (
              <ul>
                {proximasTareas.map((t) => {
                  const dia = diaDe(t.inicio, tz);
                  return (
                    <li key={t.id} className="gl-tarea">
                      <Link href={t.href ?? '/plan'}>
                        <b>{t.titulo}</b>
                        <span className={dia < hoy ? 'gl-vence' : undefined}>{dia < hoy ? `Venció: ${rotuloDia(dia, hoy).toLowerCase()}` : rotuloDia(dia, hoy)}{t.detalle ? ` · ${t.detalle}` : ''}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
        </aside>
      </div>
    </div>
  );
}

function Vacio({ pestana }: { pestana: PestanaLlamadas }) {
  const texto = pestana === 'proximas'
    ? { t: 'No tienes llamadas agendadas', d: 'Cuando un lead agende su R1 o su R2, aparece aquí. También puedes pedirle a MaKo que la agende.' }
    : pestana === 'pasadas'
      ? { t: 'Todavía no hay llamadas pasadas', d: 'Las de los últimos dos meses aparecen aquí, con si asistieron.' }
      : { t: 'Ninguna cancelada', d: 'Las reuniones canceladas aparecen aquí.' };
  return <div className="gl-vacio"><b>{texto.t}</b>{texto.d}</div>;
}
