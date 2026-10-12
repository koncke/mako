'use client';

// =============================================================================
// ElementoIA — la caja «Conclusiones de MaKo» y su panel (tanda v5, puntos 2 y 8; I3 del contrato)
// =============================================================================
// Martín (12/10/2026): una caja de texto que MaKo escribe y se actualiza, configurable, como un elemento más del
// editor. La IA es GRATIS; corre al configurarla («Generar» en el panel), a mano (↻ en la caja) y con un horario
// opcional. NUNCA al abrir la hoja. El trabajo lo hace el server (app/api/graficos/ia-elemento →
// lib/graficos-ia-elemento-server.ts): acá no se serializa nada para el modelo.
//
// `ElementoIA` (P5 lo monta desde Elemento.tsx para `tipo: 'ia'`) dibuja el último texto: un párrafo, viñetas o
// tarjetas con número; dice «hace 3 días» y, si lo que leyó cambió, «Los datos cambiaron» (`cambiosDesde`, con
// la firma de lo que la hoja muestra AHORA) — avisa, no dispara. Mientras corre, el estado de MaKo de
// lib/mako-gramatica.ts (no un rótulo propio).
// `PropsIA` (P5 lo monta en Propiedades.tsx para `tipo: 'ia'`): «Qué le pides», «Lee», «Muestra», «Largo»,
// «Formato» y «Cuándo», y «Generar».
//
// Lo que no se ve en la firma:
//   · EL ÚNICO PEDIDO AL MONTAR ES UN GET (leer el último texto). Generar es un POST que sale SÓLO de un clic
//     (`generarCaja`): tests/graficos-ia-elemento.test.ts lo fija.
//   · Los nombres de personas que el modelo no vio («Closer 1») se muestran con el nombre real: el reemplazo lo
//     hace el código, en la pantalla con sesión (`conNombres`). En un link compartido la caja no pide nada.
//   · El número de una tarjeta sale de la ENTRADA (la cita del hallazgo), no del texto del modelo.
//   · El panel y la caja se hablan por un evento de la ventana: «Generar» del panel avisa, y la caja relee.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Mako, Spinner } from '@/app/_ui';
import { MakoStar } from '@/app/_components/MakoBrand';
import { Dropdown } from '@/app/components/Dropdown';
import { esElemento, esGrafico, tituloDe, TOPE_PEDIDO_IA, type Componente, type ConfigIA, type Elemento, type Hoja, type VistaValores } from '@/lib/graficos-catalogo';
import { fmtValor } from '@/lib/graficos-agregar';
import { cambiosDesde, conNombres, haceCuanto } from '@/lib/graficos-analisis';
import { frasesDe, type PuntoCaja, type SalidaCaja, type VistaCaja } from '@/lib/graficos-ia-elemento';
import type { ContextoEntidad } from '@/lib/graficos-acciones';
import type { LoQueSeVe } from './PanelAnalista';

const RUTA = '/api/graficos/ia-elemento';
/** El panel generó o programó una caja: la caja de ese id vuelve a leer. */
const EVENTO = 'mako:caja-ia';

type Respuesta = { vista?: VistaCaja; estado?: string; error?: string };
const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'No pude completar el pedido');

async function leerCaja(q: { hojaId: string; elementoId: string; popupDe: string | null; ref: string | null }): Promise<VistaCaja> {
  const p = new URLSearchParams({ hoja: q.hojaId, elemento: q.elementoId });
  if (q.popupDe) p.set('popup', q.popupDe);
  if (q.ref) p.set('ref', q.ref);
  const r = await fetch(`${RUTA}?${p}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  const j = (await r.json().catch(() => ({}))) as Respuesta;
  if (!r.ok || !j.vista) throw new Error(j.error || 'No pude leer las conclusiones');
  return j.vista;
}

/**
 * Pide escribir la caja (sólo el admin; la ruta lo vuelve a mirar). Va por detrás en el server: la respuesta dice
 * «corriendo» y la caja pregunta el avance. ⚠️ Sólo se llama desde un CLIC (el ↻ de la caja, «Generar» del panel).
 */
export async function generarCaja(q: { hoja: Hoja; elementoId: string; popupDe: string | null; ref: string | null; vista?: VistaValores }): Promise<VistaCaja | null> {
  const r = await fetch(RUTA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ accion: 'generar', hoja: q.hoja, elementoId: q.elementoId, popupDe: q.popupDe, ref: q.ref, vista: q.vista ?? {} }),
  });
  const j = (await r.json().catch(() => ({}))) as Respuesta;
  if (!r.ok) throw new Error(j.error || 'No pude escribir las conclusiones');
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: q.elementoId }));
  return j.vista ?? null;
}

/** El «Cuándo» de una caja suelta en la hoja: la ruta lo lee de la configuración que se le manda. */
async function programarCaja(hoja: Hoja, elementoId: string): Promise<void> {
  const r = await fetch(RUTA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ accion: 'programar', hoja, elementoId }),
  });
  const j = (await r.json().catch(() => ({}))) as Respuesta;
  if (!r.ok) throw new Error(j.error || 'No pude guardar el horario');
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: elementoId }));
}

function useAhora(cadaMs: number): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), cadaMs); return () => clearInterval(i); }, [cadaMs]);
  return t;
}

const CSS = `
.ia-caja { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
.ia-cab { display: flex; align-items: center; gap: 8px; flex: none; }
.ia-tit { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ia-re { flex: none; width: 28px; height: 28px; border: none; border-radius: 8px; background: transparent; color: var(--dim); font-size: 16px; cursor: pointer; }
.ia-re:hover:not(:disabled) { background: var(--velo-hover); color: var(--ink); }
.ia-re:disabled { opacity: .5; cursor: default; }
.ia-cuerpo { flex: 1; min-height: 0; overflow-y: auto; font-size: 14px; line-height: 1.55; color: var(--ink); }
.ia-cuerpo p { margin: 0 0 8px; }
.ia-vinetas { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.ia-tarjetas { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.ia-tarjeta { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--surface); display: flex; flex-direction: column; gap: 4px; }
.ia-num { font-size: 24px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
.ia-pie { flex: none; display: flex; gap: 8px; flex-wrap: wrap; font-size: 13px; color: var(--faint); }
.ia-cambio { color: var(--warn); font-weight: 600; }
.ia-vacio { flex: 1; display: grid; place-items: center; text-align: center; font-size: 13px; color: var(--faint); padding: 8px; }
.ia-ejemplos { display: flex; flex-wrap: wrap; gap: 6px; }
.ia-ejemplo { border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--dim); font: inherit; font-size: 12.5px; padding: 3px 10px; cursor: pointer; }
.ia-ejemplo:hover { background: var(--surface-2); color: var(--ink); }
.ia-texto { width: 100%; box-sizing: border-box; min-height: 74px; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 14px; color: var(--ink); background: var(--surface); resize: vertical; }
.ia-texto:focus { outline: none; border-color: var(--primary); }
`;
const Estilos = () => <style href="dash-caja-ia" precedence="medium">{CSS}</style>;

const colorTono = (t: PuntoCaja['tono']) => (t === 'bueno' ? 'var(--good)' : t === 'malo' ? 'var(--bad)' : 'var(--ink)');

/** El texto de la caja en su formato. Los alias van con el nombre real (`conNombres`). */
function Salida({ s, formato, nombres }: { s: SalidaCaja; formato: ConfigIA['formato']; nombres: Record<string, string> }) {
  const n = (t: string) => conNombres(t, nombres);
  const items: Array<{ titulo: string; texto: string; tono: PuntoCaja['tono']; num: string | null }> = s.puntos.length
    ? s.puntos.map((p) => ({ titulo: n(p.titulo), texto: n(p.texto), tono: p.tono, num: p.cita ? fmtValor(p.cita.valor, p.cita.formato) : null }))
    : frasesDe(n(s.resumen)).map((f) => ({ titulo: '', texto: f, tono: 'neutro' as const, num: null }));
  if (formato === 'tarjetas') {
    return (
      <div className="ia-tarjetas">
        {items.map((it, i) => (
          <div key={i} className="ia-tarjeta">
            {it.num && <span className="ia-num" style={{ color: colorTono(it.tono) }}>{it.num}</span>}
            {it.titulo && <strong style={{ fontSize: 13.5 }}>{it.titulo}</strong>}
            <span style={{ fontSize: 13.5, color: it.titulo ? 'var(--dim)' : 'var(--ink)' }}>{it.texto}</span>
          </div>
        ))}
      </div>
    );
  }
  if (formato === 'vinetas') {
    return (
      <ul className="ia-vinetas">
        {items.map((it, i) => <li key={i}>{it.titulo ? <><strong style={{ color: colorTono(it.tono) }}>{it.titulo}</strong>{it.texto ? ` — ${it.texto}` : ''}</> : it.texto}</li>)}
      </ul>
    );
  }
  if (!s.puntos.length) return <p>{n(s.resumen)}</p>;
  return <>{items.map((it, i) => <p key={i}><strong style={{ color: colorTono(it.tono) }}>{it.titulo}.</strong> {it.texto}</p>)}</>;
}

export function ElementoIA({ e, hoja, popupDe = null, contexto = null, editando, puedeGenerar, compartido = false, loQueSeVe = [], vista }: {
  e: Elemento;
  /** La hoja entera (con el pop-up adentro, si la caja vive en uno): es lo que se manda al generar. */
  hoja: Hoja;
  /** El id del gráfico en cuyo pop-up vive la caja; null = suelta en la hoja. */
  popupDe?: string | null;
  /** Lo que se abrió en el pop-up (`contextoDeClic`); null en la hoja o editando sin una fila de muestra. */
  contexto?: ContextoEntidad | null;
  editando: boolean;
  /** El admin (la ruta lo vuelve a mirar). El closer lee la caja de la cuenta y no genera. */
  puedeGenerar: boolean;
  /** Un link compartido: no se pide nada. */
  compartido?: boolean;
  /** Lo que cada gráfico de la hoja muestra AHORA: sólo para la firma («los datos cambiaron»). */
  loQueSeVe?: LoQueSeVe[];
  /** Lo que la persona eligió MIRANDO: el ↻ mira eso, igual que el AI Analyst a mano. */
  vista?: VistaValores;
}) {
  const ia = e.ia;
  const enPopup = !!popupDe;
  const ref = enPopup ? contexto?.ref ?? null : null;
  const [estado, setEstado] = useState<{ caja: string; vista: VistaCaja | null; error: string | null } | null>(null);
  const [version, setVersion] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null);
  const ahora = useAhora(30_000);
  // Sin nada que leer no se pregunta: un link (sin sesión) o un pop-up sin nada abierto.
  const sinPedido = compartido || (enPopup && !ref);
  // La caja (sin la versión): mientras se vuelve a leer —el avance, cada 2,5 s— queda a la vista lo que había.
  const caja = `${hoja.id}|${popupDe ?? ''}|${e.id}|${ref ?? ''}`;

  useEffect(() => {
    if (sinPedido) return;
    let vivo = true;
    leerCaja({ hojaId: hoja.id, elementoId: e.id, popupDe, ref })
      .then((v) => { if (vivo) setEstado({ caja, vista: v, error: null }); })
      .catch((err) => { if (vivo) setEstado({ caja, vista: null, error: mensaje(err) }); });
    return () => { vivo = false; };
  }, [caja, version, sinPedido, hoja.id, e.id, popupDe, ref]);

  // El panel generó o programó ESTA caja: se relee.
  useEffect(() => {
    const alAviso = (ev: Event) => { if ((ev as CustomEvent<string>).detail === e.id) setVersion((x) => x + 1); };
    window.addEventListener(EVENTO, alAviso);
    return () => window.removeEventListener(EVENTO, alAviso);
  }, [e.id]);

  // Mientras corre, se pregunta el avance (la corrida sigue en el server aunque se cierre la hoja).
  const actual = estado && estado.caja === caja ? estado : null;
  const corriendo = !!actual?.vista?.corriendo;
  useEffect(() => {
    if (!corriendo) return;
    const t = setInterval(() => setVersion((x) => x + 1), 2500);
    return () => clearInterval(t);
  }, [corriendo]);

  const ultimo = actual?.vista?.ultimo ?? null;
  const cambio = useMemo(() => {
    if (!ultimo?.firmas || !ultimo.rangos) return false;
    return cambiosDesde({ firmas: ultimo.firmas, rangos: ultimo.rangos }, loQueSeVe).datos.length > 0;
  }, [ultimo, loQueSeVe]);

  const generar = useCallback(async () => {
    setEnviando(true); setAvisoEnvio(null);
    try {
      const v = await generarCaja({ hoja, elementoId: e.id, popupDe, ref, vista });
      if (v) setEstado({ caja, vista: v, error: null });
    } catch (err) { setAvisoEnvio(mensaje(err)); } finally { setEnviando(false); }
  }, [hoja, e.id, popupDe, ref, vista, caja]);

  if (!ia) return null;
  const titulo = e.texto.trim() || 'Conclusiones de MaKo';
  if (compartido) return <div className="ia-caja"><Estilos /><Cabecera titulo={titulo} /><div className="ia-vacio">No se comparte en un link</div></div>;
  if (enPopup && !ref) return <div className="ia-caja"><Estilos /><Cabecera titulo={titulo} /><div className="ia-vacio">Lee lo que se abre</div></div>;

  const puedeRe = puedeGenerar && !editando && !corriendo;
  const re = puedeGenerar && !editando ? (
    <button type="button" className="ia-re lk-no-arrastrar" onClick={(ev) => { ev.stopPropagation(); void generar(); }} disabled={!puedeRe || enviando}
      aria-label="Volver a escribir" title="Volver a escribir">{enviando ? <Spinner size={14} /> : '↻'}</button>
  ) : null;

  let cuerpo: ReactNode;
  if (!actual) cuerpo = <div className="ia-vacio"><Spinner size={16} /></div>;
  else if (actual.error) cuerpo = <div className="ia-vacio" style={{ color: 'var(--bad)' }}>{actual.error}</div>;
  else if (corriendo) {
    const fase = actual.vista!.corriendo!.fase;
    cuerpo = (
      <Mako estado="analizando" titulo={titulo} fuente={fase === 'escribiendo' ? 'Escribiendo' : 'Leyendo los datos'}
        progreso={fase === 'escribiendo' ? 0.6 : 0.2} pasos={['Leer', 'Escribir']} />
    );
  } else if (ultimo) {
    cuerpo = <div className="ia-cuerpo"><Salida s={ultimo.salida} formato={ia.formato} nombres={ultimo.nombres} /></div>;
  } else {
    cuerpo = (
      <div className="ia-vacio">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <span>{actual.vista?.fallo ? actual.vista.fallo.error : 'Todavía no hay conclusiones.'}</span>
          {puedeRe && <Button size="sm" variant="secondary" onClick={(ev) => { ev.stopPropagation(); void generar(); }} loading={enviando}>{actual.vista?.fallo ? 'Probar de nuevo' : 'Generar'}</Button>}
        </div>
      </div>
    );
  }
  const fallo = actual?.vista?.fallo && ultimo ? actual.vista.fallo : null;

  return (
    <div className="ia-caja">
      <Estilos />
      <Cabecera titulo={titulo} animar={corriendo}>{re}</Cabecera>
      {cuerpo}
      {(ultimo || fallo || avisoEnvio) && !corriendo && (
        <div className="ia-pie">
          {ultimo && <span>{haceCuanto(ultimo.analizadoAt, ahora)}</span>}
          {cambio && <span className="ia-cambio">Los datos cambiaron</span>}
          {fallo && <span style={{ color: 'var(--bad)' }} title={fallo.error}>No se pudo actualizar</span>}
          {avisoEnvio && <span style={{ color: 'var(--bad)' }}>{avisoEnvio}</span>}
        </div>
      )}
    </div>
  );
}

function Cabecera({ titulo, animar = false, children }: { titulo: string; animar?: boolean; children?: ReactNode }) {
  return (
    <div className="ia-cab">
      <MakoStar size={15} animate={animar} />
      <span className="ia-tit" title={titulo}>{titulo}</span>
      {children}
    </div>
  );
}

// ── El panel ──────────────────────────────────────────────────────────────────────────────

/** Los «patrones» deterministas de las tabs viejas, ahora INSTRUCCIONES de ejemplo (decisión de la tanda v5). */
const EJEMPLOS = ['Qué escribir esta semana', 'Qué decide los cierres', 'Qué patrones separan a los guiones que agendan de los que no'];
const VISTAS: Array<{ id: ConfigIA['vista']; nombre: string }> = [
  { id: 'resumen', nombre: 'Resumen' }, { id: 'hallazgos', nombre: 'Hallazgos' }, { id: 'recomendaciones', nombre: 'Recomendaciones' }, { id: 'texto', nombre: 'Texto' },
];
const LARGOS_UI: Array<{ id: ConfigIA['largo']; nombre: string }> = [{ id: 'corto', nombre: 'Corto' }, { id: 'medio', nombre: 'Medio' }, { id: 'largo', nombre: 'Largo' }];
const FORMATOS: Array<{ id: ConfigIA['formato']; nombre: string }> = [{ id: 'parrafo', nombre: 'Párrafo' }, { id: 'vinetas', nombre: 'Viñetas' }, { id: 'tarjetas', nombre: 'Tarjetas' }];
type Cuando = 'mano' | 'dia' | 'semana' | 'mes';
const CUANDOS: Array<{ id: Cuando; nombre: string }> = [
  { id: 'mano', nombre: 'A mano' }, { id: 'dia', nombre: 'Cada día' }, { id: 'semana', nombre: 'Cada lunes' }, { id: 'mes', nombre: 'El 1 de cada mes' },
];
const HORAS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }));

/** La hoja con la caja cambiada (en la hoja o adentro del pop-up de `popupDe`): lo que se manda al programar. */
function hojaConCaja(hoja: Hoja, popupDe: string | null, id: string, ia: ConfigIA): Hoja {
  const cambiar = (cs: Componente[]): Componente[] => cs.map((c) => (c.id === id && esElemento(c) ? { ...c, ia } : c));
  if (!popupDe) return { ...hoja, componentes: cambiar(hoja.componentes) };
  return {
    ...hoja,
    componentes: hoja.componentes.map((c) => (esGrafico(c) && c.id === popupDe && c.popup ? { ...c, popup: { ...c.popup, componentes: cambiar(c.popup.componentes) } } : c)),
  };
}

function Radios<T extends string>({ nombre, opciones, valor, onElegir }: { nombre: string; opciones: Array<{ id: T; nombre: string }>; valor: T; onElegir: (v: T) => void }) {
  return (
    <div className="lk-radios" role="radiogroup" aria-label={nombre}>
      {opciones.map((o) => <label key={o.id}><input type="radio" checked={valor === o.id} onChange={() => onElegir(o.id)} /> {o.nombre}</label>)}
    </div>
  );
}

/**
 * El panel de una caja (P5 lo monta en Propiedades.tsx para `tipo: 'ia'`, debajo de la cabecera del elemento).
 * Cada cambio va por `onCambiar` (el autoguardado del informe); el «Cuándo» además se programa en el server, y
 * «Generar» la escribe con lo que está configurado. Adentro de un pop-up la caja lee lo que se abrió: no hay
 * «Lee» ni «Cuándo» (un horario no sabe qué abrir), y genera sobre la fila de muestra que le pase el pop-up.
 */
export function PropsIA({ e, hoja, popupDe = null, contexto = null, vista, onCambiar }: {
  e: Elemento; hoja: Hoja; popupDe?: string | null; contexto?: ContextoEntidad | null; vista?: VistaValores;
  onCambiar: (p: Partial<Elemento>) => void;
}) {
  const ia = e.ia;
  const [pedido, setPedido] = useState(ia?.pedido ?? '');
  const [base, setBase] = useState(ia?.pedido ?? '');
  const [enviando, setEnviando] = useState<null | 'generar' | 'programar'>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  if (ia && base !== ia.pedido) { setBase(ia.pedido); setPedido(ia.pedido); }
  if (!ia) return null;
  const enPopup = !!popupDe;
  // Los gráficos que puede leer: los de su mismo lugar (la hoja, o el pop-up).
  const graficos = enPopup
    ? ((hoja.componentes.find((c) => esGrafico(c) && c.id === popupDe) as { popup?: { componentes: Hoja['componentes'] } } | undefined)?.popup?.componentes ?? []).filter(esGrafico)
    : hoja.componentes.filter(esGrafico);
  const poner = (p: Partial<ConfigIA>) => onCambiar({ ia: { ...ia, ...p, ...(enPopup ? { lee: 'entidad' as const } : {}) } });
  const guardarPedido = (t: string) => { const v = t.slice(0, TOPE_PEDIDO_IA); if (v !== ia.pedido) poner({ pedido: v }); };
  const cuando: Cuando = ia.cron ? ia.cron.unidad : 'mano';

  const programar = async (cron: ConfigIA['cron']) => {
    const nueva: ConfigIA = { ...ia, cron };
    onCambiar({ ia: nueva });
    setEnviando('programar'); setAviso(null);
    try { await programarCaja(hojaConCaja(hoja, null, e.id, nueva), e.id); } catch (err) { setAviso(mensaje(err)); } finally { setEnviando(null); }
  };
  const generar = async () => {
    setEnviando('generar'); setAviso(null);
    try {
      const actualizada: ConfigIA = { ...ia, pedido: pedido.slice(0, TOPE_PEDIDO_IA), ...(enPopup ? { lee: 'entidad' as const } : {}) };
      if (actualizada.pedido !== ia.pedido) onCambiar({ ia: actualizada });
      await generarCaja({ hoja: hojaConCaja(hoja, popupDe, e.id, actualizada), elementoId: e.id, popupDe, ref: contexto?.ref ?? null, vista });
    } catch (err) { setAviso(mensaje(err)); } finally { setEnviando(null); }
  };

  return (
    <>
      <div className="lk-seccion">
        <div className="lk-seccion-tit">Qué le pides</div>
        <textarea className="ia-texto" value={pedido} maxLength={TOPE_PEDIDO_IA} aria-label="Qué le pides" placeholder="Qué decide los cierres"
          onChange={(ev) => setPedido(ev.target.value)} onBlur={() => guardarPedido(pedido)}
          onKeyDown={(ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); setPedido(ia.pedido); } }} />
        <div className="ia-ejemplos">
          {EJEMPLOS.map((x) => <button key={x} type="button" className="ia-ejemplo" onClick={() => { setPedido(x); guardarPedido(x); }}>{x}</button>)}
        </div>
      </div>
      {!enPopup && (
        <div className="lk-seccion">
          <div className="lk-seccion-tit">Lee</div>
          <Radios nombre="Lee" opciones={[{ id: 'todos', nombre: 'Toda la hoja' }, { id: 'elegir', nombre: 'Elegir gráficos' }]}
            valor={ia.fuentes == null ? 'todos' : 'elegir'} onElegir={(v) => poner({ fuentes: v === 'todos' ? null : graficos.map((g) => g.id) })} />
          {ia.fuentes != null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {graficos.length === 0 && <span className="lk-ayuda">Esta hoja no tiene gráficos.</span>}
              {graficos.map((g) => (
                <label key={g.id} className="lk-check">
                  <input type="checkbox" checked={ia.fuentes!.includes(g.id)}
                    onChange={(ev) => poner({ fuentes: ev.target.checked ? [...ia.fuentes!, g.id] : ia.fuentes!.filter((x) => x !== g.id) })} />
                  <span>{tituloDe(g)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="lk-seccion">
        <div className="lk-seccion-tit">Muestra</div>
        <Radios nombre="Muestra" opciones={VISTAS} valor={ia.vista} onElegir={(v) => poner({ vista: v })} />
      </div>
      <div className="lk-seccion">
        <div className="lk-seccion-tit">Largo</div>
        <Radios nombre="Largo" opciones={LARGOS_UI} valor={ia.largo} onElegir={(v) => poner({ largo: v })} />
      </div>
      <div className="lk-seccion">
        <div className="lk-seccion-tit">Formato</div>
        <Radios nombre="Formato" opciones={FORMATOS} valor={ia.formato} onElegir={(v) => poner({ formato: v })} />
      </div>
      {!enPopup && (
        <div className="lk-seccion">
          <div className="lk-seccion-tit">Cuándo</div>
          <Radios nombre="Cuándo" opciones={CUANDOS} valor={cuando}
            onElegir={(v) => void programar(v === 'mano' ? null : { unidad: v, hora: ia.cron?.hora ?? 9 })} />
          {ia.cron && (
            <Dropdown value={String(ia.cron.hora)} ariaLabel="A qué hora" options={HORAS} search={false}
              onChange={(v) => void programar({ unidad: ia.cron!.unidad, hora: Number(v) })} />
          )}
        </div>
      )}
      <div className="lk-seccion">
        <Estilos />
        <div><Button size="sm" variant="primary" onClick={() => void generar()} loading={enviando === 'generar'} disabled={enviando != null || (enPopup && !contexto)}>Generar</Button></div>
        {aviso && <p className="lk-ayuda" role="alert" style={{ color: 'var(--bad)' }}>{aviso}</p>}
      </div>
    </>
  );
}
