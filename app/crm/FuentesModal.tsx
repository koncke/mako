'use client';

// =============================================================================
// FuentesModal — «Asignar fuentes» del CRM, rediseñado (20/11/2026)
// =============================================================================
// Martín, 20/11/2026: «que haya 2 secciones, de "Campañas de Meta" y "Formularios"… Y para lo que necesita Juanfran, que se
// pueda asignar los "calificados" o "descalificados" y que caigan correspondientemente en su etapa… Y mejora y rediseña al
// 100% ese modal, se tiene que entender fácil». Lo que se VE vive en app/crm/FuentesVista.tsx (sin estado, así se dibuja
// igual en el artefacto); acá se lee, se guarda y se pregunta.
//
// Lo abren la primera etapa del tablero (su «⋯» y su clic derecho, `col_campanas`) y el «⋯» de arriba a la derecha
// (`AccionesHeader`, app/crm/CrmToolbar.tsx). Reemplaza a app/crm/CampanasModal.tsx en el CRM; las reglas de asignar
// campañas no cambian (app/crm/campanas-actions.ts, lib/campana-asignar.ts):
//   · prender una campaña TRAE sus leads (agrega, no mueve) y pregunta sólo si trae alguno;
//   · apagar no pregunta (no mueve a nadie) y se deshace con el aviso.
//
// ⚠️ VA POR PORTAL AL `body` (como el de antes): el tablero vive en un contenedor con scroll que recortaría la caja.
// =============================================================================

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Confirm, Toast, useToast, Button } from '@/app/_ui';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { useVerMas } from '@/app/plan/board/VerMas';
import type { ItemCampana } from '@/app/ads-manager/ProductoCelda';
import { funnelsDeAsignada, type CampanaAsignada } from '@/lib/campana-config';
import { preguntaAsignar, preguntaSumar } from '@/lib/campana-asignar';
import { etiquetaCuentaMeta, avisoSinCampanasNuevas } from '@/lib/meta-cuenta-leida';
import { previaDeReglas, REGLAS_VACIAS, type ReglasFormulario } from '@/lib/calificacion-formulario';
import {
  campanasDelProductoAction, previaCampanaAction, alternarFunnelCampanaAction, deshacerAsignacionAction,
  type EstadoCampanas, type FilaCampana,
} from './campanas-actions';
import {
  formulariosAction, alternarFormularioAction, reglasAction, guardarReglasAction, reaplicarAction,
  type EstadoFormularios, type FormularioFila, type EstadoReglas,
} from './fuentes-actions';
import { PanelFuentes, VistaReglas, CTA_FUENTES, type FilaFuente, type FiltroCampanas, type PestanaFuentes } from './FuentesVista';

/** Lo que dice Meta de cada estado, en una palabra (el mismo mapa que la tabla de antes). */
const ESTADO: Record<string, string> = {
  ACTIVE: 'Activa', PAUSED: 'Pausada', CAMPAIGN_PAUSED: 'Campaña pausada', ADSET_PAUSED: 'Pausado',
  IN_PROCESS: 'En proceso', WITH_ISSUES: 'Con problemas', PENDING_REVIEW: 'En revisión', DISAPPROVED: 'Rechazada',
  PREAPPROVED: 'Preaprobada', PENDING_BILLING_INFO: 'Falta el pago', ARCHIVED: 'Archivada', DELETED: 'Borrada',
};
const MALO = new Set(['WITH_ISSUES', 'DISAPPROVED', 'PENDING_BILLING_INFO']);
const estadoTxt = (e: string) => ESTADO[e] ?? e.toLowerCase().replace(/_/g, ' ');

/** «hace 2 h», «ayer», «hace 3 días», «hace 2 meses». */
export function haceCuanto(iso: string | null | undefined, ahora = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const min = Math.max(0, Math.round((ahora - t) / 60000));
  if (min < 60) return min <= 1 ? 'hace un momento' : `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ayer';
  if (d < 31) return `hace ${d} días`;
  const m = Math.round(d / 30);
  return m <= 1 ? 'hace un mes' : `hace ${m} meses`;
}

const host = (url: string | null) => (url ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Una fila de la pestaña «Formularios», con su línea de detalle armada. */
export function filaDeFormulario(f: FormularioFila, ahora = Date.now()): FilaFuente {
  const ultimo = haceCuanto(f.ultimo, ahora);
  const detalle = f.tipo === 'meta'
    ? [f.pagina ? `Página ${f.pagina}` : null, f.leads != null ? plural(f.leads, 'lead', 'leads') : null, ultimo ? `último ${ultimo}` : null]
    : [f.tipo === 'wg' ? host(f.pagina) : null, f.tipo === 'wg' ? 'Web Generator' : 'Tu página, con el Pixel de MaKo',
      f.leads == null ? null : f.leads === 0 ? 'sin envíos todavía' : plural(f.leads, 'envío', 'envíos'), ultimo ? `último ${ultimo}` : null];
  return {
    id: f.clave, tipo: f.tipo, nombre: f.nombre, detalle: detalle.filter(Boolean).join(' · '), prendida: f.prendido,
    tambien: f.otros, calificacion: { activa: f.reglas?.activa ?? false, reglas: f.reglas?.n ?? 0 }, sinEnvios: f.leads === 0,
  };
}

type Pide = { titulo: string; mensaje: ReactNode; confirmar: string; cancelar: string; hacer: () => Promise<void> };

const NADA = () => {};

export function FuentesModal({ funnelId, nombreProducto, onCerrar, onCambio }: {
  /** `null` = el funnel del negocio (quien monta normaliza su id numérico a `null`). */
  funnelId: number | null;
  nombreProducto: string;
  onCerrar?: () => void;
  /** Cambió algo que mueve leads o rutas: quien lo abrió refresca el tablero al cerrar. */
  onCambio?: (asignadas: CampanaAsignada[]) => void;
}) {
  const [montado, setMontado] = useState(false);
  const [pestana, setPestana] = useState<PestanaFuentes>('meta');
  const [campanas, setCampanas] = useState<EstadoCampanas | null>(null);
  const [errorCampanas, setErrorCampanas] = useState<string | null>(null);
  const [formularios, setFormularios] = useState<EstadoFormularios | null>(null);
  const [errorForms, setErrorForms] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroCampanas>('todas');
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [pide, setPide] = useState<Pide | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  // El editor de reglas de UN formulario (la segunda vista de la ventana).
  const [editando, setEditando] = useState<{ fila: FilaFuente; datos: EstadoReglas | null; error: string | null; borrador: ReglasFormulario; guardado: ReglasFormulario } | null>(null);
  const { toast, show, clear } = useToast(7000);

  useEffect(() => { setMontado(true); }, []);
  useEffect(() => {
    let vivo = true;
    campanasDelProductoAction().then((r) => { if (vivo) { if (r.ok) setCampanas(r); else setErrorCampanas(r.error); } })
      .catch(() => { if (vivo) setErrorCampanas('No se pudieron leer las campañas.'); });
    formulariosAction(funnelId).then((r) => { if (vivo) { if (r.ok) setFormularios(r); else setErrorForms(r.error); } })
      .catch(() => { if (vivo) setErrorForms('No se pudieron leer los formularios.'); });
    return () => { vivo = false; };
  }, [funnelId]);

  // ── Campañas ─────────────────────────────────────────────────────────────
  const asignadas = useMemo(() => campanas?.asignadas ?? [], [campanas]);
  const dondeVa = useMemo(() => new Map(asignadas.map((a) => [a.id, funnelsDeAsignada(a)])), [asignadas]);
  const nombreDe = (id: number | null) => campanas?.productos.find((p) => p.id === id)?.nombre ?? 'otro funnel';
  const esMia = (id: string) => !!dondeVa.get(id)?.includes(funnelId);
  const actualizar = (nuevas: CampanaAsignada[]) => {
    setCampanas((e) => (e ? { ...e, asignadas: nuevas } : e));
    onCambio?.(nuevas);
  };

  const filaCampana = (c: FilaCampana, tipo: 'campana' | 'conjunto', campanaId?: string, hijos = 0): FilaFuente => {
    const fs = dondeVa.get(c.id) ?? [];
    const propia = fs.includes(funnelId);
    const heredada = tipo === 'conjunto' && !dondeVa.has(c.id) && !!campanaId && esMia(campanaId);
    const estado = c.estado == null ? (campanas?.metaError ? null : 'Ya no está en Meta') : estadoTxt(c.estado);
    return {
      id: c.id, tipo, nombre: c.nombre || c.id,
      detalle: [estado, hijos ? plural(hijos, 'conjunto', 'conjuntos') : null].filter(Boolean).join(' · '),
      tono: c.estado === 'ACTIVE' ? 'activa' : c.estado && MALO.has(c.estado) ? 'mala' : c.estado ? 'apagada' : null,
      leads: c.leads, prendida: propia || heredada, heredada, bloqueada: heredada,
      tambien: fs.filter((x) => x !== funnelId).map(nombreDe),
    };
  };

  const conjuntosDe = useMemo(() => {
    const m = new Map<string, FilaCampana[]>();
    for (const s of campanas?.conjuntos ?? []) m.set(s.campanaId, [...(m.get(s.campanaId) ?? []), s]);
    return m;
  }, [campanas]);

  const texto = busqueda.trim().toLowerCase();
  const filasCampanas: FilaFuente[] = (() => {
    if (!campanas) return [];
    const coincide = (f: FilaCampana) => !texto || f.nombre.toLowerCase().includes(texto) || f.id.includes(texto);
    const rango = (e: string | null) => (e === 'ACTIVE' ? 0 : e == null ? 2 : 1);
    return campanas.campanas
      .filter((c) => {
        const hijos = conjuntosDe.get(c.id) ?? [];
        const pasa = (x: FilaCampana) => coincide(x)
          && (filtro !== 'activas' || x.estado === 'ACTIVE')
          && (filtro !== 'este' || esMia(x.id) || (x !== c && esMia(c.id)));
        return pasa(c) || hijos.some(pasa);
      })
      // Las de este funnel arriba, después las activas, después las que más leads traen.
      .sort((a, b) => Number(esMia(b.id)) - Number(esMia(a.id)) || rango(a.estado) - rango(b.estado) || b.leads - a.leads || a.nombre.localeCompare(b.nombre, 'es'))
      .map((c) => {
        const hijos = [...(conjuntosDe.get(c.id) ?? [])].sort((x, y) => y.leads - x.leads);
        return { ...filaCampana(c, 'campana', undefined, hijos.length), hijos: hijos.map((s) => filaCampana(s, 'conjunto', c.id)) };
      });
  })();
  const { visibles: campanasVistas, boton: verMas } = useVerMas(filasCampanas, { inicial: 8 });
  // Lo que la búsqueda encontró ADENTRO de una campaña se ve sin abrirla: detrás de la flecha se lee como «no lo encontró».
  const abiertasVistas = new Set(abiertas);
  if (texto) for (const c of filasCampanas) if (!c.nombre.toLowerCase().includes(texto) && c.hijos?.some((h) => h.nombre.toLowerCase().includes(texto) || h.id.includes(texto))) abiertasVistas.add(c.id);

  const hacerCampana = async (f: FilaFuente, prender: boolean, item: ItemCampana) => {
    setOcupada(f.id);
    try {
      const r = await alternarFunnelCampanaAction(funnelId, item, prender);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      actualizar(r.asignadas);
      const n = r.movidos.length;
      const base = prender ? (n ? `${plural(n, 'lead traído', 'leads traídos')}` : 'Entra a este funnel') : 'Ya no entra a este funnel';
      show(r.fallaron ? `${base} · ${r.fallaron} sin traer` : base, async () => {
        const d = await deshacerAsignacionAction(item.id, r.antes, r.movidos);
        if (d.ok) actualizar(d.asignadas); else show(d.error, undefined, 'bad');
      }, r.fallaron ? 'bad' : undefined);
    } catch {
      show('No se pudo guardar', undefined, 'bad');
    } finally {
      setOcupada(null);
    }
  };

  const alternarCampana = async (f: FilaFuente, prender: boolean) => {
    const padre = f.tipo === 'conjunto' ? campanas?.conjuntos.find((s) => s.id === f.id)?.campanaId : undefined;
    const item: ItemCampana = f.tipo === 'conjunto' ? { tipo: 'conjunto', id: f.id, nombre: f.nombre, ...(padre ? { campanaId: padre } : {}) } : { tipo: 'campana', id: f.id, nombre: f.nombre };
    // APAGAR NO PREGUNTA: no mueve a nadie; los que ya entraron se quedan. Se deshace con el aviso.
    if (!prender) { await hacerCampana(f, false, item); return; }
    setOcupada(f.id);
    let previa: Awaited<ReturnType<typeof previaCampanaAction>>;
    try { previa = await previaCampanaAction(funnelId, item); } catch { setOcupada(null); show('No se pudo contar', undefined, 'bad'); return; }
    setOcupada(null);
    if (!previa.ok) { show(previa.error, undefined, 'bad'); return; }
    if (previa.aTraer <= 0) { await hacerCampana(f, true, item); return; }
    const p = dondeVa.has(f.id)
      ? preguntaSumar({ producto: nombreProducto, aTraer: previa.aTraer })
      : preguntaAsignar({ producto: nombreProducto, aTraer: previa.aTraer, desde: null, porProducto: previa.porProducto });
    setPide({ titulo: p.titulo, mensaje: p.mensaje, confirmar: p.confirmar, cancelar: p.cancelar, hacer: () => hacerCampana(f, true, item) });
  };

  // ── Formularios ──────────────────────────────────────────────────────────
  const ahora = Date.now();
  const filasMeta = formularios?.meta ? formularios.meta.map((f) => filaDeFormulario(f, ahora)) : formularios ? [] : null;
  const filasWeb = formularios ? formularios.web.map((f) => filaDeFormulario(f, ahora)) : null;

  const alternarFormulario = async (f: FilaFuente, prender: boolean) => {
    setOcupada(f.id);
    try {
      const r = await alternarFormularioAction(funnelId, { clave: f.id, nombre: f.nombre }, prender);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      setFormularios((e) => (e ? {
        ...e,
        meta: e.meta?.map((x) => (x.clave === f.id ? { ...x, prendido: prender } : x)) ?? null,
        web: e.web.map((x) => (x.clave === f.id ? { ...x, prendido: prender } : x)),
      } : e));
      onCambio?.(asignadas);
      show(prender ? 'Sus leads entran a este funnel' : 'Ya no entra a este funnel', () => { void alternarFormulario({ ...f, prendida: prender }, !prender); });
    } catch {
      show('No se pudo guardar', undefined, 'bad');
    } finally {
      setOcupada(null);
    }
  };

  const alternar = (f: FilaFuente, v: boolean) => {
    if (ocupada) return;
    if (f.tipo === 'campana' || f.tipo === 'conjunto') void alternarCampana(f, v);
    else void alternarFormulario(f, v);
  };

  const cuentaMeta = campanas ? [...campanas.campanas, ...campanas.conjuntos].filter((c) => esMia(c.id)).length : 0;
  const cuentaForms = formularios ? [...(formularios.meta ?? []), ...formularios.web].filter((f) => f.prendido).length : 0;

  // ── El editor de reglas ──────────────────────────────────────────────────
  const abrirReglas = (fila: FilaFuente) => {
    setEditando({ fila, datos: null, error: null, borrador: REGLAS_VACIAS, guardado: REGLAS_VACIAS });
    reglasAction(funnelId, fila.id).then((r) => {
      setEditando((e) => (e && e.fila.id === fila.id
        ? (r.ok ? { ...e, datos: r, borrador: r.reglas, guardado: r.reglas } : { ...e, error: r.error })
        : e));
    }).catch(() => setEditando((e) => (e ? { ...e, error: 'No se pudieron leer las reglas.' } : e)));
  };
  const sucio = !!editando && JSON.stringify(editando.borrador) !== JSON.stringify(editando.guardado);
  const previa = useMemo(() => {
    if (!editando?.datos) return null;
    const m = previaDeReglas(editando.borrador, editando.datos.envios);
    const orden = [null, ...editando.datos.etapas.map((e) => e.key)];
    const porEtapa = [...m].map(([etapa, n]) => ({ etapa, n })).sort((a, b) => orden.indexOf(a.etapa) - orden.indexOf(b.etapa));
    return { total: editando.datos.envios.length, porEtapa };
  }, [editando]);

  const guardarReglas = async () => {
    if (!editando?.datos || trabajando) return;
    setTrabajando(true);
    try {
      const r = await guardarReglasAction(funnelId, editando.fila.id, editando.fila.nombre, editando.borrador);
      if (!r.ok) { show(r.error, undefined, 'bad'); return; }
      setEditando((e) => (e ? { ...e, borrador: r.reglas, guardado: r.reglas } : e));
      const clave = editando.fila.id;
      const resumen = { activa: r.reglas.activa, n: r.reglas.rutas.length };
      setFormularios((e) => (e ? {
        ...e,
        meta: e.meta?.map((x) => (x.clave === clave ? { ...x, reglas: resumen } : x)) ?? null,
        web: e.web.map((x) => (x.clave === clave ? { ...x, reglas: resumen } : x)),
      } : e));
      show(r.reglas.activa ? 'Reglas guardadas: los leads nuevos ya van a su etapa' : 'Reglas guardadas (apagadas)');
    } catch {
      show('No se pudieron guardar las reglas', undefined, 'bad');
    } finally {
      setTrabajando(false);
    }
  };

  const reaplicar = async () => {
    if (!editando?.datos || trabajando) return;
    setTrabajando(true);
    let cuenta: Awaited<ReturnType<typeof reaplicarAction>>;
    try { cuenta = await reaplicarAction(funnelId, editando.fila.id, true); } catch { setTrabajando(false); show('No se pudo contar', undefined, 'bad'); return; }
    setTrabajando(false);
    if (!cuenta.ok) { show(cuenta.error, undefined, 'bad'); return; }
    if (!cuenta.cambian) { show(`Los ${cuenta.revisados} leads ya están en su etapa`); return; }
    const detalle = cuenta.porEtapa.map((x) => `${x.n} a «${x.label}»`).join(', ');
    setPide({
      titulo: `¿Mover ${plural(cuenta.cambian, 'lead', 'leads')}?`,
      mensaje: `${detalle}. Sólo se mueven los que están en la entrada o en una etapa de estas reglas: los que ya avanzaron no se tocan.${cuenta.tope ? ` Se revisan los ${cuenta.revisados} más nuevos.` : ''}`,
      confirmar: `Mover ${cuenta.cambian}`,
      cancelar: 'No mover',
      hacer: async () => {
        setTrabajando(true);
        try {
          const r = await reaplicarAction(funnelId, editando.fila.id, false);
          if (!r.ok) { show(r.error, undefined, 'bad'); return; }
          show(r.cambian ? `${plural(r.cambian, 'lead movido', 'leads movidos')} a su etapa` : 'No hubo nada que mover');
          if (r.cambian) onCambio?.(asignadas);
        } catch {
          show('No se pudo reaplicar', undefined, 'bad');
        } finally {
          setTrabajando(false);
        }
      },
    });
  };

  const volver = () => {
    if (sucio) {
      setPide({ titulo: '¿Salir sin guardar las reglas?', mensaje: 'Los cambios de este formulario se pierden.', confirmar: 'Salir sin guardar', cancelar: 'Seguir editando', hacer: async () => setEditando(null) });
      return;
    }
    setEditando(null);
  };

  // ── Dibujo ───────────────────────────────────────────────────────────────
  const avisoCuenta = campanas?.cuentaMeta && etiquetaCuentaMeta(campanas.cuentaMeta.cuenta) ? (
    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--dim)' }}>
      {etiquetaCuentaMeta(campanas.cuentaMeta.cuenta)}
      {avisoSinCampanasNuevas(campanas.cuentaMeta) && <> · {avisoSinCampanasNuevas(campanas.cuentaMeta)}</>}
    </p>
  ) : campanas?.metaError && campanas.campanas.length > 0 ? (
    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--warn)' }}>
      {campanas.metaError === 'sin-meta'
        ? <>Sin Meta conectado: se ven las campañas con datos guardados. <BotonIntegracion servicio="meta" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conectar</BotonIntegracion></>
        : 'Meta no contestó: se ven las campañas con datos guardados.'}
    </p>
  ) : null;
  const vacioCampanas = errorCampanas ? <Vacio color="var(--bad)">{errorCampanas}</Vacio>
    : campanas && campanas.campanas.length === 0
      ? (campanas.metaError === 'sin-meta'
        ? <Vacio><BotonIntegracion servicio="meta" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conecta Meta</BotonIntegracion> para ver tus campañas.</Vacio>
        : <Vacio>{campanas.metaError ?? 'Esta cuenta no tiene campañas.'}</Vacio>)
      : undefined;
  const vacioMeta = formularios?.metaError === 'sin-meta'
    ? <Vacio><BotonIntegracion servicio="meta" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conecta Meta</BotonIntegracion> para ver tus formularios de anuncios.</Vacio>
    : formularios?.metaError ? <Vacio color="var(--warn)">Meta no contestó: {formularios.metaError}</Vacio> : undefined;

  const cuerpo = editando ? (
    editando.datos ? (
      <VistaReglas formulario={editando.fila} nombreFunnel={nombreProducto} reglas={editando.borrador} preguntas={editando.datos.preguntas}
        etapas={editando.datos.etapas} entrada={editando.datos.entrada} previa={previa}
        onCambiar={(r) => setEditando((e) => (e ? { ...e, borrador: r } : e))} onVolver={volver} />
    ) : <Vacio color={editando.error ? 'var(--bad)' : undefined}>{editando.error ?? 'Leyendo el formulario…'}</Vacio>
  ) : (
    <PanelFuentes nombreFunnel={nombreProducto} pestana={pestana} onPestana={setPestana} onAlternar={alternar} onReglas={abrirReglas} ocupada={ocupada}
      cuenta={{ meta: cuentaMeta, formularios: cuentaForms }}
      campanas={{
        filas: campanas ? campanasVistas : errorCampanas ? [] : null, busqueda, onBuscar: setBusqueda, filtro, onFiltro: setFiltro, abiertas: abiertasVistas,
        onAbrir: (id) => setAbiertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
        aviso: avisoCuenta, vacio: vacioCampanas, verMas: verMas ? <div>{verMas}</div> : null,
      }}
      formularios={{
        meta: errorForms ? [] : filasMeta, web: errorForms ? [] : filasWeb, vacioMeta,
        ...(errorForms ? { vacioWeb: <Vacio color="var(--bad)">{errorForms}</Vacio> } : {}),
      }} />
  );

  const total = editando?.datos?.total ?? 0;
  const pie = editando?.datos ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, width: '100%', flexWrap: 'wrap' }}>
      <Button variant="secondary" style={{ ...CTA_FUENTES, marginRight: 'auto' }} disabled={trabajando || sucio || !editando.guardado.activa || total === 0}
        title={sucio ? 'Guarda las reglas primero' : !editando.guardado.activa ? 'Prende la calificación automática y guarda' : total === 0 ? 'Todavía no entró nadie por este formulario' : 'Pasar estas reglas por los leads que ya entraron'}
        onClick={() => void reaplicar()}>
        {`Reaplicar a ${plural(total, 'lead', 'leads')}`}
      </Button>
      <Button variant="tertiary" onClick={volver}>Cancelar</Button>
      <Button variant="primary" style={CTA_FUENTES} disabled={!sucio || trabajando} loading={trabajando && sucio} onClick={() => void guardarReglas()}>Guardar</Button>
    </div>
  ) : undefined;

  const ventana = (
    <Modal titulo="Asignar fuentes" encabezado={<span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Funnel · {nombreProducto}</span>}
      onCerrar={onCerrar ?? NADA} ancho={820} alto="min(88vh, 780px)" sinFiletes completaEnCelular pie={pie}>
      {cuerpo}
      {pide && (
        <Confirm title={pide.titulo} message={pide.mensaje} confirmLabel={pide.confirmar} cancelLabel={pide.cancelar} tone="primary"
          onConfirm={() => { const p = pide; setPide(null); void p.hacer(); }} onCancel={() => setPide(null)} />
      )}
      <Toast state={toast} onClose={clear} />
    </Modal>
  );
  if (!montado) return null;
  return createPortal(ventana, document.body);
}

function Vacio({ children, color = 'var(--dim)' }: { children: ReactNode; color?: string }) {
  return <p style={{ margin: 0, padding: '24px 16px', fontSize: 13.5, color, textAlign: 'center', lineHeight: 1.5 }}>{children}</p>;
}
