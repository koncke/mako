'use client';

// =============================================================================
// Media Buyer — la pantalla (/ads-manager): la captura 04 de AdAmigo con los colores de MaKo (25/10/2026 noche)
// =============================================================================
// Martín eligió, entre 12 apps, la captura 04 de AdAmigo (docs/media-buyer/referencias/otras-apps/04-adamigo-aplicado-y-
// deshacer.png) y la 2 para empezar. La primera versión copió otra pantalla de AdAmigo (Autopilot, con Qué · Por qué ·
// Impacto y cinco botones por tarjeta) y la rechazó: «Una cantidad de botones y texto impresionante... no se parece en nada».
// De arriba abajo, HOY es:
//   1. la caja del chat de MaKo, para darle una orden en una línea (Hoy.tsx → CajaDeOrden);
//   2. el árbol: «MaKo · 3 cambios para hoy», las ramas por producto del CRM y una tarjeta chica por cambio, con «Aplicar»
//      (Arbol.tsx); y al pie, el mensaje de MaKo con el porqué en una línea y «Aplicar los N»;
//   3. al tocar una tarjeta, su detalle en una hoja (la tarjeta entera de Autopilot.tsx: el porqué, los números, editar el
//      monto, descartar, preguntar).
// Arriba, sólo Hoy · Campañas · Biblioteca, «Actividad» (lo hecho con su Deshacer) y la tuerca (los agentes y los ajustes).
// Una cuenta NUEVA, o un día sin cambios, ve la captura 2: «¿En qué te ayudo hoy?» con cuatro sugerencias y la caja; «Lanzar
// una campaña» abre la charla del arranque con la calculadora (ArranqueMediaBuyer.tsx).
// ⚠️ Un día SIN CAMBIOS no dice «todo anda bien»: el título, la bajada y el próximo paso salen de lo que el agente midió
// (lib/media-buyer/cartel-hoy.ts) — sin cuenta, sin campañas, todo en pausa, apagado o sin lectura dicen cosas distintas.
// Lo que escribe va a /api/media-buyer (y todo, también por la API de MaKo); lo que decide, a lib/media-buyer/*.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Modal, Select, Switch, TextField, Toast, useToast } from '@/app/_ui';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import { Criatura } from '@/app/_components/Criatura';
import type { ConfigMediaBuyer, Decision, MetasDelMes } from '@/lib/media-buyer/tipos';
import type { CupoMediaBuyer } from '@/lib/media-buyer/plan';
import { resolverTacticas } from '@/lib/media-buyer/tacticas';
import type { ProductoArranque, RespuestasArranque } from '@/lib/media-buyer/arranque';
import { productoDeAccion, type AnuncioDestacado } from '@/lib/media-buyer/productos';
import { CTAS, NOMBRE_CTA, errorDeTextos, type ConjuntoParaSubir, type Cta, type TextosCreativo } from '@/lib/media-buyer/creativos';
import { subirAlStaging } from './creativeUpload';
import { NOMBRE_TACTICA, aplicablesEnLote, deHoy, lineaDelMes, resultadoAplicar, rotuloDe, type ResultadoAplicar } from './mb-modelo';
import { AlertasProtect, Ic, TarjetaAccion } from './Autopilot';
import type { Alerta } from '@/lib/media-buyer/protect';
import { ArranqueMediaBuyer } from './ArranqueMediaBuyer';
import { PanelDelFunnel } from './PanelDelFunnel';
import { funnelElegido, type PerfilCopiloto } from '@/lib/media-buyer/copiloto';
import { LienzoCampanas, type Lienzo } from './Lienzo';
import { ROTULO_PASO, cartelDeHoy, type PasoHoy } from '@/lib/media-buyer/cartel-hoy';
import { Biblioteca } from './Biblioteca';
import { PanelAgentes } from './Agentes';
import { ArbolDeHoy } from './Arbol';
import { CajaDeOrden, ListaActividad, NuevoChat, type Sugerencia } from './Hoy';
import type { AgentePropio } from '@/lib/media-buyer/agentes-propios';

type Config = ConfigMediaBuyer & { ultimaCorrida: string | null; ultimaCorridaInfo: Record<string, unknown> | null; existeTabla: boolean };
type EstadoZernio = { tieneClave: boolean; cuenta: string | null; conectado: boolean };
export type Vista = 'hoy' | 'campanas' | 'biblioteca' | 'plan';

/** Lo del arranque que sale del servidor: los productos del CRM, lo medido de los anuncios y lo que ya respondió. */
export type DatosArranque = {
  productos: ProductoArranque[]; costoMedido: number | null; cierreMedido: number | null; avatares: number; funcionalidades: number; respuestas: RespuestasArranque;
};

async function api<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }));
  return j as T & { ok: boolean; error?: string };
}

/** El objetivo que MaKo calculó con la cuenta, cuando el negocio no puso el suyo (lo deja la última corrida): con él se separa lo que funciona de lo caro. */
const objetivoRecomendado = (info: Record<string, unknown> | null): number | null =>
  info && typeof info.objetivo === 'number' && info.objetivoEsRecomendado ? info.objetivo : null;

const VISTAS_DE_SIEMPRE: Array<[Vista, string]> = [['hoy', 'Hoy'], ['campanas', 'Campañas'], ['biblioteca', 'Biblioteca']];
// Con un funnel elegido en la primera entrada se suma «Plan» (la propuesta y sus pasos): Hoy · Plan · Campañas · Biblioteca.
const VISTAS_CON_PLAN: Array<[Vista, string]> = [['hoy', 'Hoy'], ['plan', 'Plan'], ['campanas', 'Campañas'], ['biblioteca', 'Biblioteca']];

export function MediaBuyer({ nombre, inicial, metas, tieneMeta, arranque, productoDe, mejores, agentes: agentesIniciales = [], decisionInicial = null, productoInicial = null, vistaInicial = null, lienzoInicial = null, perfil = null }: {
  nombre: string;
  inicial: { config: Config; decisiones: Decision[]; existeTabla: boolean; cupo: CupoMediaBuyer };
  metas: MetasDelMes | null;
  tieneMeta: boolean;
  arranque: DatosArranque;
  /** El producto de cada entidad de la cuenta (campaña, conjunto o anuncio → el nombre del funnel): las ramas del árbol. */
  productoDe: Record<string, string>;
  /** Los anuncios que más resultados trajeron al CRM este mes (la Biblioteca). */
  mejores: AnuncioDestacado[];
  /** Los agentes propios del negocio (una regla escrita en palabras). */
  agentes?: AgentePropio[];
  /** `?decision=<id>`: la acción que abre un link (un aviso, MaKo): se abre su detalle. */
  decisionInicial?: string | null;
  /** `?producto=<id>`: abre Campañas en ese producto. */
  productoInicial?: string | null;
  /** La pestaña con que abre (`?vista=`), y el lienzo ya leído si lo hay. */
  vistaInicial?: Vista | null;
  lienzoInicial?: Lienzo | null;
  /** Lo que respondió en la primera entrada del Marketing CoPilot (null: un negocio de antes, que no la hizo). */
  perfil?: PerfilCopiloto | null;
}) {
  const VISTAS = perfil && funnelElegido(perfil) ? VISTAS_CON_PLAN : VISTAS_DE_SIEMPRE;
  const [config, setConfig] = useState<Config>(inicial.config);
  const [decisiones, setDecisiones] = useState<Decision[]>(inicial.decisiones);
  const [cupo, setCupo] = useState<CupoMediaBuyer>(inicial.cupo);
  const tacticas = useMemo(() => resolverTacticas(config.tacticas, { piloto: config.modo === 'piloto', pilotoPermitido: cupo.piloto }), [config.tacticas, config.modo, cupo.piloto]);
  const [vista, setVista] = useState<Vista>(vistaInicial ?? (productoInicial ? 'campanas' : 'hoy'));
  const [abierta, setAbierta] = useState<string | null>(decisionInicial && inicial.decisiones.some((d) => d.id === decisionInicial) ? decisionInicial : null);
  const [descartando, setDescartando] = useState<Decision | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [aplicandoTodas, setAplicandoTodas] = useState(false);
  const [zernio, setZernio] = useState<EstadoZernio | null>(null);
  const [pedidoMako, setPedidoMako] = useState<{ texto: string; vez: number } | null>(null);
  const [agentes, setAgentes] = useState<AgentePropio[]>(agentesIniciales);
  const [verAgentes, setVerAgentes] = useState(false);
  const [verActividad, setVerActividad] = useState(false);
  const [verAlertas, setVerAlertas] = useState(false);
  // La charla del arranque: la abre «Lanzar una campaña», o vuelve sola si quedó a medias.
  const [arrancando, setArrancando] = useState(() => Object.keys(arranque.respuestas ?? {}).length > 0);
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

  const hoy = useMemo(() => deHoy(decisiones), [decisiones]);
  // Protect: lo que dejó la última corrida en su resumen (lib/media-buyer/protect.ts). Sin leer Meta al abrir.
  const alertas = useMemo(() => {
    const a = (config.ultimaCorridaInfo as { alertas?: unknown } | null)?.alertas;
    return Array.isArray(a) ? (a as Alerta[]).filter((x) => x && typeof x.titulo === 'string') : [];
  }, [config.ultimaCorridaInfo]);
  const graves = alertas.filter((a) => a.gravedad === 'alta');

  const accion = useCallback(async (d: Decision, body: Record<string, unknown>, ok: string): Promise<ResultadoAplicar> => {
    setOcupada(d.id);
    const r = await api<{ ajuste?: string | null; confirmar?: string }>({ ...body, id: d.id });
    setOcupada(null);
    // Una baja de 80% o más vuelve como «confírmalo»: la pregunta la hace la tarjeta, pegada al botón (sin aviso ni recarga).
    const res = resultadoAplicar(r);
    if (typeof res === 'object') return res;
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
    const r = await api<{ resumen?: { nuevas?: number } }>({ op: 'analizar' });
    if (r.ok) {
      const n = r.resumen?.nuevas ?? 0;
      show(n ? `${n} ${n === 1 ? 'cambio nuevo' : 'cambios nuevos'}` : 'Nada nuevo para hoy', undefined, 'good');
    } else show(r.error ?? 'MaKo no pudo leer la cuenta.', undefined, 'bad');
    await recargar();
  }, [recargar, show]);

  // Sin «Marketing CoPilot:» delante (10/11/2026): el chip «desde Marketing CoPilot» ya lo dice, y se leía dos veces.
  const pedir = (texto: string) => setPedidoMako({ texto, vez: Date.now() });
  const avatar = <Criatura nombre="MaKo" size={18} estrella />;
  const producto = (d: Decision) => productoDeAccion(productoDe, d);
  const conectada = tieneMeta || !!zernio?.conectado;
  const nueva = config.existeTabla && (!conectada || (!config.encendido && !config.ultimaCorrida));
  // La bienvenida a pantalla entera («¿En qué te ayudo hoy?», sin la barra) es para quien llega sin estrategia. Con el funnel del CoPilot
  // ya elegido (producción, 10/11/2026: el negocio de prueba, sin Meta) tapaba su Plan y Ajustes, y no decía que faltaba conectar
  // Meta: va la pantalla de siempre, con la barra, y Hoy dice «Conecta tu cuenta de Meta» (cartelDeHoy).
  const bienvenida = nueva && !perfil;
  const aplicar = (d: Decision, extra: Record<string, unknown> = {}) => accion(d, { op: 'lanzar', ...extra }, d.tipo.startsWith('variaciones') ? 'Anuncios creados' : 'Aplicado');
  // ⚠️ UN DÍA SIN CAMBIOS NO ES «TODO BIEN»: el cartel sale de lo que el agente MIDIÓ (lib/media-buyer/cartel-hoy.ts), no del
  // interruptor. `conectada` va en `null` mientras no volvió el estado de Zernio: no se le dice «conecta tu cuenta» a quien
  // ya la tiene conectada, nada más porque la respuesta no llegó.
  const cartel = useMemo(() => cartelDeHoy({
    encendido: config.encendido,
    conectada: tieneMeta ? true : zernio === null ? null : zernio.conectado,
    corrida: config.ultimaCorridaInfo,
  }), [config.encendido, config.ultimaCorridaInfo, tieneMeta, zernio]);

  // Lanza en fila lo que se puede lanzar sin abrir nada (sin los textos de la IA) y dice lo que el servidor ajustó o frenó:
  // un presupuesto que se recalculó, o uno que otra decisión ya había cambiado (revisión de tren-l, fallas 0 y 1).
  const aplicarTodas = async () => {
    setAplicandoTodas(true);
    let bien = 0;
    const avisos: string[] = [];
    for (const d of aplicablesEnLote(hoy)) {
      const r = await api<{ ajuste?: string | null }>({ op: 'lanzar', id: d.id });
      if (r.ok) bien++;
      if (r.ok && r.ajuste) avisos.push(`«${d.entidadNombre}»: ${r.ajuste}`);
      if (!r.ok) avisos.push(`«${d.entidadNombre}»: ${r.error ?? 'no se pudo'}`);
    }
    setAplicandoTodas(false);
    show(avisos.length ? `${bien} aplicados. ${avisos.join(' · ')}` : `${bien} cambios aplicados`, undefined, avisos.length ? 'warn' : 'good');
    await recargar();
  };

  const sugerencia = (s: Sugerencia) => {
    if (s === 'lanzar') { if (bienvenida) setArrancando(true); else pedir('quiero lanzar una campaña nueva.'); return; }
    if (s === 'disenar') { if (bienvenida) pedir('quiero diseñar un anuncio nuevo.'); else setVista('biblioteca'); return; }
    if (s === 'como') { pedir('¿cómo vienen mis anuncios este mes?'); return; }
    if (config.encendido && conectada) void analizar(); else pedir('busca oportunidades en mi cuenta de Meta.');
  };

  // Lo que MaKo (el chat) ve de esta pantalla: los cambios de hoy, en texto.
  const pantalla = useMemo(() => [
    `Media Buyer · modo ${config.modo === 'piloto' ? 'piloto automático' : 'propone y apruebo'} · ${config.encendido ? 'encendido' : 'apagado'}`,
    ...hoy.slice(0, 12).map((d) => `- [${d.estado}] ${d.titulo} (${NOMBRE_TACTICA[d.tactica]}): ${d.titular}`),
  ].join('\n'), [config.encendido, config.modo, hoy]);

  // ── El detalle de una tarjeta: la tarjeta entera (el porqué, los números, editar, descartar, preguntar), en una hoja.
  const detalle = abierta ? decisiones.find((d) => d.id === abierta) ?? null : null;
  const hoja = detalle && (
    <Modal titulo={detalle.entidadNombre} encabezado={rotuloDe(detalle)} ancho={560} onCerrar={() => setAbierta(null)}>
      <div className="aa aa-hoja">
        {/* La táctica «hasta» (main, 29/10) se configura en Ajustes, no en Automatizaciones: no es una táctica de allá. */}
        <TarjetaAccion d={detalle} kpi={config.kpi} producto={producto(detalle)} ocupada={ocupada === detalle.id} encendido={config.encendido}
          ajustesHref={detalle.tactica === 'manual' || detalle.tactica === 'hasta' ? '/ads-manager/ajustes' : `/ads-manager/automatizaciones?t=${detalle.tactica}`}
          onAplicar={async (extra) => { const r = await aplicar(detalle, extra); if (r === true) setAbierta(null); return r; }}
          onBorrar={() => { setDescartando(detalle); setAbierta(null); }}
          onPreguntar={() => { pedir(`explícame el cambio «${detalle.titulo}» (${NOMBRE_TACTICA[detalle.tactica]}). ${detalle.titular}.`); setAbierta(null); }}
          onDeshacer={() => void accion(detalle, { op: 'deshacer' }, 'Deshecho')}
          onReabrir={() => void accion(detalle, { op: 'reabrir' }, 'Abierto otra vez')}
          onCalificar={(n) => void accion(detalle, { op: 'calificar', estrellas: n }, 'Gracias')}
          onHooksAVideo={async (elegidas) => {
            const r = await api<{ cargados: number }>({ op: 'hooks_a_video', id: detalle.id, elegidas });
            if (r.ok) show(r.cargados ? `${r.cargados} ${r.cargados === 1 ? 'guion' : 'guiones'} en Video Generator` : 'Ya estaban en Video Generator', undefined, 'good');
            else show(r.error ?? 'No se pudo.', undefined, 'bad');
          }} />
      </div>
    </Modal>
  );

  const siempre = (
    <>
      {hoja}
      {descartando && (
        <DescartarModal onCerrar={() => setDescartando(null)}
          onDescartar={async (motivo) => { const d = descartando; setDescartando(null); await accion(d, { op: 'descartar', motivo }, 'Descartado'); }} />
      )}
      <MakoEnLaTab tab="Marketing CoPilot" pedido={pedidoMako} pantalla={pantalla} encimaDeModales />
      <Toast state={toast} onClose={clear} />
    </>
  );

  if (bienvenida) {
    return (
      <div className="aa">
        {arrancando
          ? <ArranqueMediaBuyer nombre={nombre} conectada={conectada} cuenta={zernio?.cuenta ?? config.cuentaPublicitaria} {...arranque} inicial={arranque.respuestas}
              onConectado={() => { void leerZernio(); void recargar(); }}
              onGuardar={(respuestas) => { void api({ op: 'arranque', respuestas }); }}
              pilotoPermitido={cupo.piloto}
              onTerminar={async (cambio) => { const ok = await guardarConfig(cambio); if (ok) await analizar(); return ok; }}
              onPreguntar={pedir} />
          : <NuevoChat titulo="¿En qué te ayudo hoy?" bajada="Muevo tu presupuesto de Meta hacia lo que vende." onSugerencia={sugerencia} onPedir={pedir} />}
        {siempre}
      </div>
    );
  }

  // Dónde se hace cada próximo paso EN LA COMPUTADORA. ⚠️ Acá ya se pasó el `if (nueva)`: la charla del arranque no se
  // dibuja en esta rama, así que conectar NO puede ser `setArrancando(true)` (no mostraría nada). Conectar y el interruptor
  // del agente viven los dos en Ajustes (la tuerca sólo trae las tácticas).
  const PASOS: Record<PasoHoy, { href?: string; onClick?: () => void }> = {
    conectar: { href: '/ads-manager/ajustes' },
    crear_campana: { href: '/ads-manager/nueva' },
    prender_campana: { onClick: () => setVista('campanas') },
    prender_agente: { href: '/ads-manager/ajustes' },
    analizar: { onClick: () => void analizar() },
  };

  return (
    <div className="aa">
      <nav className="aa-top" aria-label="Marketing CoPilot">
        <div role="tablist" className="aa-tabs">
          {VISTAS.map(([v, t]) => (
            <button key={v} type="button" role="tab" className="aa-tab" aria-selected={vista === v} onClick={() => setVista(v)}>{t}</button>
          ))}
        </div>
        <div className="aa-top-der">
          {/* «Lánzame una campaña» (29/10/2026): la pantalla de una campaña nueva, por la Zernio del negocio (NuevaCampana.tsx). */}
          {/* Quien ya tenía campañas no pasa por la primera entrada: acá la encuentra (Martín, 6/11/2026: «me sigue saliendo Hoy y Campañas»). */}
          {!perfil && <Link href="/ads-manager?estrategia=1" className="aa-link">Armar mi estrategia</Link>}
          <Link href="/ads-manager/nueva" className="aa-link">Nueva campaña</Link>
          <button type="button" className="aa-link" onClick={() => setVerActividad(true)}>Actividad</button>
          <button type="button" className="aa-ic" aria-expanded={verAgentes} title="Agentes y ajustes" aria-label="Agentes y ajustes" onClick={() => setVerAgentes((x) => !x)}>{Ic.tuerca()}</button>
          {verAgentes && (
            <PanelAgentes resueltas={tacticas} pilotoPermitido={cupo.piloto}
              sinPiloto={cupo.recomendacionesDia != null ? 'El automático es de MaKo Pro.' : 'Tu plan todavía no trae el automático.'}
              propios={agentes} onCerrar={() => setVerAgentes(false)}
              onTacticas={(t) => guardarConfig({ tacticas: t })}
              onPropio={async (a) => {
                const r = await api<{ agentes: AgentePropio[] }>({ op: 'agente', agente: a });
                if (r.ok) { setAgentes(r.agentes); return true; }
                show(r.error ?? 'No se pudo guardar.', undefined, 'bad');
                return false;
              }}
              onBorrarPropio={async (id) => { const r = await api<{ agentes: AgentePropio[] }>({ op: 'agente_borrar', agenteId: id }); if (r.ok) setAgentes(r.agentes); }}
              pie={<><Link href="/ads-manager/ajustes" className="aa-link">Ajustes</Link><Link href="/ads-manager/automatizaciones" className="aa-link">Automatizaciones</Link></>} />
          )}
        </div>
      </nav>

      {vista === 'hoy' && (hoy.length
        ? (
          <div className="aa-hoy">
            <CajaDeOrden placeholder="Pídele un cambio a MaKo" onPedir={pedir} />
            {/* Protect: UNA línea arriba del árbol, roja si hay algo grave; las de cuidado también (antes sólo las graves tenían
                entrada, y una alerta de «cuidado» no se veía en ningún lado). Al tocarla, la hoja con todas. */}
            {alertas.length > 0 && (
              <button type="button" className="aa-aviso" data-g={graves.length ? 'alta' : 'media'} onClick={() => setVerAlertas(true)}>
                {(graves[0] ?? alertas[0]).titulo}{alertas.length > 1 ? ` y ${alertas.length - 1} más` : ''}
              </button>
            )}
            <ArbolDeHoy decisiones={hoy} productoDe={producto} kpi={config.kpi} ocupada={ocupada} encendido={config.encendido}
              avatar={avatar} aplicandoTodas={aplicandoTodas}
              onAbrir={(d) => setAbierta(d.id)} onAplicar={(d) => void aplicar(d)} onAplicarTodas={() => void aplicarTodas()} />
          </div>
        )
        : <NuevoChat titulo={cartel.titulo} bajada={cartel.bajada}
            accion={cartel.paso ? { rotulo: ROTULO_PASO[cartel.paso], ...PASOS[cartel.paso] } : null}
            onSugerencia={sugerencia} onPedir={pedir} />)}

      {vista === 'campanas' && (
        <div className="aa-pagina">
          <CajaDeOrden placeholder="Pregúntale a MaKo por tus campañas" onPedir={pedir} />
          <LienzoCampanas kpi={config.kpi} objetivo={config.objetivo ?? objetivoRecomendado(config.ultimaCorridaInfo)} mes={metas ? lineaDelMes(metas, config.kpi, config.objetivo) : null} abiertas={hoy.filter((d) => d.estado === 'abierta')} productoInicial={productoInicial} inicial={lienzoInicial} avatar={avatar}
            fechas={{ hasta: config.hasta ?? null, hastaCampanas: config.hastaCampanas ?? {} }}
            show={(msg, onUndo, tono) => show(msg, onUndo, tono ?? 'good')} onVerAcciones={(d) => setAbierta(d.id)} />
        </div>
      )}

      {vista === 'plan' && perfil && (
        // El mismo panel de la charla y de los funnels sin anuncios (9/11/2026): Tu funnel · Esta semana · Qué medir, leído del perfil.
        <div className="aa-pagina aa-plan-funnel"><PanelDelFunnel perfil={perfil} modo="listo" /></div>
      )}

      {vista === 'biblioteca' && (
        <div className="aa-pagina">
          {mejores.length > 0 && <CajaDeOrden placeholder="Pídele variaciones de un anuncio" onPedir={pedir} />}
          <Biblioteca kpi={config.kpi} mejores={mejores} avatar={avatar} onSubir={() => setSubiendo(true)} onPedir={(texto) => setPedidoMako({ texto, vez: Date.now() })} />
        </div>
      )}

      {verActividad && (
        <Modal titulo="Actividad" ancho={620} onCerrar={() => setVerActividad(false)}>
          <div className="aa aa-hoja">
            <ListaActividad decisiones={decisiones} ocupada={ocupada}
              onDeshacer={(d) => void accion(d, { op: 'deshacer' }, 'Deshecho')}
              onReabrir={(d) => void accion(d, { op: 'reabrir' }, 'Abierto otra vez')}
              onAbrir={(d) => { setVerActividad(false); setAbierta(d.id); }} />
          </div>
        </Modal>
      )}
      {verAlertas && (
        <Modal titulo="Protect" ancho={560} onCerrar={() => setVerAlertas(false)}>
          <div className="aa aa-hoja">
            <AlertasProtect alertas={alertas} onPreguntar={(a) => { setVerAlertas(false); pedir(`Protect: ${a.titulo}. ${a.detalle} ¿Qué hago?`); }} />
          </div>
        </Modal>
      )}
      {subiendo && <SubirCreativosModal onCerrar={() => setSubiendo(false)} onListo={(msg) => { setSubiendo(false); show(msg, undefined, 'good'); void recargar(); }} />}
      {siempre}
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
          <label className="aa-soltar">
            <input type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
            <span>Elige imágenes o videos (hasta 10)</span>
          </label>
          {archivos.length > 0 && (
            <ul className="aa-archivos">
              {archivos.map((a) => (
                <li key={a.clave}>
                  <span className="aa-archivo-tipo">{a.tipo === 'video' ? 'Video' : 'Imagen'}</span>
                  <span className="aa-archivo-nombre">{a.nombre}</span>
                  {a.error ? <em data-tono="mal">{a.error}</em> : a.path ? <em>Listo</em> : <div className="aa-barra" style={{ width: 120 }}><i style={{ width: `${a.progreso}%` }} /></div>}
                  <button type="button" className="aa-quitar" aria-label={`Quitar ${a.nombre}`} onClick={() => setArchivos((xs) => xs.filter((x) => x.clave !== a.clave))}>✕</button>
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
