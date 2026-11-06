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
// `leerTareasConFecha` (lib/calendario.ts), lo mismo que dibujan las capas «Llamadas» y «Plan» de la grilla.
//
// LAS REUNIONES DEL EQUIPO (6/11/2026, la promesa a la agencia de Thiago): un closer o un setter entra SÓLO acá, arrancando en
// SUS llamadas (las que lleva como closer o como setter), y el admin filtra por persona. El desplegable «Persona» escribe
// `?persona=` en la URL (un F5 o un link vuelven a lo mismo). La regla es pura y tiene test (`llamadasDeLaPersona`,
// lib/calendario-llamadas.ts); a quién se le abre esto y con qué, `quienMiraElCalendario` (lib/calendario-equipo-server.ts).
// Un closer no ve las tareas del Plan: el Plan es del admin.
//
// MARCAR LA ASISTENCIA EN LA FILA (25/10/2026, como el «Status» de HighLevel): en una reunión que ya empezó el estado es un
// desplegable (Sin marcar · Asistió · No vino). Escribe por el MISMO camino que la ficha del lead (`guardarCampoLeadAction`
// con `asistio_j1`/`asistio_j2`): la etapa derivada, el historial y lo que se le manda a Meta salen de ahí. Si borra el
// calificado (la R1 que no fue), lo dice ANTES (`avisoAlMarcar`); después, «Deshacer» como en la ficha.
// =============================================================================

import { useMemo, useState } from 'react';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import Link, { useRouter } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { deshacerCampoLeadAction, guardarCampoLeadAction } from '@/app/crm/actions';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import { diaDe, horaDe, horaGoogle, type ItemCalendario } from '@/lib/calendario-modelo';
import {
  PESTANAS_LLAMADAS, PERSONA_SIN_ASIGNAR, PERSONA_TODAS, TEXTO_ESTADO_LLAMADA, avisoAlMarcar, rotuloDelDia as rotuloDia, campoDeAsistencia, cuentaPorPestana, estadoDeLlamada,
  llamadasDeLaPersona, llamadasDeLaPestana, sePuedeMarcar,
  type EstadoLlamada, type LlamadaDeVenta, type PestanaLlamadas,
} from '@/lib/calendario-llamadas';
// La inicial de la fila, de la pieza de la casa: `charAt(0)` de «🚀 Ana» es media pieza del emoji y tiraba /calendario con #418.
import { iniciales } from '@/lib/unicode-seguro';
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
.gl-marcar{appearance:none;-webkit-appearance:none;font:inherit;font-size:13px;font-weight:600;border:0;cursor:pointer;padding:5px 26px 5px 12px;border-radius:999px}
.gl-marcar-caja{position:relative;display:inline-block}
.gl-marcar-caja::after{content:"▾";position:absolute;right:10px;top:50%;transform:translateY(-52%);font-size:11px;pointer-events:none;color:inherit}
.gl-marcar:disabled{opacity:.6;cursor:progress}
.gl-marcar-caja.agendada{color:#1a73e8}.gl-marcar.agendada{color:#1a73e8;background-color:#e8f0fe}
.gl-marcar-caja.asistio{color:#137333}.gl-marcar.asistio{color:#137333;background-color:#e6f4ea}
.gl-marcar-caja.no-vino{color:#c5221f}.gl-marcar.no-vino{color:#c5221f;background-color:#fce8e6}
.gl-marcar-caja.sin-marcar{color:#9a6700}.gl-marcar.sin-marcar{color:#9a6700;background-color:#fef7e0}
.gl-abrir{color:var(--gc-azul);font-weight:600;text-decoration:none;white-space:nowrap}
.gl-oculto{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.gl-vacio{padding:48px 24px;text-align:center;color:var(--gc-gris)}
.gl-vacio b{display:block;color:var(--gc-tinta);font-size:16px;margin-bottom:6px}
.gl-filtros{display:flex;align-items:center;gap:8px;margin:0 0 12px}
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
/* Debajo de 1100 px las tareas van ABAJO de la tabla (antes se escondían): la columna entera scrollea. */
@media (max-width:1100px){
  .gl-cuerpo{flex-direction:column;overflow:auto;padding-bottom:88px}
  .gl-hoja{flex:none;border-radius:24px;overflow:visible}
  .gl-scroll{overflow:visible;flex:none}
  .gl-tareas{width:auto;flex:none;border-radius:24px}
  .gl-tareas ul{overflow:visible;padding-bottom:8px}
}
@media (max-width:900px){.gl-col-setter{display:none}}
@media (max-width:700px){.gl-col-closer,.gl-col-abrir{display:none}.gl-tabla td,.gl-tabla th{padding:10px 8px}}
`;

export function ListaLlamadas({ llamadas, tareas, hoy, tz, ahora, fallos, persona = PERSONA_TODAS, personas = [], soloLlamadas = false }: {
  llamadas: readonly LlamadaDeVenta[];
  tareas: readonly ItemCalendario[];
  hoy: string;
  tz: string;
  /** El instante del server: qué ya pasó lo decide el mismo reloj en el server y en el navegador. */
  ahora: string;
  fallos: { llamadas?: boolean; tareas?: boolean };
  /** A quién filtra al abrir (`personaDelFiltro`): la persona misma si es closer o setter, «todas» si es el admin. */
  persona?: string;
  /** Las personas del filtro, con cuántas llamadas tiene cada una (`personasDeLlamadas`). */
  personas?: ReadonlyArray<{ nombre: string; llamadas: number }>;
  /** Un closer o un setter: sin el selector de vistas (no tiene otra) y sin las tareas del Plan. */
  soloLlamadas?: boolean;
}) {
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [pestana, setPestana] = useState<PestanaLlamadas>('proximas');
  const [quien, setQuien] = useState(persona);
  const elegirPersona = (v: string) => {
    setQuien(v);
    try {
      const u = new URL(window.location.href);
      if (v === PERSONA_TODAS) u.searchParams.delete('persona'); else u.searchParams.set('persona', v);
      window.history.replaceState(window.history.state, '', u.toString());
    } catch { /* la URL es comodidad: el filtro ya cambió */ }
  };
  const opcionesPersona = useMemo((): DropdownOption[] => {
    const lista: DropdownOption[] = [
      { value: PERSONA_TODAS, label: 'Todo el equipo', icono: 'persona' },
      ...personas.map((p) => ({ value: p.nombre, label: p.nombre, sub: p.llamadas === 1 ? '1 llamada' : `${p.llamadas} llamadas`, avatar: null })),
      { value: PERSONA_SIN_ASIGNAR, label: 'Sin closer ni setter', icono: 'persona' },
    ];
    // Lo que pide la URL entra aunque no esté en la lista (un nombre escrito a mano): un desplegable que no muestra su valor
    // engaña, y el primer clic lo borraría.
    if (!lista.some((o) => o.value === quien)) lista.splice(1, 0, { value: quien, label: quien, avatar: null });
    return lista;
  }, [personas, quien]);
  // Lo recién marcado se ve en el acto, hasta que llega la lectura nueva (`router.refresh`).
  const [marcadas, setMarcadas] = useState<Record<string, boolean | null>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [porConfirmar, setPorConfirmar] = useState<{ l: LlamadaDeVenta; asistio: boolean | null; aviso: string } | null>(null);
  const vistas = useMemo(() => llamadasDeLaPersona(llamadas, quien).map((l) => (l.id in marcadas ? { ...l, asistio: marcadas[l.id] } : l)), [llamadas, marcadas, quien]);
  const cuentas = useMemo(() => cuentaPorPestana(vistas, ahora), [vistas, ahora]);
  const filas = useMemo(() => llamadasDeLaPestana(vistas, pestana, ahora), [vistas, pestana, ahora]);
  const proximasTareas = useMemo(() => [...tareas].sort((a, b) => a.inicio.localeCompare(b.inicio)), [tareas]);
  const guardar = async (l: LlamadaDeVenta, asistio: boolean | null) => {
    const campo = campoDeAsistencia(l.cual);
    const antes = l.asistio;
    setPorConfirmar(null);
    setGuardando(l.id);
    setMarcadas((m) => ({ ...m, [l.id]: asistio }));
    try {
      await guardarCampoLeadAction(l.leadId, campo, asistio);
      const texto = asistio === true ? 'asistió' : asistio === false ? 'no vino' : 'sin marcar';
      show(`${l.nombre}: ${l.cual}, ${texto}`, () => {
        setMarcadas((m) => ({ ...m, [l.id]: antes }));
        deshacerCampoLeadAction(l.leadId, campo, antes, asistio)
          .then((r) => { if (r.ok) router.refresh(); else { setMarcadas((m) => ({ ...m, [l.id]: asistio })); show(r.error, undefined, 'bad'); } })
          .catch(() => show('No se pudo deshacer', undefined, 'bad'));
      });
      router.refresh();
    } catch {
      setMarcadas((m) => ({ ...m, [l.id]: antes }));
      show('No se pudo guardar. Prueba otra vez o márcalo en la ficha.', undefined, 'bad');
    } finally {
      setGuardando(null);
    }
  };
  const elegir = (l: LlamadaDeVenta, valor: string) => {
    const asistio = valor === 'si' ? true : valor === 'no' ? false : null;
    if (asistio === l.asistio) return;
    const aviso = avisoAlMarcar(l, asistio);
    if (aviso) setPorConfirmar({ l, asistio, aviso }); else void guardar(l, asistio);
  };
  return (
    <div className="gc" data-calendario="" style={{ paddingLeft: 'var(--ancho-panel-mako, 0px)' }}>
      <style>{CSS_GC + CSS_LISTA}</style>
      <MakoEnLaTab tab="Calendario" />
      {toast && <Toast state={toast} onClose={clear} />}
      {/* Sin el logo de Google (29/10/2026): la barra es la del Calendario, con el mismo selector de cómo se mira. */}
      <header className="gc-barra">
        <h1 className="gc-titulo" id="gl-titulo">Llamadas de venta</h1>
        {!soloLlamadas && <div className="gc-derecha"><PestanasCalendario activa="llamadas" /></div>}
      </header>
      <div className="gl-cuerpo">
        <main className="gl-hoja" aria-labelledby="gl-titulo">
          <div className="gl-cabeza">
            <p>Las reuniones de los leads del CRM. Cuando una ya empezó, marca ahí mismo si asistió.</p>
            <div className="gl-filtros">
              <Dropdown value={quien} options={opcionesPersona} onChange={elegirPersona} ariaLabel="Persona" width={260} />
            </div>
            <div className="gl-tabs" role="tablist" aria-label="Qué llamadas">
              {PESTANAS_LLAMADAS.map((p) => (
                <button key={p.id} type="button" role="tab" className="gl-tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}>
                  {p.nombre}<b>{cuentas[p.id]}</b>
                </button>
              ))}
            </div>
          </div>
          {fallos.llamadas && <p className="gl-error" role="alert">No pudimos leer las llamadas del CRM. Prueba otra vez en un minuto. <ReportarASoporte /></p>}
          <div className="gl-scroll">
            {filas.length === 0
              ? <Vacio pestana={pestana} filtrado={quien !== PERSONA_TODAS} />
              : (
                <table className="gl-tabla">
                  <thead>
                    <tr><th>Lead</th><th>Reunión</th><th>Cuándo</th><th className="gl-col-closer">Closer</th><th className="gl-col-setter">Setter</th><th>Estado</th><th className="gl-col-abrir"><span className="gl-oculto">Abrir</span></th></tr>
                  </thead>
                  <tbody>
                    {filas.map((l) => {
                      const dia = diaDe(l.inicio, tz);
                      const estado: EstadoLlamada = estadoDeLlamada(l, ahora);
                      return (
                        <tr key={l.id}>
                          <td><Link className="gl-lead" href={`/crm/${l.leadId}`}><span className="gl-ini" aria-hidden>{iniciales(l.nombre, 1, '·')}</span>{l.nombre}</Link></td>
                          <td><span className="gl-reunion">{l.cual}</span></td>
                          <td className="gl-cuando"><b>{rotuloDia(dia, hoy)}</b><span>{l.diaCompleto ? 'Sin hora' : horaGoogle(horaDe(l.inicio, tz))}</span></td>
                          <td className="gl-col-closer">{l.closer ?? '—'}</td>
                          <td className="gl-col-setter">{l.setter ?? '—'}</td>
                          <td>
                            {sePuedeMarcar(l, ahora)
                              ? (
                                <span className={`gl-marcar-caja ${estado}`}>
                                  <select className={`gl-marcar ${estado}`} aria-label={`Asistencia de ${l.nombre} a la ${l.cual}`} disabled={guardando === l.id}
                                    value={l.asistio === true ? 'si' : l.asistio === false ? 'no' : 'nada'} onChange={(e) => elegir(l, e.currentTarget.value)}>
                                    <option value="nada">{TEXTO_ESTADO_LLAMADA[estado === 'agendada' ? 'agendada' : 'sin-marcar']}</option>
                                    <option value="si">{TEXTO_ESTADO_LLAMADA.asistio}</option>
                                    <option value="no">{TEXTO_ESTADO_LLAMADA['no-vino']}</option>
                                  </select>
                                </span>
                              )
                              : <span className={`gl-estado ${estado}`}>{TEXTO_ESTADO_LLAMADA[estado]}</span>}
                          </td>
                          <td className="gl-col-abrir"><Link className="gl-abrir" href={`/crm/${l.leadId}`}>Abrir ficha →</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
        </main>
        {!soloLlamadas && <aside className="gl-tareas" aria-labelledby="gl-tareas-titulo">
          <h3 id="gl-tareas-titulo">Tareas con fecha</h3>
          <p className="gl-sub">Del Plan: las vencidas en las últimas dos semanas y las del próximo mes.</p>
          {fallos.tareas && <p className="gl-error" role="alert">No pudimos leer el Plan. <ReportarASoporte /></p>}
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
        </aside>}
      </div>
      {porConfirmar && (
        <Modal titulo="¿Marcar la asistencia?" ancho={440} onCerrar={() => setPorConfirmar(null)}
          pie={<>
            <Button variant="secondary" onClick={() => setPorConfirmar(null)}>Cancelar</Button>
            <Button variant="primary" onClick={() => void guardar(porConfirmar.l, porConfirmar.asistio)}>Marcar</Button>
          </>}>
          <p style={{ margin: 0 }}>{porConfirmar.aviso}</p>
        </Modal>
      )}
    </div>
  );
}

function Vacio({ pestana, filtrado }: { pestana: PestanaLlamadas; filtrado: boolean }) {
  const texto = filtrado
    ? { t: pestana === 'proximas' ? 'Sin llamadas agendadas para esta persona' : pestana === 'pasadas' ? 'Sin llamadas pasadas para esta persona' : 'Ninguna cancelada para esta persona', d: 'Elige «Todo el equipo» en «Persona» para ver las de todos.' }
    : pestana === 'proximas'
    ? { t: 'No tienes llamadas agendadas', d: 'Cuando un lead agende su R1 o su R2, aparece aquí. También puedes pedirle a MaKo que la agende.' }
    : pestana === 'pasadas'
      ? { t: 'Todavía no hay llamadas pasadas', d: 'Las de los últimos dos meses aparecen aquí, con si asistieron.' }
      : { t: 'Ninguna cancelada', d: 'Las reuniones canceladas aparecen aquí.' };
  return <div className="gl-vacio"><b>{texto.t}</b>{texto.d}</div>;
}
