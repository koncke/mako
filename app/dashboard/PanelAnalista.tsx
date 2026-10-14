'use client';

// =============================================================================
// PanelAnalista — «AI Analyst»: MaKo analiza los gráficos de la hoja (punto 23)
// =============================================================================
// Pedido de Martín (11/10/2026), textual: «agrega un botón en la topbar del editable que sea "AI
// Analyst", que justamente sea MaKo analizando ese o esos gráficos... Y que se pueda configurar CRON
// para que lo analice cada X tiempo, o cuando se le da a actualizar análisis».
//
// Dos piezas: `useAnalisisNuevo` (el punto de «hay un análisis nuevo sin ver»; desde la tanda de la
// topbar, 11/10/2026, el AI Analyst se abre desde el ⋮ de la topbar y el punto va ahí) y `PanelAnalista`
// (el panel del costado, SUPERPUESTO a la grilla desde v5: no la empuja). Acá viven también los botones de MaKo de la tab en su versión CHICA (sólo el
// logo sobre negro, punto 3 de esa tanda): `ChatMakoGrafico` y `LogoMako`. El trabajo lo hace el server
// (app/api/graficos/analisis → lib/graficos-analisis-server.ts): acá no se serializa nada para el
// modelo, a propósito. Lo único que se usa de `loQueSeVe` es la FIRMA de lo que se ve ahora, para
// decir si la hoja cambió desde el análisis.
//
// Lo que no se ve en el código:
//   · El análisis corre POR DETRÁS (sobrevive a cerrar el panel o la pestaña). La pantalla pregunta
//     el avance cada 2,5 s mientras dice «Revisando», y «Cancelar» corta la corrida: la que sigue por
//     detrás termina, pero ya no puede escribir su resultado.
//   · El número que se muestra al lado de cada hallazgo sale de la ENTRADA guardada, no del texto
//     del modelo (lib/graficos-analisis.ts, `sanearSalida`). Los nombres de personas que el modelo no
//     vio («Closer 1») se muestran con el nombre real: el reemplazo lo hace el código.
//   · Se dice SIEMPRE qué período se miró: el de a mano mira lo que la persona tenía elegido; el
//     programado, los valores guardados de la hoja.
//   · Sin avisos por WhatsApp: un aviso nuevo de MaKo es decisión de Martín. El aviso es el punto.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button, Mako, Spinner } from '@/app/_ui';
import { MakoLogo, MakoStar } from '@/app/_components/MakoBrand';
import { MakoChat } from '@/app/_components/MakoChat';
import { useCapaModal } from '@/app/_components/pila-modales';
import { useConectarIntegracion } from '@/app/_components/ConectarIntegracion';
import { BotonMako } from '@/app/_ui/BotonMako';
import { BotonCerrar, RADIO_CAJA } from '@/app/_ui/BotonBorrar';
import { Capa } from './piezas';
import { Dropdown } from '@/app/components/Dropdown';
import { esGrafico, tituloDe, type Hoja, type VistaValores } from '@/lib/graficos-catalogo';
import { fmtValor, type Resultado } from '@/lib/graficos-agregar';
import { DIA_MES_MAX, textoCron, type CronAviso } from '@/lib/cron-aviso';
import { plural } from '@/lib/plural';
import {
  cambiosDesde, conNombres, haceCuanto,
  type EntradaAnalisis, type Hallazgo, type Recomendacion, type VistaAnalisis,
} from '@/lib/graficos-analisis';

export type LoQueSeVe = { id: string; titulo: string; desde: string; hasta: string; resultado: Resultado };

const RUTA = '/api/graficos/analisis';
/** El panel avisa que se vio un análisis; el botón apaga su punto sin volver a preguntar. */
const EVENTO_VISTO = 'mako:analista-visto';
/** El panel se cierra con un análisis corriendo: el botón pregunta más seguido hasta que termine. */
const EVENTO_CORRIENDO = 'mako:analista-corriendo';

type Respuesta = { vista?: VistaAnalisis; tzNegocio?: string; iaDisponible?: boolean; mensajeIA?: string; estado?: string; mensaje?: string; error?: string; nuevos?: string[] };

async function pedir(body: Record<string, unknown>): Promise<Respuesta> {
  // El análisis NO corre en este pedido (va por detrás): 30 s alcanzan para tomarlo o guardar un horario.
  const r = await fetch(RUTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const j = (await r.json().catch(() => ({}))) as Respuesta;
  if (!r.ok) throw new Error(j.error || 'No pude completar el pedido');
  return j;
}
async function leer(hojaId: string, inicial: boolean): Promise<Respuesta> {
  const r = await fetch(`${RUTA}?hoja=${encodeURIComponent(hojaId)}${inicial ? '&inicial=1' : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  const j = (await r.json().catch(() => ({}))) as Respuesta;
  if (!r.ok) throw new Error(j.error || 'No pude leer el análisis');
  return j;
}
const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'No pude completar el pedido');

// ── El horario: Nunca / cada día / cada semana / cada mes, a una hora ───────────────────────

type Frecuencia = 'nunca' | 'dia' | 'semana' | 'mes';
type Horario = { frec: Frecuencia; diaSemana: number; diaMes: number; hora: number; minuto: number };
const FRECUENCIAS: Array<{ id: Frecuencia; nombre: string }> = [
  { id: 'nunca', nombre: 'Nunca' }, { id: 'dia', nombre: 'Cada día' }, { id: 'semana', nombre: 'Cada semana' }, { id: 'mes', nombre: 'Cada mes' },
];
/** La semana arranca el lunes, como el horario de Automations. La letra no identifica: el nombre va en el aria-label. */
const DIAS = [{ d: 1, ini: 'L', nombre: 'Lunes' }, { d: 2, ini: 'M', nombre: 'Martes' }, { d: 3, ini: 'M', nombre: 'Miércoles' }, { d: 4, ini: 'J', nombre: 'Jueves' }, { d: 5, ini: 'V', nombre: 'Viernes' }, { d: 6, ini: 'S', nombre: 'Sábado' }, { d: 0, ini: 'D', nombre: 'Domingo' }];
const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
/** Cada media hora, y la que está puesta aunque no caiga en la grilla (un `<select>` sin su valor lo borra). */
function horas(h: number, m: number) {
  const out = Array.from({ length: 48 }, (_, i) => { const v = hhmm(Math.floor(i / 2), (i % 2) * 30); return { value: v, label: v }; });
  if (!out.some((o) => o.value === hhmm(h, m))) out.push({ value: hhmm(h, m), label: hhmm(h, m) });
  return out.sort((a, b) => a.value.localeCompare(b.value));
}
function horarioDe(v: VistaAnalisis | null): Horario {
  const c = v?.programa?.cron;
  if (!c) return { frec: 'nunca', diaSemana: 1, diaMes: 1, hora: 9, minuto: 0 };
  return { frec: c.unidad === 'semana' || c.unidad === 'mes' ? c.unidad : 'dia', diaSemana: c.diaSemana ?? 1, diaMes: c.diaMes ?? 1, hora: c.hora, minuto: c.minuto };
}
function cronDe(h: Horario): CronAviso | null {
  if (h.frec === 'nunca') return null;
  return { unidad: h.frec, cada: 1, hora: h.hora, minuto: h.minuto, ...(h.frec === 'semana' ? { diaSemana: h.diaSemana } : {}), ...(h.frec === 'mes' ? { diaMes: h.diaMes } : {}) };
}
const claveHorario = (h: Horario) => JSON.stringify(cronDe(h));

function fechaEn(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch { return iso.slice(0, 16).replace('T', ' '); }
}
const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/** «hace 3 h» se mueve solo: se recalcula cada medio minuto. */
function useAhora(cadaMs: number): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), cadaMs); return () => clearInterval(i); }, [cadaMs]);
  return t;
}

// ── El panel ──────────────────────────────────────────────────────────────────────────────

export function PanelAnalista({ hoja, loQueSeVe, onCerrar, vista }: {
  hoja: Hoja;
  /** Lo que cada gráfico está mostrando AHORA (el resultado ya agregado): sólo para la firma. */
  loQueSeVe: LoQueSeVe[];
  onCerrar: () => void;
  /**
   * Lo que la persona eligió MIRANDO en los controles (no se guarda en el informe). Opcional: sin esto
   * el análisis a mano mira los valores guardados de la hoja, igual que el programado, y lo dice.
   */
  vista?: VistaValores;
}) {
  const [estado, setEstado] = useState<VistaAnalisis | null>(null);
  const [tz, setTz] = useState<string | null>(null);
  const [ia, setIa] = useState<{ ok: boolean; mensaje: string | null }>({ ok: true, mensaje: null });
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<null | 'analizar' | 'cancelar' | 'programar'>(null);
  const [modo, setModo] = useState<'todos' | 'elegir'>('todos');
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [horario, setHorario] = useState<Horario>(horarioDe(null));
  const [verFuentes, setVerFuentes] = useState(false);
  // La hoja cuyo estado ya sembró la selección y el horario: se siembra UNA vez, y después manda la persona.
  const sembrada = useRef<string | null>(null);
  const ahora = useAhora(30_000);
  // «Conectar una IA» abre el modal de Gemini AHÍ (regla del 14/10/2026: conectar una integración nunca saca de la tab).
  // Conectada, el panel vuelve a ofrecer «Analizar»: el próximo pedido es el que confirma si hay IA.
  const integracion = useConectarIntegracion({ onConectado: () => setIa({ ok: true, mensaje: null }) });

  const graficos = useMemo(() => hoja.componentes.filter(esGrafico), [hoja.componentes]);
  const tituloDeId = useCallback((id: string) => {
    const g = graficos.find((x) => x.id === id);
    return loQueSeVe.find((x) => x.id === id)?.titulo ?? (g ? tituloDe(g) : 'Un gráfico que ya no está');
  }, [graficos, loQueSeVe]);

  // Al abrir (o al cambiar de hoja): el estado, la zona del negocio y si hay IA.
  useEffect(() => {
    let vivo = true;
    setCargando(true); setAviso(null); setEstado(null); setVerFuentes(false);
    leer(hoja.id, true)
      .then((r) => {
        if (!vivo) return;
        setEstado(r.vista ?? null);
        setTz(r.tzNegocio ?? null);
        setIa({ ok: true, mensaje: null });
      })
      .catch((e) => { if (vivo) setAviso(mensaje(e)); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [hoja.id]);

  useEffect(() => {
    if (!estado || sembrada.current === hoja.id) return;
    sembrada.current = hoja.id;
    const c = estado.componentes;
    setModo(c?.length ? 'elegir' : 'todos');
    setElegidos(c ?? []);
    setHorario(horarioDe(estado));
  }, [estado, hoja.id]);

  // Mientras corre, se pregunta el avance. El análisis sigue aunque el panel se cierre: al cerrarlo
  // (o al cambiar de hoja) con uno corriendo, se le avisa al botón para que prenda el punto al terminar.
  const corriendo = !!estado?.corriendo;
  useEffect(() => {
    if (!corriendo) return;
    const t = setInterval(() => {
      leer(hoja.id, false).then((r) => { if (r.vista) setEstado(r.vista); }).catch((e) => console.warn(`[analista] avance: ${mensaje(e)}`));
    }, 2500);
    return () => {
      clearInterval(t);
      window.dispatchEvent(new CustomEvent(EVENTO_CORRIENDO, { detail: hoja.id }));
    };
  }, [corriendo, hoja.id]);

  // Lo que se pinta, se vio: apaga el punto del botón.
  const analizadoAt = estado?.ultimo?.analizadoAt ?? null;
  const esNuevo = !!estado?.nuevo;
  useEffect(() => {
    if (!analizadoAt || !esNuevo) return;
    pedir({ accion: 'visto', hojaId: hoja.id, analizadoAt })
      .then(() => {
        setEstado((e) => (e ? { ...e, nuevo: false } : e));
        window.dispatchEvent(new CustomEvent(EVENTO_VISTO, { detail: hoja.id }));
      })
      .catch((e) => console.warn(`[analista] visto: ${mensaje(e)}`));
  }, [analizadoAt, esNuevo, hoja.id]);

  const ids = modo === 'elegir' ? elegidos.filter((id) => graficos.some((g) => g.id === id)) : null;

  const analizar = useCallback(async () => {
    if (ids && !ids.length) { setAviso('Elige al menos un gráfico.'); return; }
    setEnviando('analizar'); setAviso(null);
    try {
      const r = await pedir({ accion: 'analizar', hoja, ids, vista: vista ?? {} });
      if (r.estado === 'sin_ia') { setIa({ ok: false, mensaje: r.mensaje ?? null }); return; }
      if (r.vista) setEstado(r.vista);
    } catch (e) { setAviso(mensaje(e)); } finally { setEnviando(null); }
  }, [hoja, ids, vista]);

  const cancelar = useCallback(async () => {
    setEnviando('cancelar'); setAviso(null);
    try {
      await pedir({ accion: 'cancelar', hojaId: hoja.id });
      const r = await leer(hoja.id, false);
      if (r.vista) setEstado(r.vista);
    } catch (e) { setAviso(mensaje(e)); } finally { setEnviando(null); }
  }, [hoja.id]);

  const guardarHorario = useCallback(async () => {
    if (ids && !ids.length) { setAviso('Elige al menos un gráfico.'); return; }
    setEnviando('programar'); setAviso(null);
    try {
      const r = await pedir({ accion: 'programar', hojaId: hoja.id, cron: cronDe(horario), componentes: ids });
      if (r.vista) { setEstado(r.vista); setHorario(horarioDe(r.vista)); }
    } catch (e) { setAviso(mensaje(e)); } finally { setEnviando(null); }
  }, [hoja.id, horario, ids]);

  const ultimo = estado?.ultimo ?? null;
  const cambios = useMemo(() => {
    if (!ultimo) return null;
    const c = cambiosDesde(ultimo.entrada, loQueSeVe);
    // «Ya no está» se mide contra la HOJA, no contra `loQueSeVe`: un gráfico que todavía carga (o que no
    // se pudo leer) no viene ahí, y no por eso se borró.
    return { ...c, faltan: c.faltan.filter((id) => !graficos.some((g) => g.id === id)) };
  }, [ultimo, loQueSeVe, graficos]);
  const nombres = ultimo?.entrada.nombres ?? {};
  const horarioCambio = claveHorario(horario) !== claveHorario(horarioDe(estado));
  const tzHorario = estado?.programa?.tz ?? tz;
  const cuantos = ids ? ids.length : graficos.length;

  return (
    // Escape cierra SÓLO con el foco adentro del panel: no es un modal, y la grilla de al lado tiene sus
    // propios Escape. Un desplegable abierto adentro se come el suyo antes (Dropdown corta en captura).
    <aside className="an" aria-label="AI Analyst" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } }}>
      <style>{CSS}</style>
      <div className="an-cab">
        <MakoStar size={16} animate={corriendo} />
        <span className="an-tit">AI Analyst</span>
        <button type="button" className="an-x" onClick={onCerrar} aria-label="Cerrar" title="Cerrar">×</button>
      </div>

      {/* ── El análisis ── */}
      <section className="an-sec">
        {/* Un «Cargando…» escrito no es un loader (AGENTS.md): va el giro. */}
        {cargando && <span className="an-meta"><Spinner size={16} color="var(--dim)" /></span>}
        {!cargando && aviso && <p className="an-err" role="alert">{aviso}</p>}

        {!cargando && !ia.ok && !corriendo && (
          <Mako estado="sin_conclusion" titulo="Falta conectar una IA" consecuencia={ia.mensaje ?? 'Sin IA conectada no puedo analizar la hoja.'}
            datos={[{ k: 'Qué falta', v: 'Una IA gratis (con Gemini alcanza)' }]} accion={{ label: 'Conectar una IA', onClick: () => integracion.abrir('gemini') }} />
        )}
        {integracion.modal}

        {estado?.corriendo && (
          <>
            <Mako estado="analizando" titulo={`${plural(cuantos, 'gráfico')} de ${hoja.nombre}`}
              fuente={estado.corriendo.fase === 'escribiendo' ? 'Escribiendo el análisis' : 'Leyendo los datos'}
              progreso={estado.corriendo.fase === 'escribiendo' ? 0.6 : 0.2}
              pasos={['Leer los gráficos', 'Escribir el análisis']} />
            <div><Button size="sm" variant="secondary" onClick={cancelar} loading={enviando === 'cancelar'}>Cancelar</Button></div>
          </>
        )}

        {/* Sin IA, el fallo del programado dice lo mismo que la tarjeta de arriba: una sola vez. */}
        {!corriendo && estado?.fallo && (ia.ok || estado.fallo.error !== ia.mensaje) && (
          <Mako estado="sin_conclusion" titulo="No pude analizar la hoja" consecuencia={estado.fallo.error}
            datos={[{ k: 'Cuándo', v: estado.fallo.cuando ? haceCuanto(estado.fallo.cuando, ahora) : '—' }]}
            accion={{ label: 'Probar de nuevo', onClick: () => { void analizar(); } }} />
        )}

        {!cargando && !ultimo && !corriendo && !estado?.fallo && ia.ok && !aviso && (
          <p className="an-meta">Todavía no hay un análisis de esta hoja.</p>
        )}

        {ultimo && (
          <div className="an-ult">
            <p className="an-meta">
              {haceCuanto(ultimo.analizadoAt, ahora)} · {ultimo.entrada.origen === 'cron' ? 'programado' : 'a mano'} · {resumenFuentes(ultimo.entrada)}
              {' · '}<button type="button" className="an-link" onClick={() => setVerFuentes((v) => !v)} aria-expanded={verFuentes}>{verFuentes ? 'Ocultar' : 'Ver cuáles'}</button>
            </p>
            <p className="an-meta">{periodoDe(ultimo.entrada.rangos)} · {ultimo.entrada.conVista ? 'lo que tenías elegido' : 'los valores guardados'}</p>
            {verFuentes && <ListaFuentes entrada={ultimo.entrada} />}
            {cambios && cambios.datos.length > 0 && <p className="an-cambio">La hoja cambió desde este análisis.</p>}
            {cambios && !cambios.datos.length && cambios.periodo.length > 0 && <p className="an-meta">Miró otro período que el que ves ahora.</p>}
            {cambios && cambios.faltan.length > 0 && <p className="an-meta">{plural(cambios.faltan.length, 'gráfico')} ya no {cambios.faltan.length === 1 ? 'está' : 'están'} en la hoja.</p>}

            {ultimo.salida.resumen && <p className="an-res">{conNombres(ultimo.salida.resumen, nombres)}</p>}

            <h3 className="an-h">Hallazgos</h3>
            <div className="an-lista">
              {ultimo.salida.hallazgos.map((h, i) => <FilaHallazgo key={i} h={h} nombres={nombres} />)}
            </div>

            {ultimo.salida.recomendaciones.length > 0 && (
              <>
                <h3 className="an-h">Qué hacer</h3>
                <div className="an-lista">
                  {ultimo.salida.recomendaciones.map((r, i) => <FilaRecomendacion key={i} r={r} nombres={nombres} titulo={tituloDeId} />)}
                </div>
              </>
            )}
            {ultimo.salida.descartes.length > 0 && (
              <p className="an-meta an-tenue" title={ultimo.salida.descartes.join(' ')}>
                {plural(ultimo.salida.descartes.length, 'punto descartado', 'puntos descartados')}: no se apoyaban en los datos.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Qué gráficos, y el botón ── */}
      <section className="an-sec">
        <h3 className="an-h">Qué gráficos</h3>
        <div className="an-chips" role="group" aria-label="Qué gráficos analizar">
          <button type="button" className="an-chip" aria-pressed={modo === 'todos'} onClick={() => setModo('todos')}>Todos</button>
          <button type="button" className="an-chip" aria-pressed={modo === 'elegir'} onClick={() => setModo('elegir')}>Elegir</button>
        </div>
        {modo === 'elegir' && (
          <div className="an-checks">
            {graficos.length === 0 && <p className="an-meta">Esta hoja no tiene gráficos.</p>}
            {graficos.map((g) => (
              <label key={g.id} className="an-check">
                <input type="checkbox" checked={elegidos.includes(g.id)} style={{ accentColor: 'var(--primary)' }}
                  onChange={(e) => setElegidos((xs) => (e.target.checked ? [...xs, g.id] : xs.filter((x) => x !== g.id)))} />
                <span>{tituloDeId(g.id)}</span>
              </label>
            ))}
          </div>
        )}
        <div>
          <Button size="sm" variant="primary" onClick={analizar} loading={enviando === 'analizar'} disabled={corriendo || !ia.ok || cargando || !graficos.length}>
            {ultimo ? 'Actualizar análisis' : 'Analizar la hoja'}
          </Button>
        </div>
      </section>

      {/* ── Programar ── */}
      <section className="an-sec">
        <h3 className="an-h">Programar</h3>
        {estado?.programa && (
          <Mako estado="vigila" titulo={textoCron(estado.programa.cron, estado.programa.tz)}
            datos={[
              { k: 'Próxima', v: estado.programa.proximaAt ? fechaEn(estado.programa.proximaAt, estado.programa.tz) : '—' },
              // «En seguimiento» exige la última revisión (lib/mako-gramatica.ts): la del último análisis,
              // a mano o programado, que es lo que la persona tiene a la vista arriba.
              { k: 'Último', v: ultimo ? haceCuanto(ultimo.analizadoAt, ahora) : 'Todavía no' },
              { k: 'Qué mira', v: 'Los valores guardados de la hoja' },
              { k: 'Qué analiza', v: estado.componentes?.length ? plural(estado.componentes.length, 'gráfico') : 'Toda la hoja' },
            ]} />
        )}
        <div className="an-chips" role="group" aria-label="Cada cuánto">
          {FRECUENCIAS.map((f) => (
            <button key={f.id} type="button" className="an-chip" aria-pressed={horario.frec === f.id} onClick={() => setHorario((h) => ({ ...h, frec: f.id }))}>{f.nombre}</button>
          ))}
        </div>
        {horario.frec === 'semana' && (
          <div className="an-dias" role="group" aria-label="Qué día">
            {DIAS.map((x) => (
              <button key={x.d} type="button" className="an-dia" aria-pressed={horario.diaSemana === x.d} aria-label={x.nombre} title={x.nombre}
                onClick={() => setHorario((h) => ({ ...h, diaSemana: x.d }))}>{x.ini}</button>
            ))}
          </div>
        )}
        {horario.frec !== 'nunca' && (
          <div className="an-fila">
            {horario.frec === 'mes' && (
              <>
                <span className="an-meta">El día</span>
                <Dropdown value={String(horario.diaMes)} ariaLabel="Día del mes" buttonStyle={CAMPO}
                  options={Array.from({ length: DIA_MES_MAX }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                  onChange={(v) => setHorario((h) => ({ ...h, diaMes: Number(v) }))} />
              </>
            )}
            <span className="an-meta">A las</span>
            <Dropdown value={hhmm(horario.hora, horario.minuto)} ariaLabel="A qué hora" buttonStyle={CAMPO} search
              options={horas(horario.hora, horario.minuto)}
              onChange={(v) => { const [h, m] = v.split(':').map(Number); setHorario((x) => ({ ...x, hora: h, minuto: m })); }} />
          </div>
        )}
        {horario.frec !== 'nunca' && tzHorario && <p className="an-meta an-tenue">Hora de {tzHorario}.</p>}
        {horarioCambio && (
          <div>
            <Button size="sm" variant="secondary" onClick={guardarHorario} loading={enviando === 'programar'}>
              {horario.frec === 'nunca' ? 'Sacar el horario' : 'Guardar horario'}
            </Button>
          </div>
        )}
      </section>
    </aside>
  );
}

function FilaHallazgo({ h, nombres }: { h: Hallazgo; nombres: Record<string, string> }) {
  const c = h.cita;
  return (
    <Mako estado="explica" titulo={conNombres(h.titulo, nombres)} detalle={conNombres(h.texto, nombres)}
      evidencia={<>
        <strong>{c.nombre}{c.fila ? ` · ${conNombres(c.fila, nombres)}` : ' · total'}: {fmtValor(c.valor, c.formato)}</strong>
        <br />{c.titulo}
      </>} />
  );
}

function FilaRecomendacion({ r, nombres, titulo }: { r: Recomendacion; nombres: Record<string, string>; titulo: (id: string) => string }) {
  // Sin responsable ni objetivo no es una «Sugerencia» (mako-gramatica: `recomienda` exige los cinco
  // campos): se muestra como lo que es, una explicación con la acción adelante.
  const datos = [
    ...(r.impacto ? [{ k: 'Impacto', v: r.impacto }] : []),
    ...(r.esfuerzo ? [{ k: 'Esfuerzo', v: r.esfuerzo }] : []),
  ];
  return (
    <Mako estado="explica" titulo={conNombres(r.accion, nombres)} detalle={conNombres(r.porque, nombres)}
      datos={datos.length ? datos : undefined}
      evidencia={<>Sale de: {r.graficos.map(titulo).join(', ')}</>} />
  );
}

/** «8 gráficos · 1 sin leer». Lo que no entró por el tope o no se incluye también se cuenta. */
function resumenFuentes(e: EntradaAnalisis): string {
  const errores = e.graficos.filter((g) => 'error' in g).length;
  const partes = [plural(e.graficos.length, 'gráfico')];
  if (errores) partes.push(`${errores} sin leer`);
  if (e.fuera_por_tope.length) partes.push(`${e.fuera_por_tope.length} fuera por tamaño`);
  return partes.join(' · ');
}

function ListaFuentes({ entrada }: { entrada: EntradaAnalisis }) {
  return (
    <ul className="an-fuentes">
      {entrada.graficos.map((g) => (
        <li key={g.id}>{g.titulo}{'error' in g ? <span className="an-tenue"> · no se pudo leer</span> : null}</li>
      ))}
      {entrada.fuera_por_tope.map((t) => <li key={`t${t}`}>{t}<span className="an-tenue"> · no entró</span></li>)}
      {entrada.no_incluidos.map((x) => <li key={`n${x.titulo}`}>{x.titulo}<span className="an-tenue"> · no se analiza</span></li>)}
    </ul>
  );
}

function periodoDe(rangos: Record<string, { desde: string; hasta: string }>): string {
  const rs = Object.values(rangos);
  if (!rs.length) return 'Sin período';
  const iguales = rs.every((r) => r.desde === rs[0].desde && r.hasta === rs[0].hasta);
  return iguales ? `Del ${ddmm(rs[0].desde)} al ${ddmm(rs[0].hasta)}` : 'Períodos distintos por gráfico';
}

// ── «Hay un análisis nuevo», y los botones de MaKo de la tab ──────────────────────────────────

/**
 * ¿Hay un análisis de ESTA hoja que la persona todavía no vio? (uno programado que terminó, o uno a mano
 * que terminó con el panel cerrado). Desde la tanda de la topbar (11/10/2026, punto 4) el AI Analyst vive
 * en el ⋮ de la topbar y no tiene botón propio: el punto se dibuja en el ⋮ y en su opción
 * (./EditorInforme.tsx). Con `activo` en false no pregunta nada: el closer y un informe compartido no
 * tienen AI Analyst, y /api/graficos/analisis es sólo del admin.
 */
export function useAnalisisNuevo(hojaId: string, abierto: boolean, activo: boolean): boolean {
  const [nuevos, setNuevos] = useState<string[]>([]);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    let vigilando: ReturnType<typeof setInterval> | null = null;
    const cargar = () => {
      fetch(RUTA, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
        .then((r) => (r.ok ? (r.json() as Promise<Respuesta>) : null))
        .then((j) => { if (vivo && j && Array.isArray(j.nuevos)) setNuevos(j.nuevos); })
        .catch(() => { /* sin el punto no se rompe nada: el panel igual muestra el análisis */ });
    };
    cargar();
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(); };
    const alVer = (e: Event) => { const id = (e as CustomEvent<string>).detail; setNuevos((xs) => xs.filter((x) => x !== id)); };
    // Un análisis a mano que sigue por detrás: cada 8 s durante unos minutos, hasta que el punto se prenda.
    const alCorrer = () => {
      if (vigilando) clearInterval(vigilando);
      let vueltas = 0;
      vigilando = setInterval(() => { vueltas++; cargar(); if (vueltas >= 45 && vigilando) { clearInterval(vigilando); vigilando = null; } }, 8000);
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener(EVENTO_VISTO, alVer);
    window.addEventListener(EVENTO_CORRIENDO, alCorrer);
    // Un programado puede terminar con la pantalla abierta: se vuelve a preguntar cada 5 min.
    const t = setInterval(cargar, 5 * 60_000);
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener(EVENTO_VISTO, alVer);
      window.removeEventListener(EVENTO_CORRIENDO, alCorrer);
      clearInterval(t);
      if (vigilando) clearInterval(vigilando);
    };
  }, [activo]);
  return activo && !abierto && nuevos.includes(hojaId);
}

/**
 * El punto dorado de «hay un análisis nuevo», en lo que lo lleva (que va `position: relative`): arriba a
 * la derecha de un botón, o al final del renglón de una opción de menú (`enMenu`).
 */
export function PuntoNuevo({ enMenu = false }: { enMenu?: boolean }) {
  return <span aria-hidden style={enMenu ? { ...PUNTO, top: '50%', right: 14, transform: 'translateY(-50%)' } : PUNTO} />;
}

/**
 * El logo de MaKo para una OPCIÓN de menú (el AI Analyst en el ⋮): el mismo cuadrado negro con la estrella
 * dorada que `BotonMako` (app/_ui/BotonMako.tsx), pero como dibujo: un botón no va adentro de otro.
 */
export function LogoMako({ lado = 22 }: { lado?: number }) {
  return (
    <span aria-hidden style={{ ...CUADRO_MAKO, width: lado, height: lado }}>
      <MakoStar size={Math.round(lado * 0.5)} animate={false} />
    </span>
  );
}

/**
 * El chat de MaKo de un gráfico (el de las tabs viejas), con el botón CHICO: sólo el logo sobre negro
 * (`BotonMako`), sin texto — punto 3 de la tanda de la topbar: «Los botones de MaKo deben ser más pequeños
 * y sutiles, solo el logo con el fondo negro, nada más». Lo que hace va en el `title` y el `aria-label`.
 *
 * ⚠️ Es una VARIANTE LOCAL, no un cambio a `MakoButton` (app/_components/ChartIA.tsx): ése lo usan el Ads
 *    Manager y Marketing, que no pidieron nada. El modal es el mismo: el chat con el gráfico aislado.
 * ⚠️ La capa va por PORTAL (`Capa`, ./piezas.tsx): la tarjeta recorta (`overflow: hidden`) y un
 *    portal de React sigue burbujeando hasta la tarjeta (un clic la seleccionaría y un mousedown la
 *    arrastraría): `Capa` frena los eventos y lleva la clase de no arrastrar.
 */
export function ChatMakoGrafico({ chartKey, titulo, contexto, sugerencias }: { chartKey: string; titulo: string; contexto: string; sugerencias?: string[] }) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  return (
    <>
      <BotonMako lado={26} title="Conclusiones con MaKo" encendido={abierto} onClick={() => setAbierto(true)} />
      {abierto && <Capa><CapaChatMako chartKey={chartKey} titulo={titulo} contexto={contexto} sugerencias={sugerencias} onCerrar={cerrar} /></Capa>}
    </>
  );
}

/**
 * El chat de MaKo de un gráfico abierto DESDE AFUERA del botón (el clic derecho, «Preguntarle a MaKo»): el mismo modal,
 * con quien lo abre dueño de cuándo se cierra.
 */
export function ChatMakoAbierto(p: { chartKey: string; titulo: string; contexto: string; sugerencias?: string[]; onCerrar: () => void }) {
  return <Capa><CapaChatMako {...p} /></Capa>;
}

/** El modal del chat: en la pila de capas (su z y su Escape, que frena a los demás). */
function CapaChatMako({ chartKey, titulo, contexto, sugerencias, onCerrar }: { chartKey: string; titulo: string; contexto: string; sugerencias?: string[]; onCerrar: () => void }) {
  const capa = useCapaModal(true);
  const esArriba = capa.esElDeArriba;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esArriba()) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      onCerrar();
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [esArriba, onCerrar]);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Conclusiones con MaKo: ${titulo}`} onClick={onCerrar}
      style={{ ...FONDO_CHAT, zIndex: capa.z, display: capa.visible ? 'flex' : 'none' }}>
      <div onClick={(e) => e.stopPropagation()} style={CAJA_CHAT}>
        <div style={CAB_CHAT}>
          <MakoLogo size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}>Conclusiones con MaKo</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</div>
          </div>
          <BotonCerrar onClick={onCerrar} />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <MakoChat chartKey={chartKey} titulo={titulo} contexto={contexto} sugerencias={sugerencias?.length ? sugerencias : undefined} sidebar />
        </div>
      </div>
    </div>
  );
}

const PUNTO: CSSProperties = {
  position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%',
  background: 'var(--mako)', border: '2px solid var(--surface)', boxSizing: 'border-box',
};
// El negro del logo (el de `BotonMako` y `MakoLogo`): no es un token porque no se da vuelta en oscuro.
const CUADRO_MAKO: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxSizing: 'border-box',
  borderRadius: RADIO_CAJA, border: '1px solid rgba(201,162,74,.45)', background: 'linear-gradient(135deg, #2A251C, #171511)',
};
const FONDO_CHAT: CSSProperties = {
  position: 'fixed', inset: 0, alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto',
  background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', fontFamily: "'Geist', system-ui, sans-serif",
};
const CAJA_CHAT: CSSProperties = {
  width: '100%', maxWidth: 940, height: 'calc(100dvh - 80px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)',
};
const CAB_CHAT: CSSProperties = { flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' };
const CAMPO: CSSProperties = { height: 32, padding: '0 10px', borderRadius: 8, gap: 6, fontSize: 13 };

// ⚠️ SUPERPUESTO, COMO EL PANEL DE PROPIEDADES (tanda v5, punto 19: «que no empuje el lienzo»). Hasta v4 era una
// COLUMNA de la fila del lienzo (`.lk-cuerpo`, un flex en fila): al abrirlo, el lienzo perdía 360 px, la grilla
// recibía otro `width` y TODAS las tarjetas se re-maquetaban (los gráficos que el análisis comenta cambiaban de
// tamaño al abrirlo). Ahora flota arriba de la grilla, pegado a la derecha y con su sombra: tapa sus últimos 360 px
// y la grilla no se entera. Antes de v4 había sido `fixed` (montado al final de `.lk-app`, una COLUMNA): eso tapaba
// también la topbar. `absolute` contra `.lk-cuerpo` (que tiene que ir `position: relative`: lo pone P5 para el panel
// de propiedades) lo deja entre la barra de edición y el borde de abajo, quieto mientras la grilla scrollea (no va
// adentro de `.lk-lienzo`, que es lo que scrollea).
//   · z 21: arriba de una tarjeta que se arrastra (react-grid-layout le pone 3) y del panel de propiedades (20), y
//     debajo de los menús del editor (580) y de los modales (130, la pila): el detalle de un gráfico se abre encima.
//   · `flex: none` queda: no hace nada en un `absolute`, y es lo que mira tests/dashboard-pantalla.test.ts.
//   · En el celular (≤ 760 px) va encima a pantalla completa, fixed: al lado no entra.
//   · al imprimir no sale: `.lk-app *` se fuerza visible para el PDF, y el panel no es parte del informe.
const CSS = `
.an { flex: none; position: absolute; top: 12px; right: 12px; bottom: 12px; z-index: 21; width: 360px; max-width: calc(100% - 24px);
  box-sizing: border-box; overflow-y: auto; display: flex; flex-direction: column;
  background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: 14px;
  box-shadow: 0 18px 44px rgba(18,21,27,.18); font-family: 'Geist', system-ui, sans-serif; }
@media print { .an { display: none !important; } }
.an-cab { display: flex; align-items: center; gap: 8px; padding: 12px 10px 10px 16px; border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 1; background: var(--surface); }
.an-tit { flex: 1; font-size: 15px; font-weight: 600; }
.an-x { width: 30px; height: 30px; border: none; border-radius: 8px; background: transparent; color: var(--dim); font-size: 20px; line-height: 1; cursor: pointer; }
.an-x:hover { background: var(--surface-2); color: var(--ink); }
.an-sec { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.an-ult { display: flex; flex-direction: column; gap: 8px; }
.an-h { margin: 6px 0 0; font-size: 12.5px; font-weight: 600; color: var(--dim); }
.an-meta { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--dim); }
.an-tenue { color: var(--faint); }
.an-err { margin: 0; font-size: 12.5px; color: var(--bad); }
.an-cambio { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--warn); }
.an-res { margin: 2px 0 0; font-size: 14px; line-height: 1.5; color: var(--ink); }
.an-lista { display: flex; flex-direction: column; }
.an-link { border: none; background: none; padding: 0; font: inherit; color: var(--primary); cursor: pointer; }
.an-link:hover { text-decoration: underline; }
.an-fuentes { margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.6; color: var(--ink); }
.an-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.an-chip { height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink);
  font: inherit; font-size: 13px; cursor: pointer; }
.an-chip:hover { background: var(--surface-2); }
.an-chip[aria-pressed="true"] { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.an-dias { display: flex; flex-wrap: wrap; gap: 6px; }
.an-dia { width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid var(--border-strong); background: var(--surface); color: var(--dim);
  font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.an-dia:hover { border-color: var(--primary); }
.an-dia[aria-pressed="true"] { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.an-fila { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.an-checks { display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; }
.an-check { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 1.35; color: var(--ink); cursor: pointer; }
@media (max-width: 760px) { .an { position: fixed; top: var(--barra-agencia, 0px); right: 0; bottom: 0; z-index: 56; width: 100%; max-width: 100vw; border: none; border-radius: 0; box-shadow: none; } }
`;
