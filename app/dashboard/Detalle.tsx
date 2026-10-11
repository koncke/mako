'use client';

// =============================================================================
// Detalle — lo que hay atrás de un número del Dashboard, con sus acciones (punto 5)
// =============================================================================
// Martín, 11/10/2026: «Los gráficos interactivos... Sería bueno que identifiques botones de acción dentro
// de MaKo que podríamos usar». Un clic en una KPI, una barra, una porción o una fila (./Grafico.tsx,
// `onDetalle`) abre esta caja: la lista de las cosas que forman ese número — los anuncios de un gasto, los
// leads de unas agendas, las cuotas de un cobro — y en cada fila sus acciones (lib/graficos-acciones.ts):
// abrir la ficha, marcar cobrada, ver el anuncio, ver la llamada, abrir la tarea. Abajo, «Filtrar la
// página por esto». La lista la lee el server (POST /api/graficos {accion:'detalle'} →
// lib/graficos-detalle.ts) con los mismos lectores, filtros y período que el gráfico.
//
// Lo que no se ve:
//   · La FICHA del lead (LeadEditModal) se dibuja en lugar de esta caja, no encima: vive en z 80 y la pila
//     de modales de app/_ui arranca en 130, así que encima quedaría tapada. Al cerrarla vuelve el detalle.
//   · «Marcar cobrada» usa los dos ids de la MISMA fila del server, con la fecha de hoy del negocio, y deja
//     Deshacer 5 s (el molde de la vieja «A quién cobrarle»). Después de cada acción: se vuelve a pedir la
//     lista y `onCambio()` le avisa a la hoja que refresque sus números.
//   · Los links abren en otra pestaña: el Dashboard que se estaba mirando no se pierde.
//   · `onCerrar` va estable (`useCerrarEstable`): el efecto de foco del Modal depende de él (AGENTS).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button, ButtonLink, Modal, Spinner, Toast, useToast } from '@/app/_ui';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import { marcarPagoAction } from '@/app/crm/actions';
import { etiquetaTiempo, fmtValor } from '@/lib/graficos-agregar';
import { fuenteDe, metricaDe, tituloDe, type Efectivo, type Grafico, type Hoja } from '@/lib/graficos-catalogo';
import { accionesDeFila, campoParaFiltrar, esDimensionTiempo, type AccionFila, type FilaDetalle, type RespuestaDetalle, type SelDetalle } from '@/lib/graficos-acciones';
import type { TemaHoja } from '@/lib/graficos-temas';

// Code-split, como en app/_components/Desglose.tsx: la ficha del CRM se baja al abrirla.
const LeadEditModal = dynamic(() => import('@/app/crm/LeadEditModal').then((m) => m.LeadEditModal), { ssr: false });

const MONO = "'Geist Mono', monospace";
/** El tope del pedido: la ruta corta a los 60 s; sin `signal`, una conexión caída deja el giro para siempre (AGENTS). */
const TOPE_MS = 65_000;

type Props = {
  g: Grafico;
  hoja: Hoja;
  /** Lo que el gráfico mira de verdad (`efectivoDe`): período, filtros y «agrupar por». */
  efectivo: Efectivo;
  sel: SelDetalle;
  tema: TemaHoja;
  onCerrar: () => void;
  /** Una acción cambió datos: la hoja tiene que volver a pedir sus números. */
  onCambio: () => void;
  /** «Filtrar la página por esto»: el campo de los controles (CAMPOS) y el valor clickeado. */
  onFiltrar?: (campo: string, valor: string) => void;
};

const fecha = (iso: string | null) => (iso ? etiquetaTiempo('dia', iso.slice(0, 10)) : '');

export function DetalleModal({ g, efectivo, sel, onCerrar, onCambio, onFiltrar }: Props) {
  const cerrar = useCerrarEstable(onCerrar);
  const alCambio = useRef(onCambio);
  useLayoutEffect(() => { alCambio.current = onCambio; });

  const [version, setVersion] = useState(0);
  const [estado, setEstado] = useState<{ clave: string; resp: RespuestaDetalle } | null>(null);
  const [ficha, setFicha] = useState<{ leadId: number; nombre: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const { toast, show, clear } = useToast();

  // El pedido es un string: la clave del efecto no depende de que el padre mantenga la identidad de sus objetos.
  const cuerpo = JSON.stringify({ accion: 'detalle', grafico: g, desde: efectivo.desde, hasta: efectivo.hasta, filtros: efectivo.filtros, agrupar: efectivo.agrupar, sel });
  const clave = `${version}|${cuerpo}`;

  useEffect(() => {
    const ctrl = new AbortController();
    let vencido = false;
    const t = setTimeout(() => { vencido = true; ctrl.abort(); }, TOPE_MS);
    const listo = (resp: RespuestaDetalle) => setEstado({ clave, resp });
    fetch('/api/graficos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, signal: ctrl.signal })
      .then(async (res) => {
        const j = (await res.json().catch(() => null)) as { detalle?: RespuestaDetalle; error?: string } | null;
        listo(res.ok && j?.detalle ? j.detalle : { ok: false, error: j?.error ?? 'No pude leer el detalle' });
      })
      .catch(() => {
        // Desmontado o reemplazado por otro pedido: nada que mostrar. Vencido: que se vea.
        if (ctrl.signal.aborted && !vencido) return;
        listo({ ok: false, error: vencido ? 'Tardó demasiado. Prueba de nuevo.' : 'No pude leer el detalle' });
      })
      .finally(() => clearTimeout(t));
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [clave, cuerpo]);

  // Mientras se vuelve a pedir (después de una acción) queda a la vista lo anterior, con el giro arriba.
  const cargando = estado?.clave !== clave;
  const resp = estado?.resp ?? null;
  const lista = resp && resp.ok ? resp : null;

  const recargar = () => { setVersion((v) => v + 1); alCambio.current(); };

  const cobrar = async (f: FilaDetalle) => {
    const pago = Number(f.ids.pago);
    const lead = Number(f.ids.lead);
    if (!lista || !Number.isFinite(pago) || !Number.isFinite(lead)) return;
    setOcupado(f.id);
    try {
      await marcarPagoAction(pago, lead, true, lista.hoy);
      show('Cuota cobrada', () => {
        marcarPagoAction(pago, lead, false, null).then(recargar, () => show('No se pudo deshacer', undefined, 'bad'));
      }, 'good');
      recargar();
    } catch {
      show('No se pudo marcar', undefined, 'bad');
    } finally {
      setOcupado(null);
    }
  };

  const correr = (a: AccionFila, f: FilaDetalle) => {
    if (a.tipo === 'ficha') { const id = Number(f.ids.lead); if (Number.isFinite(id)) setFicha({ leadId: id, nombre: f.nombre }); return; }
    if (a.tipo === 'cobrar') void cobrar(f);
  };

  // ── Lo que dice la cabecera ──
  const fuente = fuenteDe(g.fuente);
  const metrica = sel.metrica ?? g.metricas[0];
  const nombreMetrica = (fuente && metrica ? metricaDe(fuente, metrica)?.nombre : null) ?? tituloDe(g);
  const dimSel = esDimensionTiempo(sel.dimension) && efectivo.agrupar ? efectivo.agrupar : sel.dimension;
  const grupo = sel.valor == null ? null : esDimensionTiempo(dimSel) ? etiquetaTiempo(dimSel!, sel.valor) : sel.valor;
  const otraMetrica = !!sel.metrica && sel.metrica !== g.metricas[0];
  const titulo = grupo ?? (otraMetrica ? nombreMetrica : tituloDe(g));
  const encabezado = grupo || otraMetrica ? tituloDe(g) : null;

  // «Filtrar la página por esto»: sólo un grupo de categoría tiene un campo para filtrar.
  const campo = sel.valor != null && !esDimensionTiempo(sel.dimension) ? campoParaFiltrar(g.fuente, sel.dimension) : null;
  const filtrar = onFiltrar && campo && sel.valor != null ? () => { onFiltrar(campo, sel.valor!); cerrar(); } : null;

  if (ficha) {
    return (
      <>
        <LeadEditModal leadId={ficha.leadId} seed={{ nombre: ficha.nombre }} onClose={() => { setFicha(null); recargar(); }} />
        <Toast state={toast} onClose={clear} />
      </>
    );
  }

  const periodo = lista ? `${fecha(lista.desde)} – ${fecha(lista.hasta)}` : '';
  const columnas = lista?.columnas ?? [];
  const rejilla = `minmax(0, 1fr)${' auto'.repeat(columnas.length)}`;

  return (
    <>
      <Modal
        titulo={titulo}
        encabezado={encabezado ? <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>{encabezado}</span> : undefined}
        onCerrar={cerrar}
        ancho={720}
        sinFiletes
        pie={filtrar ? <Button variant="secondary" onClick={filtrar}>Filtrar la página por esto</Button> : undefined}
      >
        {!resp ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 120 }}><Spinner size={20} /></div>
        ) : !resp.ok ? (
          <p style={{ margin: 0, color: 'var(--bad)', fontSize: 14 }}>{resp.error}</p>
        ) : !resp.entidad ? (
          <p style={{ margin: 0, color: 'var(--dim)', fontSize: 14 }}>No hay una lista atrás de este número.</p>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: MONO, fontSize: 12, color: 'var(--faint)', marginBottom: 6 }}>
              <span>{resp.filas.length + resp.fuera} {(resp.plural ?? '').toLowerCase()} · {periodo}</span>
              {resp.noAplica.length > 0 && (
                <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--dim)' }}>No filtra por {resp.noAplica.join(', ')}</span>
              )}
              {cargando && <Spinner size={12} />}
            </div>

            {resp.filas.length === 0 ? (
              <p style={{ margin: '12px 0 0', color: 'var(--dim)', fontSize: 14 }}>Nada en este período.</p>
            ) : (
              <div role="list" style={{ opacity: cargando ? 0.6 : 1, transition: 'opacity .15s' }}>
                {columnas.length > 0 && (
                  <div aria-hidden style={{ display: 'grid', gridTemplateColumns: rejilla, gap: 16, padding: '6px 0', borderBottom: '1px solid var(--border)', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                    <span />
                    {columnas.map((c) => <span key={c.id} style={{ textAlign: 'right' }}>{c.nombre}</span>)}
                  </div>
                )}
                {resp.filas.map((f) => {
                  const acciones = accionesDeFila(f, resp.puede, { desde: resp.desde, hasta: resp.hasta });
                  const sub = [f.linea, fecha(f.fecha)].filter(Boolean).join(' · ');
                  return (
                    <div key={f.id} role="listitem" style={{ display: 'grid', gridTemplateColumns: rejilla, gap: 16, alignItems: 'start', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div title={f.nombre} style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nombre}</div>
                        {sub && <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
                        {acciones.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                            {acciones.map((a) => (a.tipo === 'link' && a.href ? (
                              <ButtonLink key={a.id} href={a.href} newTab size="sm" variant="secondary">{a.titulo}</ButtonLink>
                            ) : (
                              <Button key={a.id} size="sm" variant={a.tipo === 'cobrar' ? 'primary' : 'secondary'} loading={a.tipo === 'cobrar' && ocupado === f.id}
                                disabled={ocupado != null && ocupado !== f.id} onClick={() => correr(a, f)}>{a.titulo}</Button>
                            )))}
                          </div>
                        )}
                      </div>
                      {f.valores.map((v, i) => (
                        <div key={columnas[i]?.id ?? i} style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                          {fmtValor(v, columnas[i]?.formato ?? 'numero')}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {resp.fuera > 0 && <p style={{ margin: '10px 0 0', fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>+{resp.fuera} más</p>}
              </div>
            )}
          </div>
        )}
      </Modal>
      <Toast state={toast} onClose={clear} />
    </>
  );
}
