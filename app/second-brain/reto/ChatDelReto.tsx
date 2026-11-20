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
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useChatCliente } from '../useChatCliente';
import { CajaDelCliente, HiloDelCliente } from '../PiezasCliente';
import { ORIGEN_RETO, TAB_RETO, type ElegidoChat } from '@/lib/chat-mako-reglas';
import type { Desde } from '@/lib/chat-desde';
import { tutorialDe } from '@/lib/tutoriales';
import { BotonTutoriales, CatalogoTutoriales, CSS_CATALOGO } from './CatalogoTutoriales';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { FilaDelChat } from '@/app/admin/operaciones/Hilo';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { linkWaMe } from '@/lib/verificacion-entrante';
import { PARA_TODOS } from '@/lib/onboarding-v2/revision';
import {
  HORAS_WA, RETO_HOLA, RETO_SUB, RETO_TITULO, mensajeEscrito, tareaHecha,
  type DiaReto, type EstadoDia, type EstadoReto, type MarcaReto, type TareaReto,
} from '@/lib/reto/dias';
import { mostrarTutorial, senalAhora, senalarDondeTocar } from '@/app/_ui/tutorial/store';
import { useVideoTutorial } from '@/app/_ui/tutorial/useVideoTutorial';
// V5 (20/11): la entrada de cada día (el velo y MaKo escribiendo) y el «dale play», las piezas del chat del onboarding (no otras).
import { EntradaEscribiendo, useEntrada } from '@/app/_ui/tutorial/EntradaEscribiendo';
import { VideoDelMomento } from '@/app/_ui/tutorial/VideoDelMomento';
import { useDalePlay } from '@/app/_ui/tutorial/useDalePlay';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { guardarRetoDelEnsayo, retoDelEnsayo, useEnsayo } from '@/app/_ui/tutorial/desde-cero';
import { claveTarea, diaAbierto, diasDelReto, estadoDeLosDias, tutorialDelDia } from '@/lib/reto/dias';
import { RETO_EMPEZAR_DIA1, RETO_INTERES_YA, RETO_MUESTRA, RETO_MUESTRA_FIN, muestrasDe, type MuestraReto } from '@/lib/reto/dias';
import { diaTerminado, finDelDia, marcasDeLaTarea, tareaDespues } from '@/lib/reto/dias';
import { NOTA_PRO_UNA_VEZ, TAREA_PRO } from '@/lib/reto/pro-del-reto';
import { CADA_MS_CLIP, frasePorEscribir, ganchoDelGuion, guionMasNuevo, vistaDelClip, type VistaClip } from '@/lib/reto/clip-del-reto';
import type { ClipRegalo } from '@/lib/reto/clip-regalo-reglas';
import { clipDeRegaloAction, pedirClipDeRegaloAction } from '@/app/ai-avatar/regalo/actions';
import { pedirAbrir, pedirListar } from '@/app/copywriter/cliente';

/** Lo que contestan las dos acciones del clip de regalo (el tipo vive en app/ai-avatar/regalo/clip.ts, que es del servidor). */
type SalidaClip = Awaited<ReturnType<typeof clipDeRegaloAction>>;

/** El gancho de su guion más nuevo (el del día 5), con los pedidos del Copywriter (sólo lectura). Sin guion o sin acceso: ''. */
async function ganchoDeSuGuion(): Promise<string> {
  try {
    const l = await pedirListar();
    const p = guionMasNuevo(l.ok ? l.paginas : null);
    if (!p) return '';
    const a = await pedirAbrir(p.id);
    return a.ok ? ganchoDelGuion(a.doc.contenido) : '';
  } catch { return ''; }
}

type DatosReto = { ve: boolean; estado: EstadoReto | null; abierto: number; dias: EstadoDia[]; hechos: number; linea: string | null;
  /** El funnel que eligió en Funnel Coach: arma los días 4 a 6 (`diasDelReto`, 20/11). */
  funnel?: string | null;
  /** Lo que eligió en «¿Qué te gustaría que MaKo resuelva primero?» (D1-02). */
  intereses?: string[];
  /** Una prueba de MaKo Essential: lo de Pro de los días 4 a 6 se usa una vez (R57-03). */
  proUnaVez?: boolean };

/** Lo del ensayo «desde cero» (app/_ui/tutorial/desde-cero.ts): el mismo cálculo que /api/reto, con el estado en el navegador. */
function datosDelEnsayo(base: DatosReto | null, e: EstadoReto | null): DatosReto {
  const { abierto, dias, hechos } = estadoDeLosDias(e, Date.now());
  return { ve: true, linea: base?.linea ?? null, estado: e, abierto, dias, hechos };
}
function hacerEnEnsayo(e: EstadoReto | null, c: { accion?: unknown; dia?: unknown; id?: unknown; hora?: unknown }): EstadoReto | null {
  const ahora = Date.now();
  if (c.accion === 'empezar') return e ?? { v: 1, inicio: new Date(ahora).toISOString(), adelantado: 1, hechas: {} };
  if (!e) return e;
  if (c.accion === 'adelantar' && Number(c.dia) === diaAbierto(e, ahora) + 1) return { ...e, adelantado: Number(c.dia), adelantadoEn: new Date(ahora).toISOString() };
  if (c.accion === 'hecha') return { ...e, hechas: { ...e.hechas, [claveTarea(Number(c.dia), String(c.id))]: new Date(ahora).toISOString() } };
  if (c.accion === 'hora' && (HORAS_WA as readonly string[]).includes(String(c.hora))) return { ...e, horaWa: String(c.hora) };
  if (c.accion === 'despues') return { ...e, despues: [...new Set([...(e.despues ?? []), claveTarea(Number(c.dia), String(c.id))])] };
  if (c.accion === 'manana') return { ...e, manana: Number(c.dia) };
  if (c.accion === 'dia1') return { ...e, dia1Desde: e.dia1Desde ?? new Date(ahora).toISOString() };
  if (c.accion === 'muestra') return { ...e, muestras: [...new Set([...(e.muestras ?? []), String((c as { pestana?: unknown }).pestana ?? '')])] };
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

// LOS TRES PUNTITOS (20/11, auditoría D1-10 y d24-11): lo acordado es que ningún mensaje del reto sale pegado a otro. La primera vez
// que se ve, MaKo «escribe» y recién después llega, de a uno y en orden. Lo ya visto (en este navegador) sale de una.
const VISTOS = 'mako.reto.vistos';
export const MS_ESCRIBE = 1200;
export function useAparicion(claves: readonly string[]): { ver: (k: string) => boolean; escribiendo: boolean; listo: boolean } {
  const [vistos, setVistos] = useState<Set<string> | null>(null);
  useEffect(() => { try { setVistos(new Set(JSON.parse(localStorage.getItem(VISTOS) ?? '[]') as string[])); } catch { setVistos(new Set()); } }, []);
  const falta = vistos ? claves.find((k) => !vistos.has(k)) : undefined;
  useEffect(() => {
    if (!vistos || !falta) return;
    // Un día nuevo no espera acá: su entrada es la del motor (el velo con MaKo escribiendo, `useEntrada` en `Dia`; V5).
    const espera = falta.startsWith('dia:') ? 0 : MS_ESCRIBE;
    const t = window.setTimeout(() => {
      const n = new Set(vistos); n.add(falta);
      try { localStorage.setItem(VISTOS, JSON.stringify([...n].slice(-300))); } catch { /* sin storage: igual se ve */ }
      setVistos(n);
    }, espera);
    return () => window.clearTimeout(t);
  }, [vistos, falta]);
  const corte = !vistos ? 0 : falta ? claves.indexOf(falta) : claves.length;
  return { ver: (k) => { const i = claves.indexOf(k); return i < 0 || i < corte; }, escribiendo: !!vistos && !!falta && !falta.startsWith('dia:'), listo: !!vistos };
}


const YA_MARCADA = 'mako.reto.marcada.';
// Exportadas para el paso de Offer Coach a Funnel Coach (./usePasoAlFunnel.ts): la misma tarea se marca una vez por visita, la
// marque este chat o el Offer Coach.
export const yaMarcada = (k: string) => { try { return !!sessionStorage.getItem(YA_MARCADA + k); } catch { return false; } };
export const anotarMarcada = (k: string) => { try { sessionStorage.setItem(YA_MARCADA + k, '1'); } catch { /* sin storage */ } };

export function ChatDelReto({ nombre, onVolver }: { nombre: string; onVolver: () => void }) {
  const { d, leer, hacer } = useReto();
  const ensayo = useEnsayo();
  const hilo = useRef<HTMLDivElement>(null);
  // La hora se guarda cuando ella manda el WhatsApp (lib/reto/respuestas.ts): al volver de WhatsApp, se relee para mostrar la confirmación.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') void leer(); };
    window.addEventListener('focus', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    return () => { window.removeEventListener('focus', alVolver); document.removeEventListener('visibilitychange', alVolver); };
  }, [leer]);
  const [menu, setMenu] = useState(false);
  // LA CAJA DEL RETO (20/11, auditoría D1-09 y R57-13; decisión del Cerebro): le escribe al MaKo del Ops Center con el contexto del
  // reto (app/api/mako/chat/route.ts → `contextoDelChat`, lib/reto/contexto.ts), con adjuntos y voz como toda caja (CajaDelCliente,
  // lib/cajas-de-chat.ts). La charla va en SU conversación (TAB_RETO), debajo de los mensajes del reto.
  const campo = useRef<HTMLTextAreaElement>(null);
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/mako/chat?deTab=${TAB_RETO}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { sesion?: { id: number } | null } | null) => { if (vivo) setElegido(j?.sesion ? { antes: j.sesion.id } : { virtual: 'nuevo' }); });
    return () => { vivo = false; };
  }, []);
  const quienMako = useMemo(() => ({ nombre: 'MaKo', aspecto: ASPECTO_MAKO }), []);
  const k = useChatCliente({ elegido, setElegido, activo: false, entrarAlCerebro: false, chatInicial: null, opcionArmar: '', busca: '', caja: campo, desde: DESDE_RETO, tab: TAB_RETO, quien: quienMako, offerDirecto: false });
  // El catálogo «Tutoriales de MaKo» (V1, D1-07): el ícono de videos cambia los mensajes por todos los videos, con «Volver al chat».
  const [catalogo, setCatalogo] = useState(false);
  const [hora, setHora] = useState<string | null>(null);

  // Al abrirlo por primera vez, el reto empieza (el día 1, ahora).
  const empezo = useRef(false);
  useEffect(() => {
    if (!d || !d.ve || d.estado || empezo.current) return;
    empezo.current = true;
    void hacer({ accion: 'empezar' });
  }, [d, hacer]);

  // Lo que falta, marcado DESPUÉS del video del día (20/11, auditoría D1-03, d24-09 y R57-12): antes, a los 0,9 s de abrir el chat
  // se oscurecía la pantalla y se marcaba la próxima tarea, tapando el mensaje y el video. Lo acordado: cada día empieza con su
  // video; mientras corre, el video marca dónde tocar; recién al terminar (o al cerrarlo) se marca lo que quedó, una vez por visita.
  // Tocar lo marcado sólo LLEVA al lugar: la tarea queda hecha cuando MaKo lee que se hizo (/api/reto, lib/reto/senales.ts).
  const e = d?.estado ?? null;
  const marcarLoQueFalta = useCallback((dia: DiaReto) => {
    if (!e || senalAhora()) return;
    const t = dia.tareas.find((x) => !tareaHecha(e, dia.n, x.id));
    if (!t || yaMarcada(`${dia.n}:${t.id}`)) return;
    anotarMarcada(`${dia.n}:${t.id}`);
    // El día 1 sin «Lo hago después» (auditoría F1: la maqueta no lo tiene); los demás días sí.
    marcarTarea(marcasDeLaTarea(t), () => { void leer(); }, dia.n === 1 ? undefined : () => { void hacer({ accion: 'despues', dia: dia.n, id: t.id }); });
  }, [e, leer, hacer]);


  // Los días 4 a 6, armados para su funnel (20/11, auditoría d24-14 y R57-01).
  const abiertos = d && e ? diasDelReto(d.funnel).filter((x) => x.n <= d.abierto) : [];
  // «¿Qué hacemos ahora?» (20/11, D1-02 y V3): lo que eligió en el onboarding, con su «Muéstrame…», antes del día 1. Un reto que ya
  // venía andando (con algo hecho o pasado el día 1) no vuelve a preguntar.
  const muestras = muestrasDe(d?.intereses);
  const vistas = muestras.filter((m) => e?.muestras?.includes(m.pestana));
  const quedan = muestras.filter((m) => !e?.muestras?.includes(m.pestana));
  const empezo1 = !!d && !!e && (!!e.dia1Desde || !muestras.length || d.abierto > 1 || Object.keys(e.hechas).length > 0);
  // EL FIN DEL DÍA (20/11, D1-06, d24-13, R57-07): recién cuando el día abierto terminó (todo hecho o dejado para después), su
  // cierre (FIN_DIA) y, en el recuadro de opciones, «¿Adelantas el día N?». «Mañana» queda guardado y su respuesta, en el chat.
  const actual = abiertos[abiertos.length - 1];
  const siguiente = actual ? diasDelReto(d?.funnel).find((x) => x.n === actual.n + 1) : undefined;
  const termino = !!e && !!actual && empezo1 && diaTerminado(e, actual);
  const falta = e && actual ? actual.tareas.filter((t) => !tareaHecha(e, actual.n, t.id) && tareaDespues(e, actual.n, t.id)).map((t) => t.id) : [];
  const eligioManana = !!e && !!siguiente && e.manana === siguiente.n;
  const pregunta = termino && !!siguiente && !eligioManana;
  // El orden en que llegan los mensajes (las claves de useAparicion).
  const claves = !d || !e ? [] : [
    'hola', ...(muestras.length ? ['interes'] : []), ...vistas.flatMap((m) => [`muestra:${m.pestana}`, `muestrafin:${m.pestana}`]),
    ...(empezo1 ? abiertos.map((x) => `dia:${x.n}`) : []),
    ...(termino && actual ? [`fin:${actual.n}`] : []),
    ...(termino && eligioManana && siguiente ? [`manana:${siguiente.n}`] : []),
  ];
  const ap = useAparicion(claves);
  useEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [d?.abierto, d?.hechos, ap.escribiendo]);
  const empezarDia1 = () => {
    const d1 = diasDelReto(d?.funnel)[0];
    // La marca de Offer Coach sale recién al elegir «Empezar mi día 1» (D1-03), no sola al abrir el chat.
    void hacer({ accion: 'dia1' }).then(() => window.setTimeout(() => marcarLoQueFalta(d1), 600));
  };
  const mostrar = (m: MuestraReto) => {
    void hacer({ accion: 'muestra', pestana: m.pestana });
    const t = tutorialDe(m.pestana);
    if (t) mostrarTutorial(t, { video: m.pestana });
  };
  const horaWa = hora ?? e?.horaWa ?? '9:00';
  return (
    <PanelDeChat hilo={hilo}
      cabecera={{ clave: 'reto-7-dias', titulo: RETO_TITULO, aspecto: ASPECTO_MAKO, animo: 'despierto', onVolver,
        acciones: d && e ? <span className="rt-acciones"><BotonTutoriales activo={catalogo} onClick={() => setCatalogo((x) => !x)} /><DesplegableReto d={d} abierto={menu} onAbrir={setMenu} /></span> : undefined }}
      caja={<>{d && e && !empezo1 && ap.listo && !ap.escribiendo
        ? <QueHacemos titulo={vistas.length ? '¿Seguimos?' : '¿Qué hacemos ahora?'} quedan={quedan} onDia1={empezarDia1} onMostrar={mostrar} />
        : pregunta && siguiente && ap.listo && !ap.escribiendo
        ? <AdelantarDia n={siguiente.n} onAdelantar={() => void hacer({ accion: 'adelantar', dia: siguiente.n })} onManana={() => void hacer({ accion: 'manana', dia: siguiente.n })} />
        : null}<div className="co-caja"><CajaDelCliente k={k} campo={campo} seguir={() => hilo.current} /></div></>}
      estado="">
      <style>{CSS_RETO + CSS_CATALOGO}</style>
      <div className="co-hilo__col" data-recorrido="sb-reto-hilo">
        {catalogo && d ? <CatalogoTutoriales diaAbierto={d.abierto} onVolver={() => setCatalogo(false)} /> : !d ? <p className="co-vacio">Cargando tu reto…</p> : !e ? <p className="co-vacio">Empezando tu reto…</p> : (
          <>
            {ap.ver('hola') && <Burbuja><p>{RETO_HOLA(nombre)}</p></Burbuja>}
            {muestras.length > 0 && ap.ver('interes') && <Burbuja><p>{RETO_INTERES_YA(muestras)}</p></Burbuja>}
            {vistas.map((m) => (
              <Fragment key={m.pestana}>
                {ap.ver(`muestra:${m.pestana}`) && <Burbuja><p>{RETO_MUESTRA(m)}</p></Burbuja>}
                {ap.ver(`muestrafin:${m.pestana}`) && <Burbuja><p>{RETO_MUESTRA_FIN(m)}</p></Burbuja>}
              </Fragment>
            ))}
            {empezo1 && abiertos.filter((dia) => ap.ver(`dia:${dia.n}`)).map((dia) => (
              <Dia key={dia.n} dia={dia} e={e} linea={d.linea} hora={horaWa} proUnaVez={!!d.proUnaVez} hoy={dia.n === d.abierto}
                onHora={(h) => setHora(h)}
                onConfirmarHora={() => { if (ensayo.activo) void hacer({ accion: 'hora', hora: horaWa }); }}
                onMarcar={(t) => marcarTarea(marcasDeLaTarea(t), () => { void leer(); }, dia.n === 1 ? undefined : () => { void hacer({ accion: 'despues', dia: dia.n, id: t.id }); })}
                onTocadoEnVideo={() => { void leer(); }}
                onClipListo={() => { void leer(); }}
                onFinVideo={() => marcarLoQueFalta(dia)} />
            ))}
            {termino && actual && ap.ver(`fin:${actual.n}`) && <Burbuja><p>{finDelDia(actual, siguiente, horaWa, nombre, falta)}</p></Burbuja>}
            {termino && eligioManana && siguiente && ap.ver(`manana:${siguiente.n}`) && <Burbuja><p>Perfecto: mañana a las {horaWa} se abre tu día {siguiente.n}, aquí en el reto.</p></Burbuja>}
            {/* Lo que le escribió a MaKo en este chat, y lo que contestó (su conversación, después de los mensajes del reto). */}
            {(k.items.length > 0 || k.enCurso) && <HiloDelCliente k={k} />}
            {ap.escribiendo && <Burbuja><span className="co-escribiendo" role="status" aria-label="MaKo está escribiendo"><span className="co-trabajando__puntos" aria-hidden><i /><i /><i /></span></span></Burbuja>}
            {d.abierto === 7 && d.hechos === 7 && <Burbuja><p>¡Terminaste tu reto de 7 días, {nombre || 'genial'}! Tu negocio ya está armado en MaKo.</p></Burbuja>}
          </>
        )}
      </div>
    </PanelDeChat>
  );
}

/** «¿Qué hacemos ahora?»: el recuadro de opciones del Ops Center (las clases de PreguntaChat), arriba de la caja (D1-02). */
export function QueHacemos({ titulo, quedan, onDia1, onMostrar }: { titulo: string; quedan: readonly MuestraReto[]; onDia1: () => void; onMostrar: (m: MuestraReto) => void }) {
  return (
    <div className="co-preg co-preg--chat rt-preg" role="group" aria-label={titulo} data-recorrido="sb-reto-que-hacemos">
      <p className="co-preg__texto">{titulo}</p>
      <ol className="co-preg__ops">
        <li><button type="button" className="co-preg__op" onClick={onDia1}><span className="co-preg__num" aria-hidden>1</span>
          <span className="co-preg__op-txt"><span className="co-preg__titulo">{RETO_EMPEZAR_DIA1}<span className="co-preg__rec"> (Recomendada)</span></span></span></button></li>
        {quedan.map((m, i) => (
          <li key={m.pestana}><button type="button" className="co-preg__op" onClick={() => onMostrar(m)}><span className="co-preg__num" aria-hidden>{i + 2}</span>
            <span className="co-preg__op-txt"><span className="co-preg__titulo">Muéstrame {m.nombre}</span></span></button></li>
        ))}
      </ol>
    </div>
  );
}

/** «¿Adelantas el día N?», en el recuadro de opciones (D1-06, d24-13, R57-07): sólo al día 2 se le recomienda «Adelantar»; desde
 *  el 3, «Mañana» va primero y sin recomendada. */
export function AdelantarDia({ n, onAdelantar, onManana }: { n: number; onAdelantar: () => void; onManana: () => void }) {
  const ops = n === 2 ? [{ t: `Adelantar al día ${n}`, rec: true, f: onAdelantar }, { t: 'Mañana', rec: false, f: onManana }]
    : [{ t: 'Mañana', rec: false, f: onManana }, { t: `Adelantar al día ${n}`, rec: false, f: onAdelantar }];
  return (
    <div className="co-preg co-preg--chat rt-preg" role="group" aria-label={`¿Adelantas el día ${n}?`} data-recorrido="sb-reto-adelantar">
      <p className="co-preg__texto">¿Adelantas el día {n}?</p>
      <ol className="co-preg__ops">
        {ops.map((o, i) => (
          <li key={o.t}><button type="button" className="co-preg__op" onClick={o.f}><span className="co-preg__num" aria-hidden>{i + 1}</span>
            <span className="co-preg__op-txt"><span className="co-preg__titulo">{o.t}{o.rec && <span className="co-preg__rec"> (Recomendada)</span>}</span></span></button></li>
        ))}
      </ol>
    </div>
  );
}

function Burbuja({ children, ancho = false }: { children: ReactNode; ancho?: boolean }) {
  return <FilaDelChat m={null} quien={{ titulo: 'MaKo', aspecto: ASPECTO_MAKO }} marcas={null} hora={null} ancho={ancho}><div className="rt-md">{children}</div></FilaDelChat>;
}

export function Dia({ dia, e, linea, hora, proUnaVez = false, hoy = true, onHora, onConfirmarHora, onMarcar, onTocadoEnVideo, onFinVideo, onClipListo }: { dia: DiaReto; e: EstadoReto; linea: string | null; hora: string; proUnaVez?: boolean; hoy?: boolean; onHora: (h: string) => void; onConfirmarHora?: () => void; onMarcar: (t: TareaReto) => void; onTocadoEnVideo: (sel: string) => void; onFinVideo?: () => void; onClipListo?: () => void }) {
  const p = dia.whatsapp;
  const todas = dia.tareas.every((t) => tareaHecha(e, dia.n, t.id));
  const link = p ? linkWaMe(linea, mensajeEscrito(p, hora)) : null;
  // EL DÍA 2 EN SU ORDEN (20/11, auditoría d24-19 y D1-18; memoria onboarding-16-11-decisiones): el QR, la extensión, las integraciones,
  // la hora de WhatsApp y, ÚLTIMO, el perfil. El perfil sale de la tarjeta del día y va después de la hora.
  const ultimo = dia.n === 2 ? dia.tareas.find((t) => t.id === 'perfil') : undefined;
  const primeras = ultimo ? dia.tareas.filter((t) => t !== ultimo) : dia.tareas;
  const fila = (t: TareaReto) => {
    const ok = tareaHecha(e, dia.n, t.id);
    // Hecha, dice lo que MaKo LEYÓ (20/11, auditoría d24-12: «Leí 134 contactos en tu CRM.»), no el detalle de la tarea.
    const leido = ok ? e.leidas?.[claveTarea(dia.n, t.id)] : undefined;
    // En una prueba de Essential, lo de Pro se usa una vez y se dice sin vender (R57-03): ningún botón que venda el plan acá.
    const pro = TAREA_PRO[claveTarea(dia.n, t.id)];
    const nota = !ok && proUnaVez && pro && !(e.pro?.[pro] && Date.now() > Date.parse(e.pro[pro]!.hasta)) ? NOTA_PRO_UNA_VEZ : null;
    return (
      <li key={t.id} className="rt-tarea" data-ok={ok ? '' : undefined}>
        <span className="rt-tarea__check" aria-hidden>{ok ? '✓' : ''}</span>
        <span className="rt-tarea__txt"><b>{t.titulo}</b><small>{leido ?? t.detalle}</small>{nota && <small className="rt-tarea__pro">{nota}</small>}</span>
        {/* Sin «Hacerlo» (18/11): dice DÓNDE es, y tocarlo marca ese lugar con el tutorial (no lleva a ningún lado). */}
        {ok ? <span className="rt-tarea__ok">Listo</span>
          : tareaDespues(e, dia.n, t.id) ? <button type="button" className="rt-tarea__donde" onClick={() => onMarcar(t)} title="Te marco dónde está">◐ Después</button>
          : <button type="button" className="rt-tarea__donde" onClick={() => onMarcar(t)} title="Te marco dónde está">{t.donde}</button>}
      </li>
    );
  };
  // V5 (20/11, auditoría V5, d24-11 y R57-12): la primera vez que se abre el día de HOY, el velo con MaKo escribiendo y recién después
  // su mensaje con el video, marcado con «dale play» mientras está quieto (el motor lo marca sólo a la vista y con el motor libre).
  const fase = useEntrada(`reto-dia-${dia.n}`, hoy);
  if (fase === 'escribe') {
    return (
      <>
        <p className="co-dia">Día {dia.n} de 7</p>
        <EntradaEscribiendo foto={<Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={26} />} quien="MaKo" />
      </>
    );
  }
  return (
    <>
      <p className="co-dia">Día {dia.n} de 7</p>
      <Burbuja ancho>
        <p>{dia.mensaje}</p>
        <VideoDelDia dia={dia} onTocado={onTocadoEnVideo} onFin={onFinVideo} dalePlay={hoy} />
      </Burbuja>
      <Burbuja ancho>
        <div className="rt-tarjeta" data-recorrido={`sb-reto-dia-${dia.n}`}>
          {/* «Día N de 7» y el título del día; en un día pasado, «Lo que te tocó» (20/11, f24-03 y R57-15). */}
          <p className="rt-tarjeta__t">{dia.titulo}</p>
          <p className="rt-tarjeta__sub">{hoy ? 'Lo que te toca hoy' : 'Lo que te tocó'}</p>
          <ol className="rt-tareas">
            {primeras.map(fila)}
          </ol>
        </div>
      </Burbuja>
      {dia.n === 6 && <ClipDelReto onListo={onClipListo} />}
      {/* La prueba por WhatsApp va al FINAL del día (f24-02); la hora del día 2 es un paso del día: su tarjeta (wa-08, TarjetaHora). */}
      {p && (dia.n === 2 || diaTerminado(e, dia)) && (dia.n === 2
        ? <TarjetaHora p={p} guardada={e.horaWa ?? null} linea={linea} hora={hora} onHora={onHora} onConfirmar={onConfirmarHora ?? (() => {})} />
        : (
          <Burbuja ancho>
            <div className="rt-tarjeta rt-wa">
              <p className="rt-tarjeta__t">{p.texto}</p>
              <p className="rt-wa__ej">Por ejemplo: {p.ejemplo}</p>
              {link
                ? <a className="rt-wa__btn" href={link} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
                : <p className="rt-wa__ej">No tengo el número de MaKo a mano: vuelve a intentarlo en un rato.</p>}
            </div>
          </Burbuja>
        ))}
      {ultimo && (
        <Burbuja ancho>
          <div className="rt-tarjeta" data-recorrido="sb-reto-dia-2-perfil">
            <p className="rt-tarjeta__t">Último paso del día 2: tu perfil</p>
            <ol className="rt-tareas">{fila(ultimo)}</ol>
          </div>
        </Burbuja>
      )}
      {/* Lo que hizo durante el video ya cuenta (el Cerebro, 18/11): si hizo todo, la felicita (sólo el día 2, R57-F4). */}
      {todas && dia.n === 2 && <Burbuja><p>¡Hiciste todo lo del día {dia.n}!</p></Burbuja>}
    </>
  );
}

/**
 * EL CLIP DE REGALO DEL DÍA 6 (20/11, R57-02; el Cerebro: «sí, por ApiMart», UN clip por prueba, lo que cuesta anotado y, si ApiMart
 * falla o no hay saldo, se dice claro y no se cobra nada). El clip lo hace la sesión de AI Avatar (app/ai-avatar/regalo/actions.ts,
 * 51d9ef3e5); acá sólo se muestra. Qué vista toca en cada estado: lib/reto/clip-del-reto.ts. Mientras dice «generando» pregunta cada
 * 10 s: esa consulta es la que lo termina con el día 6 abierto (si se va, lo termina el cron de cada 15 min, app/api/cron/clip-regalo).
 * Al quedar listo está en su historial de videos, y eso ya marca la tarea
 * «Tu primer clip con tu personaje» (lib/reto/senales.ts, `6:clip`): por eso `onListo` relee el reto.
 */
function ClipDelReto({ onListo }: { onListo?: () => void }) {
  const [clip, setClip] = useState<ClipRegalo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [frase, setFrase] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const vivo = useRef(true);
  const antes = useRef<ClipRegalo['estado'] | null>(null);
  const aplicar = useCallback((r: SalidaClip) => {
    if (!vivo.current) return;
    if (r.ok) { setClip(r.clip); setError(null); } else setError(r.error);
    setVuelta((n) => n + 1);
  }, []);
  const preguntar = useCallback(() => clipDeRegaloAction().then(aplicar, () => aplicar({ ok: false, error: 'No pude leer tu clip de regalo. Vuelve a intentarlo en un momento.' })), [aplicar]);
  useEffect(() => { vivo.current = true; void preguntar(); return () => { vivo.current = false; }; }, [preguntar]);
  const generando = clip?.estado === 'generando';
  // Una consulta 10 s después de cada respuesta (también si la última falló): nunca dos a la vez.
  useEffect(() => {
    if (!generando) return;
    const t = setTimeout(() => { void preguntar(); }, CADA_MS_CLIP);
    return () => clearTimeout(t);
  }, [generando, vuelta, preguntar]);
  useEffect(() => {
    const ahora = clip?.estado ?? null;
    if (ahora === 'listo' && antes.current === 'generando') onListo?.();
    antes.current = ahora;
  }, [clip, onListo]);
  // La frase ya escrita con el gancho de su guion, una vez y sólo con la caja vacía (no le pisa lo que escribió).
  const conFormulario = clip?.estado === 'disponible' || (clip?.estado === 'fallo' && clip.puedeReintentar);
  const prellenada = useRef(false);
  useEffect(() => {
    if (!conFormulario || prellenada.current) return;
    prellenada.current = true;
    void ganchoDeSuGuion().then((g) => { if (g && vivo.current) setFrase((f) => (f.trim() ? f : g)); });
  }, [conFormulario]);
  const pedir = async () => {
    setPidiendo(true);
    try { aplicar(await pedirClipDeRegaloAction({ frase })); } catch { aplicar({ ok: false, error: 'No pude pedir tu clip. Vuelve a intentarlo en un momento.' }); }
    if (vivo.current) setPidiendo(false);
  };
  return <TarjetaClip vista={vistaDelClip(clip, clip ? null : error)} error={clip ? error : null} frase={frase} pidiendo={pidiendo} onFrase={setFrase} onPedir={() => { void pedir(); }} />;
}

/** Lo que se ve del clip de regalo (sin estado: así lo dibujan las capturas con renderToStaticMarkup). */
export function TarjetaClip({ vista, error = null, frase, pidiendo = false, onFrase, onPedir }: {
  vista: VistaClip; error?: string | null; frase: string; pidiendo?: boolean; onFrase: (f: string) => void; onPedir: () => void;
}) {
  if (vista.v === 'nada') return null;
  if (vista.v === 'aviso') return <Burbuja><p>{vista.texto}</p></Burbuja>;
  const cuerpo = (() => {
    if (vista.v === 'generando') {
      return (
        <>
          <p className="rt-tarjeta__t">Tu clip se está haciendo</p>
          <p className="rt-wa__ej" role="status">Tarda un par de minutos y aparece aquí. <span className="co-trabajando__puntos" aria-hidden><i /><i /><i /></span></p>
        </>
      );
    }
    if (vista.v === 'listo') {
      return (
        <>
          <p className="rt-tarjeta__t">Tu clip de regalo</p>
          <video className="rt-clip__video" src={vista.url} controls playsInline preload="metadata" />
          <p className="rt-wa__ej">También quedó en tu historial de videos.</p>
        </>
      );
    }
    if (vista.v === 'fallo') return <><p className="rt-tarjeta__t">Tu clip de regalo</p><p className="rt-wa__ej">{vista.texto}</p></>;
    if (vista.v !== 'pedir') return null;
    const f = frasePorEscribir(frase, vista.max);
    return (
      <>
        <p className="rt-tarjeta__t">Tu clip de regalo: {vista.segundos} segundos con tu personaje</p>
        {vista.aviso
          ? <p className="rt-wa__ej">{vista.aviso}</p>
          : <p className="rt-wa__ej">Escribe el gancho de tu guion y tu personaje lo dice a cámara. Queda en tu historial de videos.</p>}
        <textarea className="rt-clip__frase" rows={3} value={frase} onChange={(ev) => onFrase(ev.target.value)} aria-label="Lo que dice tu personaje"
          placeholder="Por ejemplo: Tres errores que te hacen perder clientes en la primera llamada." disabled={pidiendo} />
        <p className="rt-clip__cuenta" data-pasada={f.aviso ? '' : undefined}>{f.aviso ?? `${f.palabras} de ${vista.max} palabras`}</p>
        <button type="button" className="rt-clip__btn" onClick={onPedir} disabled={!f.lista || pidiendo}>{pidiendo ? 'Pidiendo tu clip…' : vista.aviso ? 'Pedirlo otra vez' : 'Pedir mi clip'}</button>
      </>
    );
  })();
  return (
    <Burbuja ancho>
      <div className="rt-tarjeta rt-clip" data-recorrido="sb-reto-dia-6-clip">
        {cuerpo}
        {error && <p className="rt-clip__error" role="alert">{error}</p>}
      </div>
    </Burbuja>
  );
}

/**
 * LA HORA DE MaKo (el día 2; la maqueta, `tarjeta('hora')`; la auditoría del 20/11, wa-08 y D1-12). Tocar una hora sólo la ELIGE: se
 * guarda cuando ella manda el mensaje por WhatsApp, y MaKo le contesta (lib/reto/respuestas.ts). Desde ahí MaKo le escribe cada mañana a
 * esa hora (lib/reto/avisos.ts). Guardada, queda la confirmación. En el ensayo «desde cero» no hay WhatsApp: «Confirmar» la guarda ahí.
 */
function TarjetaHora({ p, guardada, linea, hora, onHora, onConfirmar }: {
  p: NonNullable<DiaReto['whatsapp']>; guardada: string | null; linea: string | null; hora: string; onHora: (h: string) => void; onConfirmar: () => void;
}) {
  if (guardada) return <Burbuja><p>✓ MaKo te escribe cada día a las {guardada}, por WhatsApp.</p></Burbuja>;
  const link = linkWaMe(linea, mensajeEscrito(p, hora));
  return (
    <>
      <Burbuja><p>Una más: dile a MaKo a qué hora te escribe por WhatsApp sobre el reto. Le escribes tú primero, así WhatsApp no frena sus mensajes.</p></Burbuja>
      <Burbuja ancho>
        <div className="rt-tarjeta rt-wa">
          <p className="rt-tarjeta__t">¿A qué hora te escribe MaKo sobre el reto?</p>
          <p className="rt-wa__ej">Al confirmar se abre tu WhatsApp con el mensaje ya escrito: lo mandas tú y MaKo te contesta.</p>
          <div className="rt-horas" role="radiogroup" aria-label="La hora">
            {HORAS_WA.map((h) => <button key={h} type="button" role="radio" aria-checked={h === hora} className="rt-hora" onClick={() => onHora(h)}>{h}</button>)}
          </div>
          <p className="rt-wa__ej">MaKo te escribe cada día a las {hora}.</p>
          {link
            ? <a className="rt-wa__btn" href={link} target="_blank" rel="noopener noreferrer" onClick={onConfirmar}>Confirmar y abrir WhatsApp</a>
            : <p className="rt-wa__ej">No tengo el número de MaKo a mano: vuelve a intentarlo en un rato.</p>}
        </div>
      </Burbuja>
    </>
  );
}

/** El video del día: el del manifiesto (`reto-dia-<n>`), o en la revisión su lugar marcado. Nunca otro video. */
function VideoDelDia({ dia, onTocado, onFin, dalePlay = false }: { dia: DiaReto; onTocado?: (sel: string) => void; onFin?: () => void; dalePlay?: boolean }) {
  const v = useVideoTutorial(dia.video);
  const boton = useRef<HTMLButtonElement>(null);
  const conMarcas = !!v?.frases?.some((f) => f.sel);
  // El «dale play» sobre el botón del video con marcas (useDalePlay, del motor): mientras nadie lo tocó.
  useDalePlay(boton, { clave: dia.video, titulo: `Día ${dia.n}`, activo: dalePlay && conMarcas });
  // Con frases que marcan lugares (el día 2: la foto, Settings, el QR…), el video lo pasa el motor: marca cada lugar cuando la voz
  // lo nombra, pausa hasta el clic y sigue en el cuadrito de abajo a la derecha mientras la persona navega.
  if (v && v.frases?.some((f) => f.sel)) {
    return (
      <button ref={boton} type="button" className="rt-video rt-video--pasos" onClick={() => mostrarTutorial(tutorialDelDia(dia), { video: dia.video, directo: true, alTocar: onTocado, alTerminar: () => onFin?.() })}
        style={v.poster ? { backgroundImage: `url(${v.poster})` } : undefined} aria-label={`Ver el video del día ${dia.n}: te marca dónde tocar`}>
        <span className="rt-video__play" aria-hidden>▶</span><span className="rt-video__dice">Ver el video del día {dia.n}: te marco dónde tocar</span>
      </button>
    );
  }
  // Sin marcas (el día 1): el reproductor de la maqueta (V14), que sigue en la esquina si se navega y marca «dale play» (V5).
  if (v) return <VideoDelMomento clave={dia.video} titulo={`Día ${dia.n}`} revision={false} onTermina={() => onFin?.()} dalePlay={dalePlay} />;
  if (PARA_TODOS) return null;
  return <div className="rt-video rt-video--lugar" role="note"><b>Tu video del día {dia.n}</b><span>Todavía no está grabado: va aquí.</span></div>;
}

/** Desde dónde escribe la caja del reto: el servidor arma con esto el contexto del reto (`contextoDelChat`). */
const DESDE_RETO: Desde = { tab: ORIGEN_RETO, entidad: null, modo: null };

/** El título del desplegable (la maqueta, RETO_T; auditoría D1-14, d24-18 y R57-F6). El chat sigue llamándose «Reto de 7 días». */
const RETO_TITULO_DESPLEGABLE = 'El reto de 7 días de MaKo';
const mmss = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');

/** El video de un día, en el desplegable (20/11, auditoría V2, D1-08 y R57-14): su título y su duración, y lo reproduce como en el
 *  chat: con sus marcas en los días que las tienen. Sin video en el manifiesto, nada (nunca un hueco). */
function VideoEnElMenu({ dia }: { dia: DiaReto }) {
  const v = useVideoTutorial(dia.video);
  if (!v) return null;
  return (
    <button type="button" className="rt-menu__video" onClick={() => mostrarTutorial(tutorialDelDia(dia), { video: dia.video, directo: true })}>
      <span className="rt-menu__play" aria-hidden>▶</span>
      <span><b>El video del día {dia.n}</b><small>Video{v.duracion_s ? ` · ${mmss(v.duracion_s)}` : ''}</small></span>
    </button>
  );
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
        <svg className="rt-btn__ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <span className="rt-btn__txt"><b>{RETO_TITULO}</b><span className="rt-segs" aria-hidden>{d.dias.map((x, i) => <i key={i} data-e={x} />)}</span></span>
        <span className="rt-btn__dia">{d.hechos === 7 ? 'Completo' : `Día ${actual} de 7`}</span>
        <svg className="rt-btn__flecha" viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {abierto && (
        <div className="rt-menu" role="dialog" aria-label={RETO_TITULO}>
          <header className="rt-menu__cab"><div><p className="rt-menu__t">{RETO_TITULO_DESPLEGABLE}</p><p className="rt-menu__sub">{RETO_SUB}</p></div><span className="rt-menu__cuenta"><b>{d.hechos}</b> de 7</span></header>
          <div className="rt-menu__segs" aria-hidden>{d.dias.map((x, i) => <i key={i} data-e={x} />)}</div>
          <p className="rt-menu__ley"><span><i data-e="hecho" />Listo</span><span><i data-e="hoy" />Hoy</span><span><i data-e="medias" />A medias</span><span><i />Por venir</span></p>
          <ol className="rt-menu__lista">
            {diasDelReto(d.funnel).map((dia, i) => {
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
                      {futuro && <p className="rt-menu__luego">Su video llega {dia.n === actual + 1 ? `mañana a las ${hora}` : `ese día a las ${hora}`}. Si quieres, adelántalo al terminar el día de hoy.</p>}
                      {!futuro && <VideoEnElMenu dia={dia} />}
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
export const CSS_RETO = `
.rt-md p { margin: 0; }
.rt-md p + p, .rt-md p + .rt-video, .rt-md .rt-opciones { margin-top: 8px; }
.rt-preg { margin: 0 12px 10px; }
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
.rt-tarjeta__sub { margin: -6px 0 0; font-size: var(--fs-meta); color: var(--dim); }
.rt-tarea__pro { color: var(--ink) !important; font-weight: 600; }
.rt-tarea__ok { font-size: var(--fs-meta); font-weight: 700; color: var(--good); }
.rt-tarea__donde { flex: none; border: 0; background: none; padding: 4px 0; font: inherit; font-size: var(--fs-meta); font-weight: 650; color: var(--dim); cursor: pointer; text-decoration: underline; text-decoration-color: var(--border-strong); text-underline-offset: 3px; }
.rt-tarea__donde:hover { color: var(--ink); }
.rt-wa__ej { margin: 0; font-size: var(--fs-meta); color: var(--dim); line-height: 1.45; }
.rt-wa__btn { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 16px; border-radius: 10px; background: #25D366; color: #08321A; font-weight: 700; font-size: var(--fs-sm); text-decoration: none; }
.rt-clip__frase { width: 100%; box-sizing: border-box; resize: vertical; min-height: 64px; max-height: 220px; field-sizing: content; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-sm); line-height: 1.45; }
.rt-clip__frase:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-bg); }
.rt-clip__cuenta { margin: -2px 0 0; font-size: var(--fs-meta); color: var(--dim); font-variant-numeric: tabular-nums; }
.rt-clip__cuenta[data-pasada] { color: var(--warn); font-weight: 600; }
.rt-clip__btn { align-self: flex-start; height: 38px; padding: 0 16px; border: 0; border-radius: 10px; background: var(--ink); color: var(--surface); font: inherit; font-size: var(--fs-sm); font-weight: 700; cursor: pointer; }
.rt-clip__btn:disabled { opacity: .45; cursor: default; }
.rt-clip__video { display: block; width: min(240px, 100%); aspect-ratio: 9 / 16; border-radius: var(--r-md); background: #0E1219; }
.rt-clip__error { margin: 0; font-size: var(--fs-meta); color: var(--bad, #C2410C); line-height: 1.45; }
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
.rt-btn__ico, .rt-btn__flecha { flex: none; color: var(--dim); }
.rt-btn[aria-expanded="true"] .rt-btn__flecha { transform: rotate(180deg); }
.rt-menu__video { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.rt-menu__video:hover { border-color: var(--border-strong); }
.rt-menu__video b { display: block; font-size: 12.5px; }
.rt-menu__video small { display: block; font-size: 11px; color: var(--dim); }
.rt-menu__play { flex: none; width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; background: var(--ink); color: var(--surface); font-size: 10px; }
.rt-menu__luego { margin: 0; font-size: 12px; line-height: 1.45; color: var(--dim); }
.rt-menu__rot { margin: 2px 0 0; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--faint); }
.rt-menu__tareas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rt-menu__tareas li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; line-height: 1.35; }
.rt-menu__tareas li > span:last-child { display: flex; flex-direction: column; }
.rt-menu__tareas small { font-size: 11px; color: var(--faint); }
.rt-menu__tareas li[data-ok] > span:last-child { color: var(--dim); text-decoration: line-through; }
`;
