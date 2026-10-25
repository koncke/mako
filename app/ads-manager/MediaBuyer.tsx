'use client';

// =============================================================================
// Media Buyer — la pantalla (/ads-manager), con la estructura de AdAmigo y los colores de MaKo (25/10/2026)
// =============================================================================
// Martín, 25/10/2026 ~18:50, después de ver 12 apps: «Me gusta el de "AdAmigo" implementalo de punta en punta... Lo que más
// me interesa es que en diseño se vea muy bien». La de Madgicx (14:10: «Esto de aca no se entiende nada») se reemplaza.
// De AdAmigo (docs/media-buyer/referencias/adamigo/), de arriba abajo:
//   1. las pestañas Resumen · Autopilot (N) · Campañas · Biblioteca, y a la derecha «N activos» (sus agentes) y la tuerca;
//   2. Autopilot: la cabecera «Te preparé N acciones nuevas para hoy» con su barra de aplicadas y «Ajustar IA»; las
//      subpestañas Hoy · Programadas · Implementadas · Bloqueadas; y cada acción como tarjeta (Autopilot.tsx);
//   3. a la derecha, la cuenta del mes (con los números del CRM, por producto) y los anuncios nuevos para revisar.
// Una cuenta NUEVA no ve nada de eso en cero: ve la charla del arranque con MaKo, como Offer (ArranqueMediaBuyer.tsx).
// Lo que escribe va a /api/media-buyer (y todo, también por la API de MaKo); lo que decide, a lib/media-buyer/*.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Modal, Select, Switch, TextField, Toast, useToast } from '@/app/_ui';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import type { ConfigMediaBuyer, Decision, MetasDelMes, Tactica } from '@/lib/media-buyer/tipos';
import type { CupoMediaBuyer } from '@/lib/media-buyer/plan';
import { resolverTacticas } from '@/lib/media-buyer/tacticas';
import type { ProductoArranque, RespuestasArranque } from '@/lib/media-buyer/arranque';
import { productoDeAccion, type AnuncioDestacado } from '@/lib/media-buyer/productos';
import { CTAS, NOMBRE_CTA, errorDeTextos, type ConjuntoParaSubir, type Cta, type TextosCreativo } from '@/lib/media-buyer/creativos';
import { subirAlStaging } from './creativeUpload';
import { NOMBRE_TACTICA, hace, pestanaAutopilot, type PestanaAA } from './mb-modelo';
import { AlertasProtect, AnunciosNuevos, CabeceraHoy, Ic, Nada, PanelCuenta, Subpestanas, TarjetaAccion, type ProductoEnCuenta } from './Autopilot';
import type { Alerta } from '@/lib/media-buyer/protect';
import { ArranqueMediaBuyer } from './ArranqueMediaBuyer';
import { LienzoCampanas, type Lienzo } from './Lienzo';
import { Biblioteca } from './Biblioteca';
import { PanelAgentes, contarActivos } from './Agentes';
import { Resumen } from './Resumen';
import type { AgentePropio } from '@/lib/media-buyer/agentes-propios';

type Config = ConfigMediaBuyer & { ultimaCorrida: string | null; ultimaCorridaInfo: Record<string, unknown> | null; existeTabla: boolean };
type EstadoZernio = { tieneClave: boolean; cuenta: string | null; conectado: boolean };
export type Vista = 'resumen' | 'autopilot' | 'campanas' | 'biblioteca';

/** Lo del arranque que sale del servidor: los productos del CRM, lo medido de los anuncios y lo que ya respondió. */
export type DatosArranque = {
  productos: ProductoArranque[]; costoMedido: number | null; cierreMedido: number | null; avatares: number; funcionalidades: number; respuestas: RespuestasArranque;
};

async function api<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }));
  return j as T & { ok: boolean; error?: string };
}

const hoyLocal = () => new Date().toDateString();

export function MediaBuyer({ nombre, inicial, metas, tieneMeta, arranque, productos, productoDe, mejores, agentes: agentesIniciales = [], decisionInicial = null, productoInicial = null, vistaInicial = null, lienzoInicial = null }: {
  nombre: string;
  inicial: { config: Config; decisiones: Decision[]; existeTabla: boolean; cupo: CupoMediaBuyer };
  metas: MetasDelMes | null;
  tieneMeta: boolean;
  arranque: DatosArranque;
  /** La cuenta por producto (los funnels del CRM con sus campañas): la columna de la derecha. */
  productos: ProductoEnCuenta[];
  /** El producto de cada entidad de la cuenta (campaña, conjunto o anuncio → el nombre del funnel), para la etiqueta. */
  productoDe: Record<string, string>;
  /** Los anuncios que más resultados trajeron al CRM este mes (la Biblioteca). */
  mejores: AnuncioDestacado[];
  /** Los agentes propios del negocio (una regla escrita en palabras). */
  agentes?: AgentePropio[];
  /** `?decision=<id>`: la acción que abre un link (un aviso, MaKo), en su pestaña. */
  decisionInicial?: string | null;
  /** `?producto=<id>`: abre Campañas en ese producto (las filas de producto de la columna derecha llevan ahí). */
  productoInicial?: string | null;
  /** La pestaña con que abre (`?vista=`), y el lienzo ya leído si lo hay. */
  vistaInicial?: Vista | null;
  lienzoInicial?: Lienzo | null;
}) {
  const [config, setConfig] = useState<Config>(inicial.config);
  const [decisiones, setDecisiones] = useState<Decision[]>(inicial.decisiones);
  const [cupo, setCupo] = useState<CupoMediaBuyer>(inicial.cupo);
  const tacticas = useMemo(() => resolverTacticas(config.tacticas, { piloto: config.modo === 'piloto', pilotoPermitido: cupo.piloto }), [config.tacticas, config.modo, cupo.piloto]);
  const automatica = useCallback((t: Tactica) => t !== 'manual' && tacticas[t]?.estado === 'automatica', [tacticas]);
  const deLink = decisionInicial ? inicial.decisiones.find((d) => d.id === decisionInicial) ?? null : null;
  const [vista, setVista] = useState<Vista>(vistaInicial ?? (productoInicial ? 'campanas' : 'autopilot'));
  const [sub, setSub] = useState<PestanaAA>(deLink ? pestanaAutopilot(deLink, automatica) : 'hoy');
  const [descartando, setDescartando] = useState<Decision | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [zernio, setZernio] = useState<EstadoZernio | null>(null);
  const [pedidoMako, setPedidoMako] = useState<{ texto: string; vez: number } | null>(null);
  const [agentes, setAgentes] = useState<AgentePropio[]>(agentesIniciales);
  const [verAgentes, setVerAgentes] = useState(false);
  const { toast, show, clear } = useToast();

  const recargar = useCallback(async () => {
    const r = await fetch('/api/media-buyer', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { setConfig(r.config); setDecisiones(r.decisiones); if (r.cupo) setCupo(r.cupo); }
  }, []);
  const leerZernio = useCallback(async () => {
    const r = await api<EstadoZernio>({ op: 'estado_zernio' });
    if (r.ok) setZernio({ tieneClave: r.tieneClave, cuenta: r.cuenta, conectado: r.conectado });
  }, []);
  useEffect(() => { void leerZernio(); }, [leerZernio]);
  useEffect(() => {
    if (deLink) document.getElementById(`accion-${deLink.id}`)?.scrollIntoView({ block: 'center' });
  }, [deLink]);

  const porSub = useMemo(() => {
    const g: Record<PestanaAA, Decision[]> = { hoy: [], programadas: [], implementadas: [], bloqueadas: [] };
    for (const d of decisiones) g[pestanaAutopilot(d, automatica)].push(d);
    g.implementadas.sort((a, b) => ((b.aplicadaAt ?? '') < (a.aplicadaAt ?? '') ? -1 : 1));
    return g;
  }, [decisiones, automatica]);
  const cuenta = useMemo(() => ({ hoy: porSub.hoy.length, programadas: porSub.programadas.length, implementadas: porSub.implementadas.length, bloqueadas: porSub.bloqueadas.length }), [porSub]);
  const aplicadasHoy = useMemo(() => porSub.implementadas.filter((d) => d.aplicadaAt && new Date(d.aplicadaAt).toDateString() === hoyLocal()).length, [porSub.implementadas]);
  const agentesActivos = contarActivos(tacticas, config.encendido, agentes);
  // Protect: lo que dejó la última corrida en su resumen (lib/media-buyer/protect.ts). Sin leer Meta al abrir.
  const alertas = useMemo(() => {
    const a = (config.ultimaCorridaInfo as { alertas?: unknown } | null)?.alertas;
    return Array.isArray(a) ? (a as Alerta[]).filter((x) => x && typeof x.titulo === 'string') : [];
  }, [config.ultimaCorridaInfo]);

  const accion = useCallback(async (d: Decision, body: Record<string, unknown>, ok: string) => {
    setOcupada(d.id);
    const r = await api<{ ajuste?: string | null }>({ ...body, id: d.id });
    setOcupada(null);
    if (r.ok) show(r.ajuste ? `${ok}. ${r.ajuste}` : ok, undefined, r.ajuste ? 'warn' : 'good');
    else show(r.error ?? 'No se pudo.', undefined, 'bad');
    await recargar();
    return r.ok;
  }, [recargar, show]);

  const guardarConfig = useCallback(async (cambio: Partial<ConfigMediaBuyer>): Promise<boolean> => {
    const r = await api<{ config: Config }>({ op: 'config', cambio });
    if (r.ok) { setConfig(r.config); return true; }
    show(r.error ?? 'No se pudo guardar.', undefined, 'bad');
    return false;
  }, [show]);

  const analizar = useCallback(async () => {
    setAnalizando(true);
    const r = await api<{ resumen?: { nuevas?: number } }>({ op: 'analizar' });
    setAnalizando(false);
    if (r.ok) {
      const n = r.resumen?.nuevas ?? 0;
      show(n ? `${n} ${n === 1 ? 'acción nueva' : 'acciones nuevas'}` : 'Nada nuevo para hoy', undefined, 'good');
      setSub('hoy');
    } else show(r.error ?? 'MaKo no pudo leer la cuenta.', undefined, 'bad');
    await recargar();
  }, [recargar, show]);

  const preguntar = (d: Decision) => setPedidoMako({ texto: `Media Buyer: explícame la acción «${d.titulo}» (${NOMBRE_TACTICA[d.tactica]}). ${d.titular}.`, vez: Date.now() });
  const productoDeDecision = (d: Decision) => productoDeAccion(productoDe, d);
  const actualizado = config.ultimaCorrida ? `Miré tu cuenta ${hace(config.ultimaCorrida)}` : 'Todavía no miré tu cuenta';
  const conectada = tieneMeta || !!zernio?.conectado;
  const nueva = config.existeTabla && (!conectada || (!config.encendido && !config.ultimaCorrida));

  // Lo que MaKo (el chat) ve de esta pantalla: las acciones de hoy, en texto.
  const pantalla = useMemo(() => [
    `Media Buyer · modo ${config.modo === 'piloto' ? 'piloto automático' : 'propone y apruebo'} · ${config.encendido ? 'encendido' : 'apagado'}`,
    ...porSub.hoy.slice(0, 12).map((d) => `- ${d.titulo} (${NOMBRE_TACTICA[d.tactica]}): ${d.titular}`),
  ].join('\n'), [config.encendido, config.modo, porSub.hoy]);

  const tarjeta = (d: Decision) => (
    <TarjetaAccion key={d.id} d={d} kpi={config.kpi} producto={productoDeDecision(d)} ocupada={ocupada === d.id} encendido={config.encendido}
      ajustesHref={d.tactica === 'manual' ? '/ads-manager/ajustes' : `/ads-manager/automatizaciones?t=${d.tactica}`}
      onAplicar={(extra) => accion(d, { op: 'lanzar', ...extra }, d.tipo.startsWith('variaciones') ? 'Anuncios creados' : 'Aplicada')}
      onBorrar={() => setDescartando(d)} onPreguntar={() => preguntar(d)}
      onDeshacer={() => accion(d, { op: 'deshacer' }, 'Deshecha')}
      onReabrir={() => accion(d, { op: 'reabrir' }, 'Abierta otra vez')}
      onCalificar={(n) => accion(d, { op: 'calificar', estrellas: n }, 'Gracias')}
      onHooksAVideo={async (elegidas) => {
        const r = await api<{ cargados: number }>({ op: 'hooks_a_video', id: d.id, elegidas });
        if (r.ok) show(r.cargados ? `${r.cargados} ${r.cargados === 1 ? 'guion' : 'guiones'} en Video Generator` : 'Ya estaban en Video Generator', undefined, 'good');
        else show(r.error ?? 'No se pudo.', undefined, 'bad');
      }} />
  );

  if (nueva) {
    return (
      <div className="aa">
        <ArranqueMediaBuyer nombre={nombre} conectada={conectada} cuenta={zernio?.cuenta ?? config.cuentaPublicitaria} {...arranque} inicial={arranque.respuestas}
          onConectado={() => { void leerZernio(); void recargar(); }}
          onGuardar={(respuestas) => { void api({ op: 'arranque', respuestas }); }}
          onTerminar={async (cambio) => { if (await guardarConfig(cambio)) await analizar(); }}
          onPreguntar={(texto) => setPedidoMako({ texto: `Media Buyer: ${texto}`, vez: Date.now() })} />
        <MakoEnLaTab tab="Media Buyer" pedido={pedidoMako} pantalla="Media Buyer · arranque (la charla para empezar)" encimaDeModales />
        <Toast state={toast} onClose={clear} />
      </div>
    );
  }

  const lista = porSub[sub];
  return (
    <div className="aa">
      {/* ── 1. Las pestañas de arriba (adamigo-3: Overview · Autopilot · Campaigns · Library) ── */}
      <nav className="aa-top" role="tablist" aria-label="Media Buyer">
        {([['resumen', 'Resumen', Ic.resumen], ['autopilot', 'Autopilot', Ic.autopilot], ['campanas', 'Campañas', Ic.campanas], ['biblioteca', 'Biblioteca', Ic.biblioteca]] as const).map(([v, t, ic]) => (
          <button key={v} type="button" role="tab" className="aa-tab" aria-selected={vista === v} onClick={() => setVista(v)}>
            {ic()}{t}{v === 'autopilot' && cuenta.hoy > 0 && <span className="aa-badge">{cuenta.hoy}</span>}
          </button>
        ))}
        <div className="aa-top-der">
          <button type="button" className="aa-activos" aria-expanded={verAgentes} onClick={() => setVerAgentes((x) => !x)}>
            {Ic.robot()}{agentesActivos} {agentesActivos === 1 ? 'activo' : 'activos'}<span className="aa-punto" data-off={agentesActivos ? '0' : '1'} />
          </button>
          {verAgentes && (
            <PanelAgentes resueltas={tacticas} config={config.tacticas} pilotoPermitido={cupo.piloto}
              sinPiloto={cupo.recomendacionesDia != null ? 'El automático es de MaKo Pro.' : 'Tu plan todavía no trae el automático.'}
              propios={agentes} onCerrar={() => setVerAgentes(false)}
              onTacticas={(t) => guardarConfig({ tacticas: t })}
              onPropio={async (a) => {
                const r = await api<{ agentes: AgentePropio[] }>({ op: 'agente', agente: a });
                if (r.ok) { setAgentes(r.agentes); return true; }
                show(r.error ?? 'No se pudo guardar.', undefined, 'bad');
                return false;
              }}
              onBorrarPropio={async (id) => { const r = await api<{ agentes: AgentePropio[] }>({ op: 'agente_borrar', agenteId: id }); if (r.ok) setAgentes(r.agentes); }} />
          )}
          <Link href="/ads-manager/ajustes" className="aa-ic" title="Ajustes del Media Buyer" aria-label="Ajustes del Media Buyer">{Ic.tuerca()}</Link>
        </div>
      </nav>

      {vista === 'autopilot' && (
        <div className="aa-grid">
          <div>
            <CabeceraHoy pendientes={cuenta.hoy} aplicadasHoy={aplicadasHoy} actualizado={actualizado} ajustesHref="/ads-manager/ajustes"
              alertasGraves={alertas.filter((a) => a.gravedad === 'alta').length} />
            <Subpestanas actual={sub} cuenta={cuenta} onCambiar={setSub} />
            {sub === 'hoy' && (
              <>
                <AlertasProtect alertas={alertas} onPreguntar={(a) => setPedidoMako({ texto: `Media Buyer · Protect: ${a.titulo}. ${a.detalle} ¿Qué hago?`, vez: Date.now() })} />
                {porSub.hoy.length > 0 && <><h2 className="aa-seccion">Necesita tu aprobación</h2><div className="aa-lista">{porSub.hoy.map(tarjeta)}</div></>}
                {porSub.programadas.length > 0 && <><h2 className="aa-seccion">Programadas para aplicar</h2><div className="aa-lista">{porSub.programadas.slice(0, 3).map(tarjeta)}</div></>}
                {!porSub.hoy.length && !porSub.programadas.length && (
                  <Nada>Nada para aprobar. {actualizado}. <button type="button" className="aa-sec" style={{ marginLeft: 'auto' }} disabled={analizando || !config.encendido} onClick={() => void analizar()}>{analizando ? 'Mirando…' : 'Mirar ahora'}</button></Nada>
                )}
              </>
            )}
            {sub !== 'hoy' && (lista.length ? <div className="aa-lista" style={{ marginTop: 18 }}>{lista.map(tarjeta)}</div>
              : <Nada>{sub === 'programadas' ? 'El piloto automático no tiene nada en cola.' : sub === 'implementadas' ? 'Todavía no apliqué nada.' : 'Nada frenado ni descartado.'}</Nada>)}
          </div>
          <aside className="aa-rail">
            {metas && <PanelCuenta metas={metas} kpi={config.kpi} objetivo={config.objetivo} productos={productos} />}
            <AnunciosNuevos decisiones={[...porSub.hoy, ...porSub.programadas]} onAbrir={(d) => { setSub(pestanaAutopilot(d, automatica)); setTimeout(() => document.getElementById(`accion-${d.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30); }} />
          </aside>
        </div>
      )}

      {vista === 'resumen' && (
        <Resumen metas={metas} config={config} productos={productos} implementadas={porSub.implementadas} tacticas={tacticas} propios={agentes}
          onAgentes={() => setVerAgentes(true)} onVerHechas={() => { setVista('autopilot'); setSub('implementadas'); }} />
      )}

      {vista === 'campanas' && (
        <LienzoCampanas kpi={config.kpi} objetivo={config.objetivo} abiertas={[...porSub.hoy, ...porSub.programadas]} productoInicial={productoInicial} inicial={lienzoInicial}
          show={(msg, onUndo, tono) => show(msg, onUndo, tono ?? 'good')}
          onVerAcciones={(d) => { setVista('autopilot'); setSub(pestanaAutopilot(d, automatica)); setTimeout(() => document.getElementById(`accion-${d.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30); }} />
      )}

      {vista === 'biblioteca' && (
        <Biblioteca kpi={config.kpi} mejores={mejores}
          paraRevisar={[...porSub.hoy, ...porSub.programadas].filter((d) => d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook')}
          lanzadas={porSub.implementadas.filter((d) => d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook' || d.tipo === 'crear_anuncios')}
          onAbrir={(d) => { setVista('autopilot'); setSub(pestanaAutopilot(d, automatica)); setTimeout(() => document.getElementById(`accion-${d.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30); }}
          onSubir={() => setSubiendo(true)}
          onPedir={(texto) => setPedidoMako({ texto, vez: Date.now() })} />
      )}

      {descartando && (
        <DescartarModal onCerrar={() => setDescartando(null)}
          onDescartar={async (motivo) => { const d = descartando; setDescartando(null); await accion(d, { op: 'descartar', motivo }, 'Descartada'); }} />
      )}
      {subiendo && <SubirCreativosModal onCerrar={() => setSubiendo(false)} onListo={(msg) => { setSubiendo(false); show(msg, undefined, 'good'); setVista('autopilot'); setSub('implementadas'); void recargar(); }} />}
      <MakoEnLaTab tab="Media Buyer" pedido={pedidoMako} pantalla={pantalla} encimaDeModales />
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

// ── Descartar, con el porqué (el «Are you sure you want to dismiss?» de Madgicx, ai-marketer-descartar.png). El motivo es
// opcional y queda en `motivo_descarte` (para leer qué tácticas le erran a este negocio; el motor todavía no lo usa).

function DescartarModal({ onCerrar, onDescartar }: { onCerrar: () => void; onDescartar: (motivo: string | null) => void }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Modal titulo="¿Descartar esta recomendación?" ancho={520} onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar}>Cancelar</Button><Button onClick={() => onDescartar(motivo.trim() || null)}>Descartar</Button></>}>
      <TextField multiline label="¿Por qué? (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500}
        placeholder="Por ejemplo: «esta campaña la manejo yo»" />
    </Modal>
  );
}

// ── Subir creativos nuevos a un conjunto (lo que Meta rechaza con la app del cliente: va por su Zernio) ──
// Un modal: el conjunto, los archivos (subidos al staging con su barra), los textos (los del mejor anuncio del conjunto,
// editables) y publicar. Cada archivo es un anuncio nuevo en el conjunto; queda en «Hechas» con su «Deshacer».

type ArchivoEnSubida = { clave: string; nombre: string; tipo: 'image' | 'video'; progreso: number; path: string | null; error: string | null };

function SubirCreativosModal({ onCerrar, onListo }: { onCerrar: () => void; onListo: (msg: string) => void }) {
  const [conjuntos, setConjuntos] = useState<ConjuntoParaSubir[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [adSetId, setAdSetId] = useState('');
  const [textos, setTextos] = useState<TextosCreativo>({ textoPrincipal: '', titulo: '', cta: 'LEARN_MORE', link: null, formularioId: null });
  const [deAnuncio, setDeAnuncio] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<ArchivoEnSubida[]>([]);
  const [pausa, setPausa] = useState(false);
  const [publicando, setPublicando] = useState(false);
  useEffect(() => {
    void api<{ conjuntos: ConjuntoParaSubir[]; conectado: boolean }>({ op: 'subir_preparar' }).then((r) => {
      if (!r.ok) { setAviso(r.error ?? 'No pude leer la cuenta.'); setConjuntos([]); return; }
      setConjuntos(r.conjuntos);
      if (!r.conectado) setAviso('Para publicar creativos nuevos conecta tu cuenta por Zernio (Ajustes → Conectar con Facebook).');
    });
  }, []);
  const elegir = (id: string) => {
    setAdSetId(id);
    setDeAnuncio(null);
    void api<{ plantilla: { textos: TextosCreativo; deAnuncio: string | null } | null }>({ op: 'subir_preparar', adSetId: id }).then((r) => {
      if (r.ok && r.plantilla) { setTextos(r.plantilla.textos); setDeAnuncio(r.plantilla.deAnuncio); }
    });
  };
  const agregar = (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, 10)) {
      const clave = `${f.name}-${f.size}-${Date.now()}`;
      const tipo = f.type.startsWith('video') ? 'video' as const : 'image' as const;
      setArchivos((xs) => [...xs, { clave, nombre: f.name, tipo, progreso: 0, path: null, error: null }]);
      const cambiar = (c: Partial<ArchivoEnSubida>) => setArchivos((xs) => xs.map((x) => (x.clave === clave ? { ...x, ...c } : x)));
      subirAlStaging(f, (p) => cambiar({ progreso: p })).then((r) => cambiar({ path: r.path, progreso: 100 }), (e) => cambiar({ error: e instanceof Error ? e.message : String(e) }));
    }
  };
  const listos = archivos.filter((a) => a.path && !a.error);
  const subiendoAun = archivos.some((a) => !a.path && !a.error);
  const falta = !adSetId ? 'Elige el conjunto.' : !listos.length ? 'Sube al menos un archivo.' : errorDeTextos(textos);
  const publicar = async () => {
    setPublicando(true);
    const r = await api<{ creados: string[]; errores: string[] }>({
      op: 'subir_creativos', adSetId, textos, activo: !pausa,
      archivos: listos.map((a) => ({ path: a.path, tipo: a.tipo, nombre: a.nombre })),
    });
    setPublicando(false);
    if (r.ok) onListo(r.errores?.length ? `Se crearon ${r.creados.length} de ${listos.length}` : `${r.creados.length} ${r.creados.length === 1 ? 'anuncio creado' : 'anuncios creados'}`);
    else setAviso(r.error ?? 'No se pudo publicar.');
  };
  return (
    <Modal titulo="Subir creativos" ancho={680} alto="min(88vh, 760px)" onCerrar={onCerrar}
      pie={<>
        {falta && <span style={{ marginRight: 'auto', fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>{falta}</span>}
        <Button variant="secondary" onClick={onCerrar}>Cancelar</Button>
        <Button loading={publicando} disabled={!!falta || subiendoAun} onClick={() => void publicar()}>
          {listos.length ? `Publicar ${listos.length} ${listos.length === 1 ? 'anuncio' : 'anuncios'}` : 'Publicar'}
        </Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {aviso && <Alert tono="warn">{aviso}</Alert>}
        <Select label="Conjunto" value={adSetId} onChange={elegir} placeholder={conjuntos ? 'Elige el conjunto' : 'Leyendo la cuenta…'}
          options={(conjuntos ?? []).map((c) => ({ value: c.id, label: c.nombre, sub: `${c.campana ?? 'Sin campaña'} · ${c.prendido ? 'activo' : 'pausado'} · ${c.anuncios} ${c.anuncios === 1 ? 'anuncio' : 'anuncios'}` }))} />
        <div>
          <div className="mk-label" style={{ marginBottom: 8 }}>Archivos</div>
          <label className="mb-soltar">
            <input type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
            <span>Elige imágenes o videos (hasta 10)</span>
          </label>
          {archivos.length > 0 && (
            <ul className="mb-archivos">
              {archivos.map((a) => (
                <li key={a.clave}>
                  <span aria-hidden>{a.tipo === 'video' ? '🎬' : '🖼️'}</span>
                  <span className="mb-archivo-nombre">{a.nombre}</span>
                  {a.error ? <em data-tono="mal">{a.error}</em> : a.path ? <em>Listo</em> : <div className="mb-barra" style={{ width: 120 }}><i style={{ width: `${a.progreso}%` }} /></div>}
                  <button type="button" className="mb-quitar" aria-label={`Quitar ${a.nombre}`} onClick={() => setArchivos((xs) => xs.filter((x) => x.clave !== a.clave))}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <TextField multiline label="Texto principal" value={textos.textoPrincipal} maxLength={2200}
          hint={deAnuncio ? `Del mejor anuncio del conjunto: «${deAnuncio}».` : undefined}
          onChange={(e) => setTextos((t) => ({ ...t, textoPrincipal: e.target.value }))} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
          <TextField label="Título" value={textos.titulo} maxLength={255} onChange={(e) => setTextos((t) => ({ ...t, titulo: e.target.value }))} />
          <Select label="Botón" value={textos.cta} onChange={(v) => setTextos((t) => ({ ...t, cta: v as Cta }))}
            options={CTAS.map((c) => ({ value: c, label: NOMBRE_CTA[c] }))} />
        </div>
        {textos.formularioId
          ? <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>Usa el formulario instantáneo del conjunto.</p>
          : <TextField label="Link de destino" value={textos.link ?? ''} placeholder="https://" onChange={(e) => setTextos((t) => ({ ...t, link: e.target.value || null }))} />}
        <Switch checked={pausa} onChange={setPausa} label="Dejarlos en pausa" hint="Si no, empiezan a entregar con el presupuesto del conjunto." />
      </div>
    </Modal>
  );
}
