'use client';
// =============================================================================
// EL CHAT «RETO DE 7 DÍAS» DEL OPS CENTER (18/11/2026)
// =============================================================================
// Martín, 18/11: «el chat "Onboarding" queda sólo para el onboarding. Se abre OTRO chat, "Reto de 7 días", y ahí van los
// comunicados de cada día, el desplegable del reto y los videos tutoriales». Sólo para quien ve el onboarding V2
// (lib/onboarding-v2/revision.ts). Lo que es cada día vive en lib/reto/dias.ts; lo hecho, en /api/reto.
//
//   · Arriba, en la cabecera: el desplegable del reto (qué es, cuántos días van, los 7 con su estado en palabras y el de hoy abierto
//     con su video y su lista). «Mejora significativamente… que se entienda fácil».
//   · En el chat, cada día abierto: el mensaje de MaKo, su video (el del manifiesto, o su lugar marcado en la revisión), lo que te
//     toca (cada tarea dice DÓNDE: sin botones de atajo) y su prueba por WhatsApp, con la persona escribiendo primero.
//   · Lo que falta se marca con el motor de los tutoriales: la pantalla se oscurece y se señala dónde tocar (`senalarDondeTocar`).
// =============================================================================
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { FilaDelChat } from '@/app/admin/operaciones/Hilo';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { linkWaMe } from '@/lib/verificacion-entrante';
import { PARA_TODOS } from '@/lib/onboarding-v2/revision';
import {
  DIAS_RETO, HORAS_WA, RETO_HOLA, RETO_SUB, RETO_TITULO, mensajeEscrito, proximaTarea, tareaHecha,
  type DiaReto, type EstadoDia, type EstadoReto, type MarcaReto, type TareaReto,
} from '@/lib/reto/dias';
import { mostrarTutorial, senalAhora, senalarDondeTocar } from '@/app/_ui/tutorial/store';
import { useVideoTutorial } from '@/app/_ui/tutorial/useVideoTutorial';
import { useVideoQueFlota } from '@/app/_ui/tutorial/useVideoQueFlota';
import { guardarRetoDelEnsayo, retoDelEnsayo, useEnsayo } from '@/app/_ui/tutorial/desde-cero';
import { claveTarea, diaAbierto, estadoDeLosDias, tutorialDelDia } from '@/lib/reto/dias';

type DatosReto = { ve: boolean; estado: EstadoReto | null; abierto: number; dias: EstadoDia[]; hechos: number; linea: string | null };

/** Lo del ensayo «desde cero» (app/_ui/tutorial/desde-cero.ts): el mismo cálculo que /api/reto, con el estado en el navegador. */
function datosDelEnsayo(base: DatosReto | null, e: EstadoReto | null): DatosReto {
  const { abierto, dias, hechos } = estadoDeLosDias(e, Date.now());
  return { ve: true, linea: base?.linea ?? null, estado: e, abierto, dias, hechos };
}
function hacerEnEnsayo(e: EstadoReto | null, c: { accion?: unknown; dia?: unknown; id?: unknown; hora?: unknown }): EstadoReto | null {
  const ahora = Date.now();
  if (c.accion === 'empezar') return e ?? { v: 1, inicio: new Date(ahora).toISOString(), adelantado: 1, hechas: {} };
  if (!e) return e;
  if (c.accion === 'adelantar' && Number(c.dia) === diaAbierto(e, ahora) + 1) return { ...e, adelantado: Number(c.dia) };
  if (c.accion === 'hecha') return { ...e, hechas: { ...e.hechas, [claveTarea(Number(c.dia), String(c.id))]: new Date(ahora).toISOString() } };
  if (c.accion === 'hora' && (HORAS_WA as readonly string[]).includes(String(c.hora))) return { ...e, horaWa: String(c.hora) };
  return e;
}

/** El reto del negocio, de /api/reto (en el ensayo «desde cero», del navegador: no se escribe nada). */
export function useReto(activo = true) {
  const ensayo = useEnsayo();
  const [d, setD] = useState<DatosReto | null>(null);
  const leer = useCallback(async () => {
    const r = await fetch('/api/reto', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
    if (!r || !r.ok) return;
    setD(ensayo.activo && r.ve ? datosDelEnsayo(r as DatosReto, retoDelEnsayo()) : (r as DatosReto));
  }, [ensayo.activo]);
  useEffect(() => { if (activo) void leer(); }, [activo, leer]);
  const hacer = useCallback(async (cuerpo: Record<string, unknown>) => {
    if (ensayo.activo) {
      const e = hacerEnEnsayo(retoDelEnsayo(), cuerpo);
      guardarRetoDelEnsayo(e);
      setD((prev) => datosDelEnsayo(prev, e));
      return { ok: true };
    }
    const r = await fetch('/api/reto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) }).then((x) => x.json()).catch(() => null);
    if (r && r.ok) setD(r as DatosReto);
    return r;
  }, [ensayo.activo]);
  return { d, leer, hacer };
}

/** Marca uno por uno los lugares de una tarea (la barra, el menú de la foto, la sección) y la da por hecha al tocar el último. */
export function marcarTarea(marcas: readonly MarcaReto[], alTerminar: () => void, alDejar?: () => void): void {
  const [m, ...resto] = marcas;
  if (!m) { alTerminar(); return; }
  senalarDondeTocar({ sel: m.sel, titulo: m.titulo, texto: m.texto, haz: m.haz, lado: m.lado },
    () => (resto.length ? window.setTimeout(() => marcarTarea(resto, alTerminar, alDejar), 350) : alTerminar()),
    { alOmitir: alDejar, libre: m.libre });
}

const YA_MARCADA = 'mako.reto.marcada.';
// Exportadas para el paso de Offer Coach a Funnel Coach (./usePasoAlFunnel.ts): la misma tarea se marca una vez por visita, la
// marque este chat o el Offer Coach.
export const yaMarcada = (k: string) => { try { return !!sessionStorage.getItem(YA_MARCADA + k); } catch { return false; } };
export const anotarMarcada = (k: string) => { try { sessionStorage.setItem(YA_MARCADA + k, '1'); } catch { /* sin storage */ } };

export function ChatDelReto({ nombre, onVolver }: { nombre: string; onVolver: () => void }) {
  const { d, hacer } = useReto();
  const hilo = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [manana, setManana] = useState<number | null>(null);
  const [hora, setHora] = useState<string | null>(null);

  // Al abrirlo por primera vez, el reto empieza (el día 1, ahora).
  const empezo = useRef(false);
  useEffect(() => {
    if (!d || !d.ve || d.estado || empezo.current) return;
    empezo.current = true;
    void hacer({ accion: 'empezar' });
  }, [d, hacer]);

  // Lo que falta, marcado: una vez por visita y por tarea (con «Lo hago después» no vuelve hasta la próxima).
  const e = d?.estado ?? null;
  const proxima = e ? proximaTarea(e, Date.now()) : null;
  const claveProxima = proxima ? `${proxima.dia.n}:${proxima.tarea.id}` : null;
  useEffect(() => {
    if (!proxima || !claveProxima || yaMarcada(claveProxima)) return;
    const t = window.setTimeout(() => {
      if (senalAhora()) return;
      anotarMarcada(claveProxima);
      marcarTarea(proxima.tarea.marcas, () => { void hacer({ accion: 'hecha', dia: proxima.dia.n, id: proxima.tarea.id }); }, () => {});
    }, 900);
    return () => window.clearTimeout(t);
  }, [claveProxima]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [d?.abierto, d?.hechos, manana]);

  const abiertos = d && e ? DIAS_RETO.filter((x) => x.n <= d.abierto) : [];
  const horaWa = hora ?? e?.horaWa ?? '9:00';
  return (
    <PanelDeChat hilo={hilo}
      cabecera={{ clave: 'reto-7-dias', titulo: RETO_TITULO, aspecto: ASPECTO_MAKO, animo: 'despierto', onVolver,
        acciones: d && e ? <DesplegableReto d={d} abierto={menu} onAbrir={setMenu} /> : undefined }}
      caja={<p className="rt-caja">Cada día te escribo aquí, con su video. Para preguntarle algo a MaKo, el Ops Center.</p>}
      estado="">
      <style>{CSS_RETO}</style>
      <div className="co-hilo__col" data-recorrido="sb-reto-hilo">
        {!d ? <p className="co-vacio">Cargando tu reto…</p> : !e ? <p className="co-vacio">Empezando tu reto…</p> : (
          <>
            <Burbuja><p>{RETO_HOLA(nombre)}</p></Burbuja>
            {abiertos.map((dia) => (
              <Dia key={dia.n} dia={dia} e={e} linea={d.linea} hora={horaWa}
                onHora={(h) => { setHora(h); void hacer({ accion: 'hora', hora: h }); }}
                onMarcar={(t) => marcarTarea(t.marcas, () => { void hacer({ accion: 'hecha', dia: dia.n, id: t.id }); }, () => {})} />
            ))}
            {d.abierto < 7 && (
              <Burbuja>
                {manana === d.abierto + 1
                  ? <p>Perfecto: mañana a las {horaWa} te escribo con el día {d.abierto + 1}.</p>
                  : <>
                      <p>{d.dias[d.abierto - 1] === 'hecho' ? `¡Listo tu día ${d.abierto}!` : `Tu día ${d.abierto} sigue abierto.`} ¿Adelantas el día {d.abierto + 1}: {DIAS_RETO[d.abierto].titulo.toLowerCase()}?</p>
                      <div className="rt-opciones">
                        <button type="button" className="co-chip co-chip--primario" onClick={() => void hacer({ accion: 'adelantar', dia: d.abierto + 1 })}>Adelantar al día {d.abierto + 1}</button>
                        <button type="button" className="co-chip" onClick={() => setManana(d.abierto + 1)}>Mañana</button>
                      </div>
                    </>}
              </Burbuja>
            )}
            {d.abierto === 7 && d.hechos === 7 && <Burbuja><p>¡Terminaste tu reto de 7 días, {nombre || 'genial'}! Tu negocio ya está armado en MaKo.</p></Burbuja>}
          </>
        )}
      </div>
    </PanelDeChat>
  );
}

function Burbuja({ children, ancho = false }: { children: ReactNode; ancho?: boolean }) {
  return <FilaDelChat m={null} quien={{ titulo: 'MaKo', aspecto: ASPECTO_MAKO }} marcas={null} hora={null} ancho={ancho}><div className="rt-md">{children}</div></FilaDelChat>;
}

function Dia({ dia, e, linea, hora, onHora, onMarcar }: { dia: DiaReto; e: EstadoReto; linea: string | null; hora: string; onHora: (h: string) => void; onMarcar: (t: TareaReto) => void }) {
  const p = dia.whatsapp;
  const link = p ? linkWaMe(linea, mensajeEscrito(p, hora)) : null;
  return (
    <>
      <p className="co-dia">Día {dia.n} de 7</p>
      <Burbuja ancho>
        <p>{dia.mensaje}</p>
        <VideoDelDia dia={dia} />
      </Burbuja>
      <Burbuja ancho>
        <div className="rt-tarjeta" data-recorrido={`sb-reto-dia-${dia.n}`}>
          <p className="rt-tarjeta__t">Lo que te toca hoy</p>
          <ol className="rt-tareas">
            {dia.tareas.map((t) => {
              const ok = tareaHecha(e, dia.n, t.id);
              return (
                <li key={t.id} className="rt-tarea" data-ok={ok ? '' : undefined}>
                  <span className="rt-tarea__check" aria-hidden>{ok ? '✓' : ''}</span>
                  <span className="rt-tarea__txt"><b>{t.titulo}</b><small>{t.detalle}</small></span>
                  {/* Sin «Hacerlo» (18/11): dice DÓNDE es, y tocarlo marca ese lugar con el tutorial (no lleva a ningún lado). */}
                  {ok ? <span className="rt-tarea__ok">Listo</span>
                    : <button type="button" className="rt-tarea__donde" onClick={() => onMarcar(t)} title="Te marco dónde está">{t.donde}</button>}
                </li>
              );
            })}
          </ol>
        </div>
      </Burbuja>
      {p && (
        <Burbuja ancho>
          <div className="rt-tarjeta rt-wa">
            <p className="rt-tarjeta__t">{p.texto}</p>
            <p className="rt-wa__ej">Por ejemplo: {p.ejemplo}</p>
            {dia.n === 2 && (
              <div className="rt-horas" role="radiogroup" aria-label="La hora">
                {HORAS_WA.map((h) => <button key={h} type="button" role="radio" aria-checked={h === hora} className="rt-hora" onClick={() => onHora(h)}>{h}</button>)}
              </div>
            )}
            {link
              ? <a className="rt-wa__btn" href={link} target="_blank" rel="noopener noreferrer">{dia.n === 2 ? 'Confirmar y abrir WhatsApp' : 'Abrir WhatsApp'}</a>
              : <p className="rt-wa__ej">La línea de MaKo no está conectada en este momento.</p>}
          </div>
        </Burbuja>
      )}
    </>
  );
}

/** El video del día: el del manifiesto (`reto-dia-<n>`), o en la revisión su lugar marcado. Nunca otro video. */
function VideoDelDia({ dia }: { dia: DiaReto }) {
  const v = useVideoTutorial(dia.video);
  const ref = useRef<HTMLVideoElement>(null);
  // Si sale de la vista corriendo (o se navega), sigue abajo a la derecha (Martín, 18/11).
  useVideoQueFlota(ref, v ? dia.video : null, `Día ${dia.n}`);
  // Con frases que marcan lugares (el día 2: la foto, Settings, el QR…), el video lo pasa el motor: marca cada lugar cuando la voz
  // lo nombra, pausa hasta el clic y sigue en el cuadrito de abajo a la derecha mientras la persona navega.
  if (v && v.frases?.some((f) => f.sel)) {
    return (
      <button type="button" className="rt-video rt-video--pasos" onClick={() => mostrarTutorial(tutorialDelDia(dia), { video: dia.video, directo: true })}
        style={v.poster ? { backgroundImage: `url(${v.poster})` } : undefined} aria-label={`Ver el video del día ${dia.n}: te marca dónde tocar`}>
        <span className="rt-video__play" aria-hidden>▶</span><span className="rt-video__dice">Ver el video del día {dia.n}: te marco dónde tocar</span>
      </button>
    );
  }
  if (v) return <video ref={ref} className="rt-video" src={v.archivo} poster={v.poster} controls playsInline preload="metadata" />;
  if (PARA_TODOS) return null;
  return <div className="rt-video rt-video--lugar" role="note"><b>Tu video del día {dia.n}</b><span>Todavía no está grabado: va aquí.</span></div>;
}

/** EL DESPLEGABLE DEL RETO, en la cabecera del chat. */
export function DesplegableReto({ d, abierto, onAbrir }: { d: DatosReto; abierto: boolean; onAbrir: (si: boolean) => void }) {
  const [diaAbierto, setDiaAbierto] = useState<number | null>(null);
  const actual = Math.max(1, d.abierto);
  const ver = diaAbierto ?? actual;
  const hora = d.estado?.horaWa ?? '9:00';
  const ESTADO: Record<EstadoDia, string> = { hecho: 'Listo', medias: 'A medias', hoy: 'Hoy', luego: '' };
  return (
    <div className="rt-btn-wrap">
      <button type="button" className="rt-btn" aria-expanded={abierto} aria-haspopup="dialog" onClick={() => onAbrir(!abierto)} data-recorrido="sb-reto">
        <span className="rt-btn__txt"><b>{RETO_TITULO}</b><span className="rt-segs" aria-hidden>{d.dias.map((x, i) => <i key={i} data-e={x} />)}</span></span>
        <span className="rt-btn__dia">{d.hechos === 7 ? 'Completo' : `Día ${actual} de 7`}</span>
      </button>
      {abierto && (
        <div className="rt-menu" role="dialog" aria-label={RETO_TITULO}>
          <header className="rt-menu__cab"><div><p className="rt-menu__t">{RETO_TITULO}</p><p className="rt-menu__sub">{RETO_SUB}</p></div><span className="rt-menu__cuenta"><b>{d.hechos}</b> de 7</span></header>
          <div className="rt-menu__segs" aria-hidden>{d.dias.map((x, i) => <i key={i} data-e={x} />)}</div>
          <p className="rt-menu__ley"><span><i data-e="hecho" />Listo</span><span><i data-e="hoy" />Hoy</span><span><i data-e="medias" />A medias</span><span><i />Por venir</span></p>
          <ol className="rt-menu__lista">
            {DIAS_RETO.map((dia, i) => {
              const est = d.dias[i];
              const futuro = est === 'luego';
              const etiqueta = ESTADO[est] || (dia.n === actual + 1 ? `Mañana, a las ${hora}` : `Día ${dia.n}`);
              const abre = dia.n === ver;
              return (
                <li key={dia.n} className="rt-menu__dia" data-e={est} data-abierto={abre ? '' : undefined}>
                  <button type="button" className="rt-menu__fila" aria-expanded={abre} onClick={() => setDiaAbierto(abre ? 0 : dia.n)}>
                    <span className="rt-menu__n" aria-hidden>{est === 'hecho' ? '✓' : dia.n}</span>
                    <span className="rt-menu__q"><b>{dia.titulo}</b><small>{etiqueta}</small></span>
                  </button>
                  {abre && (
                    <div className="rt-menu__cuerpo">
                      {futuro && <p className="rt-menu__luego">Su video llega {dia.n === actual + 1 ? `mañana a las ${hora}` : `ese día a las ${hora}`}. Si quieres, adelántalo al terminar el de hoy.</p>}
                      <p className="rt-menu__rot">Lo que te toca</p>
                      <ol className="rt-menu__tareas">
                        {dia.tareas.map((t) => {
                          const ok = !!d.estado && tareaHecha(d.estado, dia.n, t.id);
                          return <li key={t.id} data-ok={ok ? '' : undefined}><span className="rt-tarea__check" aria-hidden>{ok ? '✓' : ''}</span><span>{t.titulo}<small>{t.donde}</small></span></li>;
                        })}
                      </ol>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

// ⚠️ SIN COMILLAS INVERTIDAS ADENTRO (es un template literal: AGENTS.md).
const CSS_RETO = `
.rt-md p { margin: 0; }
.rt-md p + p, .rt-md p + .rt-video, .rt-md .rt-opciones { margin-top: 8px; }
.rt-caja { margin: 0; padding: 10px 14px; font-size: var(--fs-meta); color: var(--dim); text-align: center; }
.rt-opciones { display: flex; flex-wrap: wrap; gap: 8px; }
.rt-video { display: block; width: min(420px, 100%); aspect-ratio: 16 / 9; margin-top: 8px; border-radius: var(--r-md); background: #0E1219; }
.rt-video--lugar { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #fff; border: 1.5px dashed rgba(255,255,255,.4); text-align: center; padding: 8px; box-sizing: border-box; }
.rt-video--lugar span { font-size: var(--fs-meta); opacity: .75; }
.rt-video--pasos { position: relative; border: 0; padding: 0; cursor: pointer; background-size: cover; background-position: center; color: #fff; overflow: hidden; }
.rt-video--pasos::after { content: ""; position: absolute; inset: 0; background: linear-gradient(transparent 40%, rgba(0,0,0,.65)); }
.rt-video__play { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); width: 56px; height: 56px; border-radius: 999px; display: grid; place-items: center; background: rgba(0,0,0,.55); font-size: 20px; z-index: 1; }
.rt-video__dice { position: absolute; left: 12px; right: 12px; bottom: 10px; font-size: var(--fs-meta); font-weight: 650; text-align: left; z-index: 1; }
.rt-tarjeta { display: flex; flex-direction: column; gap: 8px; }
.rt-tarjeta__t { margin: 0; font-weight: 650; font-size: var(--fs-sm); color: var(--ink); }
.rt-tareas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.rt-tarea { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--border); }
.rt-tarea__check { flex: none; width: 18px; height: 18px; border-radius: 6px; display: grid; place-items: center; font-size: 12px; font-weight: 800; color: #fff; box-shadow: inset 0 0 0 1.5px var(--border-strong); }
.rt-tarea[data-ok] .rt-tarea__check, .rt-menu__tareas li[data-ok] .rt-tarea__check { background: var(--good); box-shadow: none; }
.rt-tarea__txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.rt-tarea__txt b { font-size: var(--fs-sm); color: var(--ink); }
.rt-tarea__txt small { font-size: var(--fs-meta); color: var(--dim); }
.rt-tarea[data-ok] .rt-tarea__txt b { color: var(--dim); text-decoration: line-through; }
.rt-tarea__ok { font-size: var(--fs-meta); font-weight: 700; color: var(--good); }
.rt-tarea__donde { flex: none; border: 0; background: none; padding: 4px 0; font: inherit; font-size: var(--fs-meta); font-weight: 650; color: var(--dim); cursor: pointer; text-decoration: underline; text-decoration-color: var(--border-strong); text-underline-offset: 3px; }
.rt-tarea__donde:hover { color: var(--ink); }
.rt-wa__ej { margin: 0; font-size: var(--fs-meta); color: var(--dim); line-height: 1.45; }
.rt-wa__btn { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border-radius: 10px; background: #25D366; color: #08321A; font-weight: 700; font-size: var(--fs-sm); text-decoration: none; }
.rt-horas { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 8px; }
.rt-hora { height: 38px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-sm); font-weight: 600; font-variant-numeric: tabular-nums; cursor: pointer; }
.rt-hora[aria-checked="true"] { border-color: var(--primary); background: var(--primary-bg); color: var(--primary-strong, var(--primary)); box-shadow: inset 0 0 0 1px var(--primary); }
.rt-btn-wrap { position: relative; }
.rt-btn { display: inline-flex; align-items: center; gap: 10px; height: 36px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-sm); cursor: pointer; }
.rt-btn[aria-expanded="true"] { background: var(--surface-2); }
.rt-btn__txt { display: flex; flex-direction: column; gap: 3px; align-items: flex-start; line-height: 1; }
.rt-btn__txt b { font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.rt-btn__dia { font-size: 12px; font-weight: 700; color: var(--dim); white-space: nowrap; font-variant-numeric: tabular-nums; }
.rt-segs { display: flex; gap: 2px; }
.rt-segs i, .rt-menu__segs i, .rt-menu__ley i { display: block; width: 11px; height: 4px; border-radius: 2px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--border); }
.rt-segs i[data-e="hecho"], .rt-menu__segs i[data-e="hecho"], .rt-menu__ley i[data-e="hecho"] { background: var(--good); box-shadow: none; }
.rt-segs i[data-e="hoy"], .rt-menu__segs i[data-e="hoy"], .rt-menu__ley i[data-e="hoy"] { background: var(--mako, #F2B01E); box-shadow: none; }
.rt-segs i[data-e="medias"], .rt-menu__segs i[data-e="medias"], .rt-menu__ley i[data-e="medias"] { background: var(--warn); box-shadow: none; }
.rt-menu { position: absolute; top: calc(100% + 8px); left: 0; z-index: 60; width: min(420px, calc(100vw - 24px)); max-height: min(620px, calc(100vh - 140px)); overflow: auto; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); box-shadow: 0 18px 44px rgba(23,21,17,.18); }
@media (max-width: 640px) { .rt-menu { position: fixed; top: 64px; left: 12px; right: 12px; width: auto; max-height: calc(100vh - 80px); } }
.rt-menu__cab { display: flex; align-items: flex-start; gap: 12px; padding: 16px 16px 0; }
.rt-menu__t { margin: 0; font-weight: 700; font-size: var(--fs-card, 15px); }
.rt-menu__sub { margin: 4px 0 0; font-size: var(--fs-meta); line-height: 1.45; color: var(--dim); }
.rt-menu__cuenta { margin-left: auto; flex: none; padding: 4px 10px; border-radius: 999px; background: var(--surface-2); font-size: 12px; color: var(--dim); white-space: nowrap; }
.rt-menu__cuenta b { font-size: 15px; color: var(--ink); }
.rt-menu__segs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; padding: 14px 16px 0; }
.rt-menu__segs i { width: auto; height: 8px; border-radius: 4px; }
.rt-menu__ley { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 8px 16px 6px; font-size: 11.5px; color: var(--dim); }
.rt-menu__ley span { display: inline-flex; align-items: center; gap: 6px; }
.rt-menu__ley i { width: 14px; height: 6px; }
.rt-menu__lista { list-style: none; margin: 0; padding: 4px 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.rt-menu__dia { border-radius: 12px; }
.rt-menu__dia[data-abierto] { background: var(--surface-2); }
.rt-menu__fila { width: 100%; display: flex; align-items: center; gap: 12px; padding: 9px 8px; border: 0; border-radius: 12px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.rt-menu__n { flex: none; width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; font-size: 12.5px; font-weight: 700; background: var(--surface); color: var(--dim); box-shadow: inset 0 0 0 1.5px var(--border-strong); }
.rt-menu__dia[data-e="hecho"] .rt-menu__n { background: var(--good); color: #fff; box-shadow: none; }
.rt-menu__dia[data-e="hoy"] .rt-menu__n { background: var(--mako, #F2B01E); color: #1a1405; box-shadow: none; }
.rt-menu__dia[data-e="medias"] .rt-menu__n { background: var(--warn); color: #fff; box-shadow: none; }
.rt-menu__q { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.rt-menu__q b { font-size: var(--fs-sm); font-weight: 600; line-height: 1.3; }
.rt-menu__q small { font-size: 11.5px; font-weight: 600; color: var(--dim); }
.rt-menu__dia[data-e="hecho"] .rt-menu__q small { color: var(--good); }
.rt-menu__dia[data-e="medias"] .rt-menu__q small { color: var(--warn); }
.rt-menu__cuerpo { padding: 0 10px 12px 48px; display: flex; flex-direction: column; gap: 8px; }
.rt-menu__luego { margin: 0; font-size: 12px; line-height: 1.45; color: var(--dim); }
.rt-menu__rot { margin: 2px 0 0; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--faint); }
.rt-menu__tareas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rt-menu__tareas li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; line-height: 1.35; }
.rt-menu__tareas li > span:last-child { display: flex; flex-direction: column; }
.rt-menu__tareas small { font-size: 11px; color: var(--faint); }
.rt-menu__tareas li[data-ok] > span:last-child { color: var(--dim); text-decoration: line-through; }
`;
