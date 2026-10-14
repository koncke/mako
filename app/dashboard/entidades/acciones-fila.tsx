'use client';

// =============================================================================
// acciones-fila — las acciones EN LA FILA de una tabla del Dashboard (`Grafico.tabla.acciones`, tanda v5)
// =============================================================================
// «A quién cobrarle» tenía su botón «Marcar cobrado» en cada fila, de un clic, con Deshacer 5 s y la fecha de hoy
// del NEGOCIO. Desde v5 es una tabla del catálogo (el conjunto `cobranza`) con `tabla.acciones`, y su columna de
// acciones es la MISMA del detalle de un número (../Detalle.tsx): `accionesDeFila` (lib/graficos-acciones.ts)
// sobre las filas que lee el detalle, con el mismo handler de cada acción. Sirve a cualquier tabla de entidades:
// abrir la ficha del lead, ver la llamada, abrir la tarea, ver el anuncio.
//
// Cómo se enchufa (no se ve en la firma de la tabla):
//   · Quien dibuja la tarjeta (EditorInforme, P5) envuelve el cuerpo del gráfico con `<AccionesFilaProvider>`
//     SÓLO mirando, con `g.tabla?.acciones`, y nunca en un link compartido (ahí no hay sesión ni acciones).
//   · La tabla (../graficos/Tabla.tsx) pregunta `useColumnaAcciones()`: sin el provider, no hay columna.
//   · Los ids de cada fila salen de la MISMA fila del server: el detalle del gráfico ENTERO (POST /api/graficos
//     {accion:'detalle'}, con su período y sus filtros), emparejado con la tabla por el id que nombra cada fila
//     (`idDeDimension` + `filasPorId`). La cuota y su lead viajan juntos: `marcarPagoAction` no comprueba que la
//     cuota sea de ese lead. Una fila que no se puede emparejar (dos cuotas del mismo cliente) no lleva botón.
//   · La capa del workspace (qué tabs tiene) y el hoy del negocio vienen en esa misma respuesta (`puede`, `hoy`).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Button, ButtonLink, Toast, useToast } from '@/app/_ui';
import { marcarPagoAction } from '@/app/crm/actions';
import type { Efectivo, Grafico } from '@/lib/graficos-catalogo';
import type { FilaResultado } from '@/lib/graficos-agregar';
import { accionesDeFila, filasPorId, idDeDimension, type AccionFila, type FilaDetalle, type RespuestaDetalle } from '@/lib/graficos-acciones';
import { FichaLlamada } from './FichaLlamada';
import { Capa } from '../piezas';

const LeadEditModal = dynamic(() => import('@/app/crm/LeadEditModal').then((m) => m.LeadEditModal), { ssr: false });

/** El tope del pedido: la ruta corta a los 60 s (sin `signal`, una conexión caída deja el giro para siempre). */
const TOPE_MS = 65_000;

type ContextoAcciones = { g: Grafico; efectivo: Efectivo; onCambio: () => void };
const Ctx = createContext<ContextoAcciones | null>(null);

/** Lo monta quien dibuja la tarjeta de una tabla con `tabla.acciones`, sólo mirando (ver la cabecera). */
export function AccionesFilaProvider({ g, efectivo, onCambio, children }: ContextoAcciones & { children: ReactNode }) {
  const valor = useMemo(() => ({ g, efectivo, onCambio }), [g, efectivo, onCambio]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export type ColumnaAcciones = { de: (f: FilaResultado) => ReactNode; nodo: ReactNode };

/**
 * La columna de acciones de la tabla, o null (sin provider, o una tabla que no es de entidades). `de(fila)` dibuja
 * los botones de UNA fila; `nodo` son los modales y el aviso (van por portal: la grilla recorta y ubica con
 * `transform`), y la tabla lo monta una vez.
 */
export function useColumnaAcciones(): ColumnaAcciones | null {
  const c = useContext(Ctx);
  const [version, setVersion] = useState(0);
  const [lista, setLista] = useState<{ clave: string; resp: RespuestaDetalle } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ficha, setFicha] = useState<{ leadId: number; nombre: string } | null>(null);
  const [llamada, setLlamada] = useState<number | null>(null);
  const { toast, show, clear } = useToast();
  const alCambio = useRef(c?.onCambio);
  useEffect(() => { alCambio.current = c?.onCambio; });

  const id = c ? idDeDimension(c.g.fuente, c.g.dimension) : null;
  // El pedido es un string: la clave no depende de que el padre mantenga la identidad de sus objetos.
  const cuerpo = c && id
    ? JSON.stringify({ accion: 'detalle', grafico: c.g, desde: c.efectivo.desde, hasta: c.efectivo.hasta, filtros: c.efectivo.filtros, agrupar: c.efectivo.agrupar, sel: { dimension: null, valor: null } })
    : null;
  const clave = `${version}|${cuerpo ?? ''}`;
  useEffect(() => {
    if (!cuerpo) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TOPE_MS);
    fetch('/api/graficos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, signal: ctrl.signal })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as { detalle?: RespuestaDetalle } | null;
        // Sin la lista no hay botones (una tabla sin acciones no se rompe): el número sigue a la vista.
        setLista({ clave, resp: r.ok && j?.detalle ? j.detalle : { ok: false, error: 'No pude leer las filas' } });
      })
      .catch(() => { /* desmontado, reemplazado o vencido: sin botones */ })
      .finally(() => clearTimeout(t));
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [clave, cuerpo]);

  const resp = lista?.resp.ok ? lista.resp : null;
  const porId = useMemo(() => (resp && id ? filasPorId(resp.filas, id) : null), [resp, id]);
  const recargar = useCallback(() => { setVersion((v) => v + 1); alCambio.current?.(); }, []);

  const cobrar = useCallback(async (f: FilaDetalle) => {
    const pago = Number(f.ids.pago);
    const lead = Number(f.ids.lead);
    if (!resp || !Number.isFinite(pago) || !Number.isFinite(lead)) return;
    setOcupado(f.id);
    try {
      // La fecha de hoy del NEGOCIO (la trae el detalle), como «Marcar cobrada» del detalle y la vieja «A quién cobrarle».
      await marcarPagoAction(pago, lead, true, resp.hoy);
      show('Cuota cobrada', () => {
        marcarPagoAction(pago, lead, false, null).then(recargar, () => show('No se pudo deshacer', undefined, 'bad'));
      }, 'good');
      recargar();
    } catch {
      show('No se pudo marcar', undefined, 'bad');
    } finally {
      setOcupado(null);
    }
  }, [resp, recargar, show]);

  if (!c || !id) return null;
  const correr = (a: AccionFila, f: FilaDetalle) => {
    if (a.tipo === 'ficha') { const n = Number(f.ids.lead); if (Number.isFinite(n)) setFicha({ leadId: n, nombre: f.nombre }); return; }
    if (a.tipo === 'llamada') { const n = Number(f.ids.llamada); if (Number.isInteger(n) && n > 0) setLlamada(n); return; }
    if (a.tipo === 'cobrar') void cobrar(f);
  };
  const de = (fila: FilaResultado): ReactNode => {
    const f = fila.ref && porId ? porId.get(fila.ref) : undefined;
    if (!f || !resp) return null;
    const acciones = accionesDeFila(f, resp.puede, { desde: resp.desde, hasta: resp.hasta });
    if (!acciones.length) return null;
    return (
      // La fila entera abre el detalle (`alFila`): un botón no la abre.
      <span className="lk-no-arrastrar" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {acciones.map((a) => (a.tipo === 'link' && a.href ? (
          <ButtonLink key={a.id} href={a.href} newTab size="sm" variant="secondary">{a.titulo}</ButtonLink>
        ) : (
          <Button key={a.id} size="sm" variant={a.tipo === 'cobrar' ? 'primary' : 'secondary'} loading={a.tipo === 'cobrar' && ocupado === f.id}
            disabled={ocupado != null && ocupado !== f.id} onClick={() => correr(a, f)}>{a.titulo}</Button>
        )))}
      </span>
    );
  };
  // Por portal (`Capa`): la tarjeta recorta (`overflow: hidden`) y un portal de React igual burbujearía hasta ella.
  const nodo = ficha || llamada != null || toast ? (
    <Capa>
      {ficha && <LeadEditModal leadId={ficha.leadId} seed={{ nombre: ficha.nombre }} onClose={() => { setFicha(null); recargar(); }} />}
      {llamada != null && <FichaLlamada recordingId={llamada} onCerrar={() => setLlamada(null)} onCambio={recargar} />}
      <Toast state={toast} onClose={clear} />
    </Capa>
  ) : null;
  return { de, nodo };
}
