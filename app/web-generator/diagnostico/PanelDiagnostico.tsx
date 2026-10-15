'use client';

// =============================================================================
// PanelDiagnostico — el diagnóstico de una landing, a la DERECHA del Panel (tanda 2, T2 y T5)
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2), textual:
//   2. «"Diagnóstico" no debería ser otra ruta, debería abrirse ahí a la derecha.»
//   7. «… que al analizar una landing sea como un "tutorial" de los que tenemos en MaKo, que se ponga
//      opaco y señale el lugar donde se esta haciendo el comentario, y luego que queden guardados todos
//      los comentarios y sugerencias y claro, la opción de solucionarlo allí mismo con IA.»
//   8. «También si traigo una landing de afuera, tiene que funcionar el paso anterior, se tiene que
//      previsualizar y comenzar con los "comentarios"... Y me gustaría si es una landing de afuera tener
//      la opción de replicarla con nuestro editor.»
//
//   <PanelDiagnostico docId={12} onCerrar={…} />                 una landing NUESTRA
//   <PanelDiagnostico url="https://su-landing.com" onCerrar={…} /> una de AFUERA
//
// Lo monta el Panel (Inicio.tsx) en su área principal, adentro de `.gma .gp` (de ahí salen los botones
// y los menús de Gamma: CSS_GP). Arriba, el veredicto y las acciones; a la izquierda, la VISTA de la
// landing (VistaNuestra: el render público en el mismo documento; VistaAfuera: el HTML bajado en un
// iframe aislado); a la derecha, la LISTA de los comentarios guardados (Comentario.tsx). Al terminar un
// análisis arranca el RECORRIDO (RecorridoDiagnostico.tsx) por los pendientes, de arriba hacia abajo de
// la página; «Ver recorrido» lo vuelve a abrir y «Ver» de una fila lo abre desde ahí.
//
// Lo que no se ve en el código:
//   · ABRIR NO ANALIZA SI YA HAY COMENTARIOS GUARDADOS: el análisis cuesta una llamada a la IA (con las
//     keys del negocio) y tarda. Sin nada guardado, arranca solo — para eso se eligió «Diagnóstico».
//   · «Aplicar» (antes «Solucionar con IA») abre la landing DE NUEVO en el server (la versión y la sección
//     de ahora, no las del momento en que se abrió el panel), guarda una versión antes de aplicar (D8) y
//     guarda con la versión que abrió: si alguien guardó en el medio, lo dice y no pisa (abajo, tanda 6).
//   · «Replicar en el editor» crea una landing NUEVA, así que se navega DURO (AGENTS.md, «si lo que
//     cambió es QUÉ EXISTE…»), con el `?ws=`.
//
// TANDA 6 (14/10/2026). Martín: «El mimso error que nos saltaba con Mauricio "No pude leer el texto de esa
// página.". Soluciona eso...», y sus decisiones del mismo día:
//   · cuando el server no puede leer la página (`enNavegador`: una app que se arma en el navegador, o una que
//     le contesta 403), el análisis ofrece leerla EN EL NAVEGADOR de la persona (con el Pixel si está, si no
//     en una ventana emergente; con las emergentes bloqueadas no se abre nada y se ve el aviso con la flecha)
//     o pegar su texto (../lector/LeerOPegar.tsx). La lectura va en el campo `lectura` del pedido;
//   · «Replicar en el editor» pregunta 3 formatos (Presentación = diapositivas, Landing = secciones
//     editables, Página web = la copia idéntica) y postea `{ url, formato, lectura?, texto? }`
//     (../crear/Replicar.tsx, `useReplicar`). Si la página ya se leyó en el navegador para el análisis, esa
//     lectura se reusa: no se abre otra ventana;
//   · la página de afuera viaja TAL CUAL la pegó la persona (con su www y su query) a la vista, al análisis y
//     a Replicar: hay hosts que sólo existen así. La normalizada es sólo la LLAVE de los comentarios y de
//     landing_analyses (y el nombre que se muestra).
//
// TANDA 6, decisión (c) de Martín (14/10/2026): «"Aplicar" de cada comentario del Diagnóstico = un clic, con
// la versión guardada antes y "Deshacer"; más "Aplicar todos" (de a una sección, un solo Deshacer) y
// "Preguntar a MaKo" (el chat de MaKo al costado con el comentario). En una landing externa, "Aplicar" lleva
// a replicar primero y los comentarios pasan a la copia.» Reemplaza a «Solucionar con IA» + «Aceptar»:
//   · «Aplicar» lo hace el SERVER (POST /api/landing-generator/diagnostico/aplicar, el mismo de la API de
//     MaKo): abre la landing de ahora, la IA reescribe la sección, guarda antes la versión «Antes de aplicar
//     el diagnóstico», guarda y marca resuelto. Los «Aplicar» de a uno van en COLA (uno por vez: dos a la
//     vez chocarían en la versión de la landing);
//   · «Aplicar todos»: de a una sección, en orden de la página, con UNA versión de antes (la primera vuelta)
//     y cada vuelta encadenada a la versión que dejó la anterior (si alguien guarda en el medio, para);
//   · «Deshacer» restaura esa versión (`restaurarVersion`, que a su vez deja «Antes de restaurar») y vuelve
//     los comentarios a pendientes. Sólo lo ÚLTIMO aplicado, y sólo si la landing no cambió desde entonces:
//     la pila vive en lib/editor-landing/diagnostico.ts (`pilaTrasAplicar`, `pilaTrasDeshacer`);
//   · «Preguntar a MaKo»: el chat de MaKo (app/_components/MakoChat.tsx) en la columna de la derecha, con
//     el comentario y el texto de su sección como contexto (`contextoDeComentario`), una conversación por
//     comentario (`claveChatDeComentario`);
//   · de AFUERA, «Aplicar» replica primero como Landing (con la lectura del navegador si ya está) y pasa los
//     comentarios a la copia; el diagnóstico de la copia se abre y aplica ESE comentario (o todos) solo, una
//     vez: lo que viaja es un aviso en sessionStorage que se consume al abrir (nunca la URL: un F5 o un
//     link copiado no vuelven a aplicar).
//
// Verificación de la tanda 6 (14/10/2026), lo que la pantalla no seguía del motor:
//   · una landing NUESTRA se analiza con TODAS sus páginas, y la vista mostraba sólo la de inicio: los
//     comentarios de «Gracias» salían «Sin ubicar», fuera del recorrido y sin su sección en «Preguntar a
//     MaKo». Ahora la vista dibuja todas, una debajo de la otra con su rótulo (`htmlDeVistaDiagnostico`),
//     y el orden de «Aplicar todos» y el contexto del chat salen de todas (diagnostico-guardado.ts);
//   · de AFUERA, «Aplicar» usa la copia que ya existe (`copia`, del Panel) en vez de replicar otra vez.
//
// TANDA 7 (15/10/2026). Martín: «Si no pudo leer la landing, no me debe saltar el botón de "MaKo no pudo leerla
// sola" y las opciones de leer en tu navegador... Por defecto si no pudo de una manera que vaya directo a abrir la
// ventana emergente y a analizar la landing...». La ventana de lectura se abre EN EL CLIC que pide analizar o
// replicar una página de afuera (`abrirEnElClic`, lib/editor-landing/lector-navegador.ts: Chrome sólo la deja
// abrir dentro del gesto) y `pedirConVentana` la cierra si el server sí puede leer, o lee en ella y repite el
// pedido con la lectura si el server contesta `enNavegador`, sin un segundo clic. El análisis que arranca SOLO al
// abrir no tiene clic: toma la ventana que reservó el ↑ de la caja o el «Ir a» (`tomarVentanaReservada`; Inicio.tsx,
// `abrirDerechaEnElClic`). LeerOPegar queda como la salida de un fallo (`salida`). No se abre ventana cuando no
// puede hacer falta: una landing NUESTRA, Replicar con la página ya leída en el navegador o que el server ya leyó
// en esta visita (`leidaEnServer`), «Página web», o «Aplicar» con la copia que ya existe.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link, { useWs } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { MakoChat } from '@/app/_components/MakoChat';
import { CSS_CONTENIDO } from '@/lib/editor-landing/css';
import { htmlDePagina } from '@/lib/editor-landing/render';
import { temaPorId, urlFuentes } from '@/lib/editor-landing/temas';
import { tarjetasDe } from '@/lib/editor-landing/doc';
import { formatoDe, proporcionDe, type LandingCompleta, type TemaPropio } from '@/lib/editor-landing/api-tipos';
import {
  RUTA_APLICAR_DIAGNOSTICO, claveChatDeComentario, contextoDeComentario, gruposParaAplicar, objetivoDe,
  ordenarParaRecorrido, pilaTrasAplicar, pilaTrasDeshacer, sePuedeDeshacer, tarjetaDeRecorrido,
  type Aplicacion, type EstadoSugerencia, type PedidoAplicarDiagnostico, type PedidoDiagnostico, type RespuestaAplicar,
  type RespuestaAplicarDiagnostico, type RespuestaDiagnostico, type RespuestaListaDiagnostico, type RespuestaPasar, type Sugerencia,
} from '@/lib/editor-landing/diagnostico';
import { bloquesDeLanding, htmlDeVistaDiagnostico, paginasEnOrden } from '@/lib/editor-landing/diagnostico-guardado';
import type { Lectura } from '@/lib/editor-landing/lectura-tipos';
import {
  abrirEnElClic, cerrarVentana, pedirConVentana, tomarVentanaReservada,
  type SalidaSinLectura, type VentanaDelClic,
} from '@/lib/editor-landing/lector-navegador';
import { FORMATOS_REPLICAR, NOMBRE_FORMATO_REPLICAR, type FormatoReplicar } from '@/lib/editor-landing/replicar-reglas';
import { idDe } from '../editor/diff-tarjetas';
import { PLAZO_IA_MS, pedirDocs, postJson, type FallaPedido } from '../cliente';
import { Filtros, Ico, ItemMenu, MenuFlotante, irDuro, useAviso } from '../MiniaturaLanding';
import { FallaReplicar, ICONO_FORMATO, pideVentana, useReplicar, type AlReplicar } from '../crear/Replicar';
import { LeerOPegar } from '../lector/LeerOPegar';
import { RecorridoDiagnostico, type PasoDiagnostico } from './RecorridoDiagnostico';
import { VistaNuestra } from './VistaNuestra';
import { VistaAfuera } from './VistaAfuera';
import { Comentario, type EstadoArreglo } from './Comentario';
import type { ControlVista, ObjetivoVista } from './vista';

type Props = {
  docId?: number;
  url?: string;
  onCerrar: () => void;
  /** Una página de AFUERA se acaba de analizar (la URL que contestó el server): el Panel la suma a su barra sin recargar. */
  onAnalizada?: (url: string) => void;
  /**
   * La copia editable que YA existe de esta página de afuera (`copiaParaAplicar`, panel-reglas.ts), o null:
   * «Aplicar» la usa en vez de replicar otra vez.
   */
  copia?: number | null;
};

/** El análisis piensa y una página de afuera además se baja: el plazo de la ruta (300 s) y un margen. */
const PLAZO_ANALISIS_MS = 305_000;
/** Cuánto se espera a que la vista ubique los comentarios antes de abrir el recorrido solo. */
const ESPERA_RECORRIDO_MS = 1_200;

const pedirDiagnostico = (cuerpo: PedidoDiagnostico, ms = 65_000) =>
  postJson<RespuestaDiagnostico>('/api/landing-generator/diagnostico', cuerpo, ms);

const esLista = (r: RespuestaDiagnostico | FallaPedido): r is RespuestaListaDiagnostico => r.ok && 'sugerencias' in r;

const pedirAplicar = (cuerpo: PedidoAplicarDiagnostico) =>
  postJson<RespuestaAplicarDiagnostico>(RUTA_APLICAR_DIAGNOSTICO, cuerpo, PLAZO_IA_MS);
const esAplicada = (r: RespuestaAplicarDiagnostico | FallaPedido): r is RespuestaAplicar => r.ok && 'aplicadas' in r;
const esPasada = (r: RespuestaAplicarDiagnostico | FallaPedido): r is RespuestaPasar => r.ok && 'mapa' in r;
const errorDe = (r: { ok: boolean }) => (r as { error?: string }).error ?? 'No se pudo aplicar.';

/** Las preguntas sugeridas del chat de «Preguntar a MaKo» (cortas: van en una fila). */
const SUGERENCIAS_CHAT = ['¿Cómo lo reescribo?', 'Dame 3 opciones', '¿Por qué importa?'];

/**
 * Lo que el «Aplicar» de una landing de AFUERA deja para el diagnóstico de su copia: se usa UNA vez, al
 * abrirlo, y vence (si la copia se abre otro día, no se aplica nada sin que la persona lo pida).
 */
const CLAVE_UNA_VEZ = 'gdg-aplicar-copia';
const VENCE_UNA_VEZ_MS = 10 * 60_000;
type UnaVez = { docId: number; t: number; ids?: number[]; todos?: true };

function dejarUnaVez(u: UnaVez): void {
  try { sessionStorage.setItem(CLAVE_UNA_VEZ, JSON.stringify(u)); } catch { /* sin sessionStorage: se aplica a mano */ }
}

function tomarUnaVez(docId: number): UnaVez | null {
  try {
    const u = JSON.parse(sessionStorage.getItem(CLAVE_UNA_VEZ) ?? 'null') as UnaVez | null;
    if (!u || u.docId !== docId) return null;
    sessionStorage.removeItem(CLAVE_UNA_VEZ);
    return Date.now() - Number(u.t) < VENCE_UNA_VEZ_MS ? u : null;
  } catch {
    return null;
  }
}

function hostDe(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; }
}

/** El panel. Se remonta entero al cambiar de landing (`key`): ningún estado de la anterior sobrevive. */
export default function PanelDiagnostico(props: Props) {
  const clave = props.docId != null ? `d${props.docId}` : `u${props.url ?? ''}`;
  return <PanelInterno key={clave} {...props} />;
}

function PanelInterno({ docId, url, copia = null, onCerrar, onAnalizada }: Props) {
  const deNuestra = docId != null;
  const objetivo = useMemo(() => (deNuestra ? { docId } : { url: url ?? '' }), [deNuestra, docId, url]);
  // La URL normalizada como la del server (sin query, sin www): la LLAVE de los comentarios y de
  // landing_analyses, y el nombre que se muestra. La que se BAJA (la vista, el lector, Replicar) es la
  // pegada (`urlPegada`), tal cual: hay hosts que sólo existen con www (tanda 6). Van arriba de `analizar`
  // (tanda 7): la ventana del clic lee ESTA dirección.
  const urlVista = useMemo(() => { const o = url ? objetivoDe({ url }) : null; return o && 'url' in o ? o.url : null; }, [url]);
  const urlPegada = urlVista && url ? url.trim() : null;

  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [resumen, setResumen] = useState<RespuestaListaDiagnostico['resumen']>(null);
  const [cargando, setCargando] = useState(true);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pegable, setPegable] = useState(false);
  /** El server no la pudo leer, pero el navegador de la persona sí puede (tanda 6, `enNavegador`). */
  const [enNavegador, setEnNavegador] = useState(false);
  /** La última lectura del navegador de ESTA página: Replicar la reusa (no abre otra ventana). */
  const ultimaLectura = useRef<Lectura | null>(null);
  /**
   * Tanda 7: el server ya leyó ESTA página en esta visita (un análisis que salió sin lectura ni texto): Replicar
   * y «Aplicar» no abren la ventana del clic (sería un parpadeo por nada; si igual pide el navegador, la salida
   * de siempre).
   */
  const leidaEnServer = useRef(false);
  /** Tanda 7: la página se está leyendo en la ventana del clic, antes de la segunda vuelta del análisis. */
  const [leyendoPagina, setLeyendoPagina] = useState(false);
  /** Tanda 7: por qué el análisis no se pudo leer SIN clic (LeerOPegar lo muestra), o null. */
  const [salida, setSalida] = useState<SalidaSinLectura | null>(null);
  const [doc, setDoc] = useState<LandingCompleta | null>(null);
  const [temas, setTemas] = useState<TemaPropio[]>([]);
  const [filtro, setFiltro] = useState<EstadoSugerencia>('pendiente');
  const [activa, setActiva] = useState<number | null>(null);
  // Sube cuando la vista vuelve a ubicar los comentarios (la lista repinta «Sin ubicar»). El movimiento
  // de la vista NO pasa por acá: va por `senal`, sin redibujar el panel (ver EVENTO_MOVIO en ./vista).
  const [, setUbicadas] = useState(0);
  const senal = useMemo(() => new EventTarget(), []);
  const [arreglos, setArreglos] = useState<Record<number, EstadoArreglo | undefined>>({});
  /** La pila de «Deshacer» (lib/editor-landing/diagnostico.ts): sólo la de arriba se deshace. */
  const [pila, setPila] = useState<Aplicacion[]>([]);
  const pilaRef = useRef<Aplicacion[]>([]);
  const ponerPila = useCallback((p: Aplicacion[]) => { pilaRef.current = p; setPila(p); }, []);
  /** Lo aplicado en esta visita sigue a la vista en «Pendientes» (con «Deshacer» y «Ver cambio»). */
  const [recientes, setRecientes] = useState<number[]>([]);
  /** «Aplicar todos» corriendo: cuántas secciones van. */
  const [todos, setTodos] = useState<{ hecho: number; total: number } | null>(null);
  /** El comentario de «Preguntar a MaKo» (el chat ocupa la columna de la derecha). */
  const [chat, setChat] = useState<Sugerencia | null>(null);
  /** Replicar para APLICAR (una de afuera): qué se aplica en la copia. Ref para el callback, estado para el texto. */
  const afuera = useRef<number[] | 'todos' | null>(null);
  const [paraAplicar, setParaAplicar] = useState(false);
  const montado = useRef(true);
  const unaVez = useRef<UnaVez | null>(null);
  const unaVezLeida = useRef(false);
  const ws = useWs();
  const [recorrido, setRecorrido] = useState<{ abierto: boolean; desde: number; pasos: PasoDiagnostico[] }>({ abierto: false, desde: 0, pasos: [] });
  const [quiereRecorrido, setQuiereRecorrido] = useState(false);
  const [menuReplicar, setMenuReplicar] = useState<HTMLElement | null>(null);
  const { estado: estadoReplicar, replicar: pedirReplica } = useReplicar();
  const replicando = estadoReplicar.fase === 'replicando';
  const controlRef = useRef<ControlVista | null>(null);
  const { avisar, nodo: aviso } = useAviso();

  const aplicarLista = useCallback((r: RespuestaListaDiagnostico) => {
    setSugerencias(r.sugerencias);
    if (r.resumen) setResumen(r.resumen);
  }, []);

  /**
   * Analiza. `texto`: el copy pegado; `lectura`: la página leída en el navegador (tanda 6). `ventana` (tanda 7):
   * la que se abrió EN EL CLIC (o la reservada, en el arranque solo): si el server contesta `enNavegador`, la
   * página se lee ahí y el análisis se repite con la lectura, sin otro clic (`pedirConVentana`).
   */
  const analizar = useCallback(async (extra: { texto?: string; lectura?: Lectura; ventana?: VentanaDelClic | null } = {}) => {
    setAnalizando(true);
    setError(null);
    setPegable(false);
    setEnNavegador(false);
    setSalida(null);
    if (extra.lectura) ultimaLectura.current = extra.lectura;
    const base = { accion: 'analizar' as const, ...objetivo, ...(extra.texto ? { texto: extra.texto } : {}) };
    // Una NUESTRA se lee de su contenido, y con la lectura o el texto a mano no hay nada que leer: ninguna usa la
    // ventana (no debería llegar ninguna; si llega, no queda abierta).
    const usaVentana = !deNuestra && !!urlPegada && !extra.lectura && !extra.texto;
    if (!usaVentana && extra.ventana && extra.ventana !== 'bloqueada') cerrarVentana(extra.ventana);
    const { r, lectura, sinLectura } = await pedirConVentana({
      url: urlPegada ?? '',
      ventana: usaVentana ? extra.ventana ?? null : null,
      pedir: (leida) => {
        // La segunda vuelta (ya leída en la ventana): de «Leyendo la página…» a «Analizando…».
        if (leida) setLeyendoPagina(false);
        const l = leida ?? extra.lectura;
        return pedirDiagnostico({ ...base, ...(l ? { lectura: l } : {}) }, PLAZO_ANALISIS_MS);
      },
      pideNavegador: (x) => !esLista(x) && (x as { enNavegador?: boolean }).enNavegador === true,
      alLeer: () => setLeyendoPagina(true),
      sigue: () => montado.current,
    });
    if (!montado.current) return;
    setLeyendoPagina(false);
    setAnalizando(false);
    if (lectura) ultimaLectura.current = lectura;
    if (!esLista(r)) {
      const f = r as { error?: string; pegable?: boolean; enNavegador?: boolean };
      setError(f.error ?? 'No se pudo analizar.');
      setPegable(f.pegable === true);
      setEnNavegador(f.enNavegador === true);
      setSalida(sinLectura);
      return;
    }
    if (!deNuestra && !lectura && !extra.lectura && !extra.texto) leidaEnServer.current = true;
    aplicarLista(r);
    if (!deNuestra && r.url) onAnalizada?.(r.url);
    setFiltro('pendiente');
    avisar(r.nuevas ? (r.nuevas === 1 ? '1 comentario nuevo' : `${r.nuevas} comentarios nuevos`) : 'Sin comentarios nuevos');
    if (r.sugerencias.some((s) => s.estado === 'pendiente')) setQuiereRecorrido(true);
  }, [objetivo, aplicarLista, avisar, deNuestra, onAnalizada, urlPegada]);

  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);

  // Al abrir: lo guardado (y la landing, si es nuestra). Sin nada guardado, analiza solo.
  useEffect(() => {
    let vivo = true;
    // Lo que dejó el «Aplicar» de una landing de afuera para ESTA copia (una vez; el ref sobrevive al
    // doble montaje del modo estricto, que si no lo consumiría en el primero y lo perdería).
    if (!unaVezLeida.current) { unaVezLeida.current = true; if (docId != null) unaVez.current = tomarUnaVez(docId); }
    void (async () => {
      const [lista, abierta, propios] = await Promise.all([
        pedirDiagnostico({ accion: 'listar', ...objetivo }),
        deNuestra && docId != null ? pedirDocs({ accion: 'abrir', id: docId }) : Promise.resolve(null),
        deNuestra ? pedirDocs({ accion: 'temas' }) : Promise.resolve(null),
      ]);
      if (!vivo) return;
      // Tanda 7: la ventana que reservó el clic que abrió esto (el ↑ de la caja, el «Ir a»; Inicio.tsx). Se toma
      // ACÁ, en la corrida que sigue viva (el doble montaje del modo estricto corta la primera en el `vivo`), y se
      // usa sólo si se analiza: abrir lo guardado no la necesita y se cierra. Una NUESTRA nunca reserva.
      const reservada = !deNuestra && url ? tomarVentanaReservada(url) : null;
      const sinUsar = () => { if (reservada && reservada !== 'bloqueada') cerrarVentana(reservada); };
      if (abierta && abierta.ok) setDoc(abierta.doc);
      if (propios && propios.ok) setTemas(propios.temas);
      setCargando(false);
      if (!esLista(lista)) { sinUsar(); setError((lista as { error?: string }).error ?? 'No se pudo abrir.'); return; }
      if (abierta && !abierta.ok) { sinUsar(); setError(abierta.error); return; }
      aplicarLista(lista);
      if (!lista.sugerencias.length && !lista.resumen) void analizar({ ventana: reservada });
      else sinUsar();
    })();
    return () => { vivo = false; };
    // Una vez por landing: el panel se remonta al cambiar (`key` en PanelDiagnostico).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── La vista ───────────────────────────────────────────────────────────────
  const tema = useMemo(() => (doc ? temaPorId(doc.config.tema, temas) : null), [doc, temas]);
  // TODAS las páginas, una debajo de la otra (verificación de la tanda 6): el motor ya analiza la landing
  // entera, y mirando sólo la de inicio los comentarios de «Gracias» salían «Sin ubicar», fuera del
  // recorrido y sin el texto de su sección en «Preguntar a MaKo».
  const paginas = useMemo(() => (doc ? paginasEnOrden(doc.contenido) : []), [doc]);
  const html = useMemo(
    () => (doc && tema ? htmlDeVistaDiagnostico(paginas, (p) => htmlDePagina(p, doc.config, tema, { modo: 'exportar' })) : ''),
    [doc, tema, paginas],
  );
  const bloques = useMemo(() => (doc ? bloquesDeLanding(doc.contenido) : []), [doc]);
  const objetivos = useMemo<ObjetivoVista[]>(() => sugerencias.map((s) => ({ id: s.id, cita: s.cita, seccionId: s.seccionId })), [sugerencias]);
  const onUbicar = useCallback(() => setUbicadas((t) => t + 1), []);

  // ── El recorrido ───────────────────────────────────────────────────────────
  const pendientes = useMemo(() => sugerencias.filter((s) => s.estado === 'pendiente'), [sugerencias]);
  const abrirRecorrido = useCallback((desdeId?: number) => {
    const ctl = controlRef.current;
    const elegida = desdeId != null ? sugerencias.find((s) => s.id === desdeId) : undefined;
    // «Ver» de uno que ya no está pendiente: sólo ése.
    const base = elegida && elegida.estado !== 'pendiente' ? [elegida] : pendientes;
    const orden = ordenarParaRecorrido(base, (id) => ctl?.posicion(id) ?? null);
    const pasos = orden.map((s) => ({ id: s.id, severidad: s.hallazgo.severidad, ...tarjetaDeRecorrido(s.hallazgo) }));
    if (!pasos.length) return;
    const desde = desdeId != null ? Math.max(0, pasos.findIndex((p) => p.id === desdeId)) : 0;
    setRecorrido({ abierto: true, desde, pasos });
  }, [sugerencias, pendientes]);

  // Recién analizada: el recorrido arranca solo cuando la vista tuvo un momento para ubicar las citas.
  useEffect(() => {
    if (!quiereRecorrido) return;
    const t = setTimeout(() => { setQuiereRecorrido(false); abrirRecorrido(); }, ESPERA_RECORRIDO_MS);
    return () => clearTimeout(t);
  }, [quiereRecorrido, abrirRecorrido]);

  const irA = useCallback((id: number) => controlRef.current?.ir(id) ?? Promise.resolve(null), []);
  const cajaDe = useCallback((id: number) => controlRef.current?.caja(id) ?? null, []);
  const cerrarRecorrido = useCallback(() => setRecorrido((r) => ({ ...r, abierto: false })), []);

  // ── Estados ────────────────────────────────────────────────────────────────
  // El tipo va escrito: el «Deshacer» del aviso se llama a sí mismo, y sin la anotación el tipo de la
  // función dependería de sí mismo.
  const cambiarEstado: (s: Sugerencia, estado: EstadoSugerencia) => Promise<void> = useCallback(async (s: Sugerencia, estado: EstadoSugerencia) => {
    const antes = s.estado;
    setSugerencias((xs) => xs.map((x) => (x.id === s.id ? { ...x, estado } : x)));
    const r = await pedirDiagnostico({ accion: 'estado', id: s.id, estado });
    if (!r.ok || !('sugerencia' in r)) {
      setSugerencias((xs) => xs.map((x) => (x.id === s.id ? { ...x, estado: antes } : x)));
      avisar('No se pudo guardar');
      return;
    }
    setSugerencias((xs) => xs.map((x) => (x.id === s.id ? r.sugerencia : x)));
    if (estado !== 'pendiente') avisar(estado === 'resuelta' ? 'Marcada como resuelta' : 'Comentario descartado', () => void cambiarEstado({ ...s, estado }, antes));
  }, [avisar]);

  // ── Aplicar (decisión c) ───────────────────────────────────────────────────
  const ponerArreglo = (id: number, a: EstadoArreglo | undefined) => setArreglos((m) => ({ ...m, [id]: a }));
  const ponerArreglos = (ids: readonly number[], a: EstadoArreglo | undefined) =>
    setArreglos((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, a])) }));
  const arreglosRef = useRef(arreglos);
  const ordenRef = useRef<string[]>([]);
  const ordenSecciones = useMemo(() => paginas.flatMap((p) => tarjetasDe(p).map(idDe)), [paginas]);
  useLayoutEffect(() => { arreglosRef.current = arreglos; ordenRef.current = ordenSecciones; });

  /** Lo que devolvió el server: la landing como quedó, los comentarios resueltos y su «Ver cambio». */
  const tomarAplicada = useCallback((r: RespuestaAplicar) => {
    setDoc(r.doc);
    setSugerencias((xs) => xs.map((x) => r.aplicadas.find((a) => a.id === x.id) ?? x));
    ponerArreglos(r.aplicadas.map((a) => a.id), { fase: 'aplicado', original: r.original, nuevas: r.nuevas });
    setRecientes((xs) => [...new Set([...xs, ...r.aplicadas.map((a) => a.id)])]);
  }, []);

  // «Deshacer» viaja por ref: lo llaman el aviso y las filas, y él llama a cosas que lo nombran.
  const deshacerRef = useRef<() => Promise<void>>(async () => {});

  /**
   * Los «Aplicar» de a uno, EN COLA: uno por vez (dos a la vez chocarían en la versión de la landing y el
   * segundo fallaría). Cada uno guarda su versión de antes y es su propio «Deshacer». `colaCorriendo` es de
   * la cola; `trabajando`, de «Aplicar todos» y «Deshacer», que no corren con nada más.
   */
  const cola = useRef<Sugerencia[]>([]);
  const colaCorriendo = useRef(false);
  const trabajando = useRef(false);
  const aplicarUno = useCallback(async (s: Sugerencia) => {
    if (docId == null || trabajando.current || cola.current.some((x) => x.id === s.id)) return;
    cola.current.push(s);
    ponerArreglo(s.id, { fase: 'en-cola' });
    if (colaCorriendo.current) return;
    colaCorriendo.current = true;
    for (let x = cola.current.shift(); x; x = cola.current.shift()) {
      if (!montado.current) break;
      ponerArreglo(x.id, { fase: 'aplicando' });
      const r = await pedirAplicar({ accion: 'aplicar', docId, ids: [x.id], versionAntes: true });
      if (!montado.current) break;
      if (!esAplicada(r)) { ponerArreglo(x.id, { fase: 'error', error: errorDe(r) }); continue; }
      tomarAplicada(r);
      if (r.versionAntes) ponerPila(pilaTrasAplicar(pilaRef.current, { ids: [x.id], versionAntesId: r.versionAntes.id, versionDoc: r.doc.version }, r.versionAbierta));
      avisar('Comentario aplicado', () => void deshacerRef.current());
    }
    cola.current = [];
    colaCorriendo.current = false;
  }, [docId, tomarAplicada, ponerPila, avisar]);

  /**
   * «Aplicar todos»: de a una sección, en el orden de la página. La primera vuelta que sale guarda la
   * versión de antes; las siguientes van encadenadas a la versión que dejó la anterior (`version`: si
   * alguien guardó en el medio, el server contesta conflicto y se para). Un solo «Deshacer» para todo.
   */
  const aplicarTodos = useCallback(async (base: readonly Sugerencia[]) => {
    if (docId == null || trabajando.current || colaCorriendo.current) return;
    const { grupos } = gruposParaAplicar(base, ordenRef.current);
    if (!grupos.length) return;
    trabajando.current = true;
    setTodos({ hecho: 0, total: grupos.length });
    ponerArreglos(grupos.flatMap((g) => g.ids), { fase: 'en-cola' });
    let antes: number | null = null;
    let abierta = 0;
    let version: number | undefined;
    const hechos: number[] = [];
    for (let i = 0; i < grupos.length; i++) {
      if (!montado.current) break;
      const g = grupos[i];
      ponerArreglos(g.ids, { fase: 'aplicando' });
      const r = await pedirAplicar({ accion: 'aplicar', docId, ids: g.ids, versionAntes: antes == null, ...(version ? { version } : {}) });
      if (!montado.current) break;
      setTodos({ hecho: i + 1, total: grupos.length });
      if (!esAplicada(r)) {
        ponerArreglos(g.ids, { fase: 'error', error: errorDe(r) });
        if ((r as { conflicto?: boolean }).conflicto) { ponerArreglos(grupos.slice(i + 1).flatMap((x) => x.ids), undefined); break; }
        continue;
      }
      if (antes == null && r.versionAntes) { antes = r.versionAntes.id; abierta = r.versionAbierta; }
      version = r.doc.version;
      hechos.push(...r.aplicadas.filter((a) => a.estado === 'resuelta').map((a) => a.id));
      tomarAplicada(r);
    }
    trabajando.current = false;
    if (!montado.current) return;
    setTodos(null);
    if (antes != null && version && hechos.length) {
      ponerPila(pilaTrasAplicar(pilaRef.current, { ids: hechos, versionAntesId: antes, versionDoc: version }, abierta));
      avisar(hechos.length === 1 ? 'Comentario aplicado' : `${hechos.length} comentarios aplicados`, () => void deshacerRef.current());
    }
  }, [docId, tomarAplicada, ponerPila, avisar]);

  /**
   * Deshacer lo de arriba de la pila: sólo si la landing sigue en la versión en que quedó (si alguien
   * guardó después, restaurar pisaría eso: lo dice, suelta la pila y no toca nada).
   */
  const deshacer = useCallback(async () => {
    const arriba = pilaRef.current[pilaRef.current.length - 1];
    if (docId == null || !arriba || trabajando.current || colaCorriendo.current) return;
    const como = Object.fromEntries(arriba.ids.map((id) => [id, arreglosRef.current[id]]));
    const fallar = (texto: string, soltar: boolean) => {
      setArreglos((m) => ({ ...m, ...como }));
      if (soltar) ponerPila([]);
      avisar(texto);
    };
    trabajando.current = true;
    ponerArreglos(arriba.ids, { fase: 'deshaciendo' });
    try {
      const a = await pedirDocs({ accion: 'abrir', id: docId });
      if (!a.ok) { fallar('No se pudo deshacer', false); return; }
      if (a.doc.version !== arriba.versionDoc) { fallar('La landing ya cambió', true); return; }
      const r = await pedirDocs({ accion: 'restaurarVersion', id: docId, versionId: arriba.versionAntesId });
      if (!r.ok) { fallar(r.conflicto ? 'La landing ya cambió' : 'No se pudo deshacer', r.conflicto === true); return; }
      setDoc(r.doc);
      ponerPila(pilaTrasDeshacer(pilaRef.current, r.doc.version));
      // Los comentarios vuelven a pendientes (de a uno: es la ruta de siempre).
      for (const id of arriba.ids) {
        const e = await pedirDiagnostico({ accion: 'estado', id, estado: 'pendiente' });
        if (e.ok && 'sugerencia' in e) setSugerencias((xs) => xs.map((x) => (x.id === id ? e.sugerencia : x)));
      }
      ponerArreglos(arriba.ids, undefined);
      avisar('Cambio deshecho');
    } finally {
      trabajando.current = false;
    }
  }, [docId, ponerPila, avisar]);
  useLayoutEffect(() => { deshacerRef.current = deshacer; });

  // ── Replicar (una de afuera) ────────────────────────────────────────────────
  // Los 3 formatos (decisión d de Martín). Con la página ya leída en el navegador, la lectura viaja y el
  // server no la baja de nuevo (la «Página web» necesita el HTML: ésa no la usa).
  // Tanda 7: es un CLIC (el menú, o «Replicar como…» de la falla): la ventana se abre primero, sin nada antes, y
  // sólo si puede hacer falta (`pideVentana`, y no si el server ya la leyó en esta visita).
  const replicar = useCallback((formato: FormatoReplicar) => {
    const lectura = ultimaLectura.current;
    const ventana = urlPegada && pideVentana(formato, { lectura }) && !leidaEnServer.current ? abrirEnElClic() : null;
    setMenuReplicar(null);
    if (!urlPegada) return;
    afuera.current = null;
    setParaAplicar(false);
    void pedirReplica(urlPegada, formato, lectura && formato !== 'web' ? { lectura } : { ventana });
  }, [urlPegada, pedirReplica]);

  /**
   * La copia de una página de afuera ya existe (replicada para APLICAR): se le pasan los comentarios y se
   * abre SU diagnóstico, que aplica lo pedido una vez (`dejarUnaVez`). Si pasarlos falla, igual se abre:
   * sin comentarios, el diagnóstico de la copia la analiza solo.
   */
  const pasarYAbrir: AlReplicar = useCallback(async ({ id }: { id: number }) => {
    const que = afuera.current;
    // `resolver` (tanda 7): los de afuera que se mandaron a aplicar quedan RESUELTOS acá; se aplican en la
    // copia (el server los marca DESPUÉS de copiarlos pendientes, diagnostico-aplicar.ts).
    const r = urlPegada ? await pedirAplicar({ accion: 'pasar', url: urlPegada, docId: id, ...(que ? { resolver: que } : {}) }) : null;
    if (r && esPasada(r) && r.resueltas.length) {
      setSugerencias((xs) => xs.map((x) => (r.resueltas.includes(x.id) ? { ...x, estado: 'resuelta' as const } : x)));
    }
    if (r && esPasada(r) && que) {
      const ids = que === 'todos' ? [] : que.map((x) => r.mapa[String(x)]).filter((n): n is number => !!n);
      dejarUnaVez({ docId: id, t: Date.now(), ...(que === 'todos' ? { todos: true as const } : { ids }) });
    }
    irDuro(`/web-generator?diagnostico=${id}`, ws);
  }, [urlPegada, ws]);

  /**
   * «Aplicar» en una landing de AFUERA: replicarla como Landing (con la lectura del navegador si ya está).
   * Si ya hay una copia de esta página (`copia`), se usa ESA: se le pasan los comentarios y se abre su
   * Diagnóstico, sin volver a replicar (verificación de la tanda 6: cada «Aplicar» armaba otra copia, con IA
   * paga y minutos de espera; «nunca duplicar»). Para una copia nueva queda «Replicar en el editor».
   */
  const [abriendoCopia, setAbriendoCopia] = useState(false);
  const aplicarAfuera = useCallback((que: number[] | 'todos') => {
    if (!urlPegada) return;
    // Tanda 7: un CLIC («Aplicar», «Aplicar todos»): si va a replicar, la ventana se abre primero, sin nada antes.
    const lectura = ultimaLectura.current;
    const ventana = copia == null && pideVentana('landing', { lectura }) && !leidaEnServer.current ? abrirEnElClic() : null;
    afuera.current = que;
    setParaAplicar(true);
    setRecorrido((r) => ({ ...r, abierto: false }));
    if (copia != null) { setAbriendoCopia(true); void pasarYAbrir({ id: copia, titulo: '' }); return; }
    void pedirReplica(urlPegada, 'landing', lectura ? { lectura } : { ventana }, pasarYAbrir);
  }, [urlPegada, copia, pedirReplica, pasarYAbrir]);

  /** «Aplicar» de un comentario: en una nuestra, a la cola; en una de afuera, replicar primero. */
  const aplicar = useCallback((s: Sugerencia) => {
    if (deNuestra) void aplicarUno(s);
    else aplicarAfuera([s.id]);
  }, [deNuestra, aplicarUno, aplicarAfuera]);

  // El diagnóstico de una COPIA recién replicada para aplicar: lo pedido, una vez, cuando ya cargó.
  useEffect(() => {
    if (cargando || !unaVez.current) return;
    const u = unaVez.current;
    unaVez.current = null;
    if (u.todos) { void aplicarTodos(sugerencias); return; }
    const elegida = sugerencias.find((x) => u.ids?.includes(x.id) && x.estado === 'pendiente');
    if (elegida?.seccionId) void aplicarUno(elegida);
    else if (u.ids?.length) avisar('No ubiqué esa sección');
  }, [cargando, sugerencias, aplicarTodos, aplicarUno, avisar]);

  // ── Preguntar a MaKo ───────────────────────────────────────────────────────
  const preguntar = useCallback((s: Sugerencia) => {
    setRecorrido((r) => ({ ...r, abierto: false }));
    setChat(s);
  }, []);
  // En el teléfono la columna va DEBAJO de la vista (60vh): el chat se trae a la pantalla al abrirlo, si no
  // quedaba abajo y el toque parecía no hacer nada (medido a 390 px). En la computadora ya está a la vista.
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!chat || typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 980px)').matches) return;
    chatRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [chat]);

  // ── Lo que se dibuja ───────────────────────────────────────────────────────
  const cuenta = (e: EstadoSugerencia) => sugerencias.filter((s) => s.estado === e).length;
  const nombre = deNuestra ? (doc?.titulo || 'Landing') : hostDe(urlVista ?? '');
  const enCurso = Object.values(arreglos).some((a) => a?.fase === 'aplicando' || a?.fase === 'en-cola' || a?.fase === 'deshaciendo');
  const ocupado = !!todos || replicando || abriendoCopia || Object.values(arreglos).some((a) => a?.fase === 'deshaciendo');
  const puedeAplicar = (s: Sugerencia) => s.estado === 'pendiente' && (deNuestra ? !!s.seccionId : !!urlPegada);
  const aplicables = pendientes.filter(puedeAplicar).length;
  const visibles = sugerencias.filter((s) => s.estado === filtro
    || (filtro === 'pendiente' && recientes.includes(s.id) && arreglos[s.id]?.fase === 'aplicado'));
  const contextoChat = (s: Sugerencia): string => {
    const b = s.seccionId ? bloques.find((x) => x.id === s.seccionId) : null;
    return contextoDeComentario({
      hallazgo: s.hallazgo, cita: s.cita, landing: nombre, url: deNuestra ? doc?.urlPublica ?? null : urlVista,
      deAfuera: !deNuestra, seccion: b ? { titulo: b.titulo, texto: b.texto } : null,
    });
  };
  const objetivoChat = deNuestra && docId != null ? { docId } : { url: urlVista ?? url ?? '' };

  return (
    <section className="gdg" aria-label="Diagnóstico">
      <style href="gm-contenido" precedence="medium">{CSS_CONTENIDO}</style>
      <style href="gdg-panel" precedence="medium">{CSS_PANEL_DIAGNOSTICO}</style>
      {tema && <link rel="stylesheet" href={urlFuentes([tema])} precedence="default" />}

      <header className="gdg-cab">
        <div className="gdg-cab-titulos">
          <span className="gdg-cab-rotulo">Diagnóstico</span>
          <h2 className="gdg-cab-nombre" title={deNuestra ? nombre : urlVista ?? ''}>{nombre}</h2>
          {resumen && (resumen.score != null || resumen.veredicto) && (
            <p className="gdg-cab-veredicto">
              {resumen.score != null && <span className="gdg-score">{resumen.score}/10</span>}
              {resumen.veredicto && <span>{resumen.veredicto}</span>}
            </p>
          )}
        </div>
        <div className="gdg-cab-acciones">
          <button type="button" className="gp-btn gp-btn-primario" disabled={!pendientes.length || analizando} onClick={() => abrirRecorrido()}>
            <Ico n="play" t={14} /> Ver recorrido
          </button>
          {/* Tanda 7: la ventana se abre EN ESTE clic (de afuera), primera cosa y sin nada antes. */}
          <button type="button" className="gp-btn gp-btn-contorno" disabled={analizando || cargando} onClick={() => void analizar({ ventana: !deNuestra && urlPegada ? abrirEnElClic() : null })}>
            <Ico n="refrescar" t={14} /> {sugerencias.length || resumen ? 'Volver a analizar' : 'Analizar'}
          </button>
          {deNuestra && docId != null && (
            <Link href={`/web-generator/${docId}`} className="gp-btn gp-btn-contorno"><Ico n="lapiz" t={14} /> Abrir en el editor</Link>
          )}
          {!deNuestra && (
            <button type="button" className="gp-btn gp-btn-contorno" disabled={replicando || !urlPegada} aria-haspopup="menu" aria-expanded={!!menuReplicar} onClick={(e) => setMenuReplicar(menuReplicar ? null : e.currentTarget)}>
              {replicando ? <span className="gp-giro" aria-hidden /> : <Ico n="copiar" t={14} />} Replicar en el editor <Ico n="chevron-abajo" t={12} />
            </button>
          )}
          <button type="button" className="gdg-cerrar" aria-label="Cerrar diagnóstico" title="Cerrar" onClick={onCerrar}><Ico n="cerrar" t={16} /></button>
        </div>
      </header>
      {replicando && (
        <p className="gdg-cab-nota">
          <span className="gp-giro" aria-hidden /> {estadoReplicar.fase === 'replicando' && estadoReplicar.leyendo ? 'Leyendo la página…' : paraAplicar ? 'Copiando al editor para aplicar… unos minutos.' : 'Replicando… puede tardar unos minutos.'}
        </p>
      )}
      {abriendoCopia && <p className="gdg-cab-nota">Abriendo tu copia…</p>}
      {estadoReplicar.fase === 'falla' && urlPegada && (estadoReplicar.enNavegador || estadoReplicar.pegable) ? (
        <LeerOPegar
          key={`replicar|${estadoReplicar.formato}|${estadoReplicar.salida?.motivo ?? ''}`}
          url={urlPegada}
          error={estadoReplicar.error}
          enNavegador={estadoReplicar.enNavegador}
          ocupado={replicando}
          accionTexto="Replicar este texto"
          texto="MaKo no pudo leerla para replicarla."
          salida={estadoReplicar.salida}
          onLectura={(lectura) => { ultimaLectura.current = lectura; void pedirReplica(urlPegada, estadoReplicar.formato, { lectura }, afuera.current ? pasarYAbrir : undefined); }}
          onTexto={(texto) => void pedirReplica(urlPegada, estadoReplicar.formato, { texto }, afuera.current ? pasarYAbrir : undefined)}
        />
      ) : estadoReplicar.fase === 'falla' ? (
        <FallaReplicar clase="gdg-error" error={estadoReplicar.error} probar={urlPegada ? estadoReplicar.probar : null} deshabilitado={replicando} onProbar={replicar} />
      ) : null}
      {menuReplicar && (
        <MenuFlotante ancla={menuReplicar} onCerrar={() => setMenuReplicar(null)} ancho={220} alinear="derecha">
          {FORMATOS_REPLICAR.map((f) => (
            <ItemMenu key={f} icono={ICONO_FORMATO[f]} texto={NOMBRE_FORMATO_REPLICAR[f]} onClick={() => replicar(f)} />
          ))}
        </MenuFlotante>
      )}

      <div className="gdg-cuerpo">
        <div className="gdg-col-vista">
          {deNuestra
            ? (html
              ? <VistaNuestra html={html} objetivos={objetivos} controlRef={controlRef} senal={senal} onUbicar={onUbicar} />
              : <div className="gdg-vista gdg-vista-cargando gp-brillo" aria-hidden />)
            : (urlPegada
              ? <VistaAfuera url={urlPegada} objetivos={objetivos} controlRef={controlRef} senal={senal} onUbicar={onUbicar} />
              : <div className="gdg-vista" />)}
        </div>

        <aside className="gdg-col-lista" aria-label={chat ? 'Preguntar a MaKo' : 'Comentarios'}>
          {chat ? (
            <div ref={chatRef} className="gdg-chat">
              <div className="gdg-chat-cab">
                <button type="button" className="gp-btn gp-btn-fantasma" onClick={() => setChat(null)}><Ico n="flecha-izquierda" t={14} /> Comentarios</button>
              </div>
              <p className="gdg-chat-tit">{chat.hallazgo.titulo}</p>
              <div className="gdg-chat-cuerpo">
                <MakoChat
                  key={chat.id}
                  chartKey={claveChatDeComentario(objetivoChat, chat.id)}
                  titulo={chat.hallazgo.titulo.slice(0, 120)}
                  contexto={contextoChat(chat)}
                  sugerencias={SUGERENCIAS_CHAT}
                />
              </div>
            </div>
          ) : (
            <>
              <Filtros
                valor={filtro}
                onCambio={setFiltro}
                etiqueta="Filtrar comentarios"
                opciones={[
                  { valor: 'pendiente', texto: `Pendientes ${cuenta('pendiente')}` },
                  { valor: 'resuelta', texto: `Resueltas ${cuenta('resuelta')}` },
                  { valor: 'descartada', texto: `Descartadas ${cuenta('descartada')}` },
                ]}
              />
              {filtro === 'pendiente' && (todos || aplicables >= 2) && (
                <div className="gdg-todos">
                  {todos
                    ? <p className="gdg-trabajando"><span className="gp-giro" aria-hidden /> Aplicando sección {Math.min(todos.hecho + 1, todos.total)} de {todos.total}…</p>
                    : (
                      <button type="button" className="gp-btn gp-btn-ia" disabled={ocupado || enCurso} onClick={() => (deNuestra ? void aplicarTodos(sugerencias) : aplicarAfuera('todos'))}>
                        <Ico n="destellos" t={14} /> Aplicar todos
                      </button>
                    )}
                </div>
              )}
              {analizando && (
                <p className="gdg-trabajando"><span className="gp-giro" aria-hidden /> {leyendoPagina ? 'Leyendo la página…' : 'Analizando… puede tardar 1-2 minutos.'}</p>
              )}
              {/* Tanda 6: el «No pude leer…» ya no es un callejón. Si el server no pudo, leerla en el navegador de la
                  persona o pegar su texto (LeerOPegar). Una landing NUESTRA se lee de su contenido: nunca llega acá.
                  Tanda 7: en el camino normal la lectura ya volvió sola por la ventana del clic; esto es la salida
                  de un fallo de ese camino (`salida`: bloqueada, sin texto, cerrada o sin respuesta). */}
              {error && (pegable || enNavegador) && urlPegada ? (
                <LeerOPegar
                  key={`analizar|${enNavegador ? 'n' : 'p'}|${salida?.motivo ?? ''}`}
                  url={urlPegada}
                  error={error}
                  enNavegador={enNavegador}
                  ocupado={analizando}
                  accionTexto="Analizar este texto"
                  salida={salida}
                  onLectura={(lectura) => void analizar({ lectura })}
                  onTexto={(texto) => void analizar({ texto })}
                />
              ) : error ? <p className="gdg-error" role="alert">{error}</p> : null}
              {cargando && !analizando && <p className="gdg-vacio"><span className="gp-giro" aria-hidden /></p>}
              {!cargando && !analizando && !error && !sugerencias.length && resumen && <p className="gdg-vacio">MaKo no encontró nada que señalar.</p>}
              {!cargando && sugerencias.length > 0 && !visibles.length && <p className="gdg-vacio">No hay comentarios aquí.</p>}
              <ul className="gdg-lista">
                {visibles.map((s) => (
                  <Comentario
                    key={s.id}
                    s={s}
                    activa={activa === s.id}
                    ubicacion={controlRef.current ? controlRef.current.ubicacion(s.id) : undefined}
                    tema={tema}
                    formato={doc ? formatoDe(doc.config) : 'pagina'}
                    proporcion={doc ? proporcionDe(doc.config) : '16:9'}
                    arreglo={arreglos[s.id]}
                    puedeAplicar={puedeAplicar(s)}
                    ocupado={ocupado}
                    onVer={() => abrirRecorrido(s.id)}
                    onEstado={(e) => void cambiarEstado(s, e)}
                    onAplicar={() => aplicar(s)}
                    onPreguntar={() => preguntar(s)}
                    onDeshacer={!enCurso && sePuedeDeshacer(pila, s.id) && arreglos[s.id]?.fase === 'aplicado' ? () => void deshacer() : undefined}
                    onVerCopia={!deNuestra && copia != null && s.estado === 'resuelta' ? () => irDuro(`/web-generator?diagnostico=${copia}`, ws) : undefined}
                  />
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      <RecorridoDiagnostico
        pasos={recorrido.pasos}
        abierto={recorrido.abierto}
        desde={recorrido.desde}
        ir={irA}
        caja={cajaDe}
        senal={senal}
        onPaso={setActiva}
        onCerrar={cerrarRecorrido}
        acciones={(id, paso) => {
          const s = sugerencias.find((x) => x.id === id);
          if (!s) return null;
          return (
            <>
              {puedeAplicar(s) && (!arreglos[s.id] || arreglos[s.id]?.fase === 'error') && (
                <Button variant="secondary" size="sm" disabled={ocupado} onClick={() => { aplicar(s); if (deNuestra) paso.siguiente(); }}>Aplicar</Button>
              )}
              <Button variant="tertiary" size="sm" onClick={() => preguntar(s)}>Preguntar a MaKo</Button>
            </>
          );
        }}
      />
      {aviso}
    </section>
  );
}

/** La hoja del panel (scope `.gdg`, adentro del `.gp` del Panel: los botones y menús son los de Gamma). */
const CSS_PANEL_DIAGNOSTICO = `
/* Alto de la VENTANA (como la barra lateral del Panel, sticky a 100vh): la vista y la lista scrollean
   por dentro y el recorrido mide contra lo que se ve. La derecha del Panel le saca el padding
   (.gp-contenido[data-vista="diagnostico"], Inicio.tsx): el aire va aquí. */
.gdg { display: flex; flex-direction: column; height: 100vh; height: 100dvh; box-sizing: border-box; padding: 16px 20px; min-width: 0; gap: 12px; }
.gdg-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.gdg-cab-titulos { min-width: 0; flex: 1 1 240px; }
.gdg-cab-rotulo { font-size: 12px; font-weight: 600; color: var(--gp-tenue, #6b6b72); text-transform: uppercase; letter-spacing: .04em; }
.gdg-cab-nombre { margin: 2px 0 0; font-size: 20px; font-weight: 650; color: var(--gp-titulo, #18181b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gdg-cab-veredicto { display: flex; align-items: center; gap: 8px; margin: 4px 0 0; font-size: 13.5px; color: var(--gp-tenue, #6b6b72); }
.gdg-score { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 9999px; background: var(--gp-azul-100, #e0edff); color: var(--gp-azul-800, #1e3a8a); font-weight: 650; font-variant-numeric: tabular-nums; }
.gdg-cab-acciones { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gdg-cab-nota { display: flex; align-items: center; gap: 8px; margin: -6px 0 0; font-size: 13px; color: var(--gp-tenue, #6b6b72); }
.gdg-cerrar { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 0; border-radius: 9999px; background: transparent; color: var(--gp-texto, #27272a); cursor: pointer; }
.gdg-cerrar:hover { background: var(--gp-hover, rgba(0,0,0,.06)); }
.gdg-cuerpo { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 380px); gap: 16px; }
.gdg-col-vista { min-width: 0; min-height: 0; display: flex; }
.gdg-vista { position: relative; flex: 1 1 auto; min-height: 420px; border: 1px solid var(--gp-borde, #e4e4e7); border-radius: 12px; overflow: auto; background: var(--gp-superficie, #fff); }
.gdg-vista--nuestra { container-type: inline-size; overscroll-behavior: contain; }
.gdg-vista--nuestra .gdg-lienzo .gm-doc { --gm-base: calc(100cqw / 68.5); --gm-base-movil: calc(100cqw / 68.5); }
/* El rótulo de cada página cuando la landing tiene varias (htmlDeVistaDiagnostico): lo dibuja el CSS desde
   el atributo, así no es un nodo de texto donde una cita se pueda ubicar. */
.gdg-pagina { padding: 6px 14px; background: var(--gp-superficie-2, #f4f4f5); border-bottom: 1px solid var(--gp-borde, #e4e4e7); font: 600 12px/1.4 system-ui, sans-serif; color: var(--gp-tenue, #6b6b72); text-transform: uppercase; letter-spacing: .04em; }
.gdg-pagina::before { content: attr(data-titulo); }
.gdg-vista--afuera { overflow: hidden; display: flex; }
.gdg-iframe { flex: 1 1 auto; width: 100%; height: 100%; min-height: 420px; border: 0; display: block; background: #fff; }
.gdg-vista-cargando { border: 0; }
.gdg-vista-aviso { position: absolute; inset: auto 16px 16px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 10px; background: var(--gp-menu-fondo, #fff); box-shadow: var(--gp-sombra-menu, 0 8px 16px rgba(0,0,0,.12)); font-size: 13.5px; color: var(--gp-texto, #27272a); }
.gdg-vista-aviso p { margin: 0; }
.gdg-col-lista { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 2px; }
.gdg-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.gdg-trabajando, .gdg-com-trabajando { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13.5px; color: var(--gp-tenue, #6b6b72); }
.gdg-error, .gdg-com-error { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--gp-peligro-fondo, #fdecec); color: var(--gp-peligro, #b42318); font-size: 13.5px; }
.gdg-vacio { margin: 0; padding: 24px 0; text-align: center; color: var(--gp-tenue, #6b6b72); font-size: 14px; }
.gdg-com { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border: 1px solid var(--gp-borde, #e4e4e7); border-radius: 12px; background: var(--gp-superficie, #fff); transition: border-color .15s, box-shadow .15s; }
.gdg-com[data-activa="si"] { border-color: var(--gp-azul-500, #3b82f6); box-shadow: 0 0 0 1px var(--gp-azul-500, #3b82f6); }
.gdg-com[data-estado="resuelta"], .gdg-com[data-estado="descartada"] { opacity: .78; }
.gdg-com-cab { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.gdg-sev { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 9999px; font-size: 11.5px; font-weight: 650; background: var(--gp-azul-100, #e0edff); color: var(--gp-azul-800, #1e3a8a); }
.gdg-sev[data-sev="alta"] { background: var(--gp-peligro-fondo, #fdecec); color: var(--gp-peligro, #b42318); }
.gdg-sev[data-sev="media"] { background: #fff4e0; color: #9a5b00; }
[data-tema="oscuro"] .gdg-sev[data-sev="media"] { background: #3d2a05; color: #f5c46b; }
.gdg-com-estado, .gdg-com-sin { font-size: 12px; font-weight: 600; color: var(--gp-tenue, #6b6b72); }
.gdg-com-estado--ok { display: inline-flex; align-items: center; gap: 4px; color: var(--gp-exito, #067647); }
[data-tema="oscuro"] .gdg-com-estado--ok { color: #6ce9a6; }
.gdg-todos { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gdg-todos .gp-btn { height: 30px; padding: 0 12px; font-size: 13px; }
/* «Preguntar a MaKo»: el chat de la casa (MakoChat) ocupa la columna; su raíz mide 100% del alto. */
.gdg-chat { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.gdg-chat-cab { display: flex; align-items: center; }
.gdg-chat-cab .gp-btn { height: 28px; padding: 0 10px; font-size: 13px; }
.gdg-chat-tit { margin: 0; font-size: 14px; font-weight: 650; line-height: 1.35; color: var(--gp-titulo, #18181b); }
.gdg-chat-cuerpo { flex: 1 1 auto; min-height: 420px; border: 1px solid var(--gp-borde, #e4e4e7); border-radius: 12px; overflow: hidden; background: var(--surface, #fff); }
.gdg-com-tit { all: unset; cursor: pointer; font-size: 14.5px; font-weight: 650; line-height: 1.35; color: var(--gp-titulo, #18181b); }
.gdg-com-tit:hover { text-decoration: underline; }
.gdg-com-tit:focus-visible { outline: 2px solid var(--gp-azul-500, #3b82f6); outline-offset: 2px; border-radius: 4px; }
.gdg-com-cita { margin: 0; padding-left: 10px; border-left: 3px solid var(--gp-borde, #e4e4e7); font-size: 13px; font-style: italic; color: var(--gp-tenue, #6b6b72); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.gdg-com-arreglo { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--gp-texto, #27272a); }
.gdg-com-porque { font-size: 13px; color: var(--gp-tenue, #6b6b72); }
.gdg-com-porque summary { cursor: pointer; font-weight: 600; }
.gdg-com-porque p { margin: 4px 0 0; line-height: 1.5; }
.gdg-com-acciones { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
.gdg-com-acciones .gp-btn { height: 28px; padding: 0 10px; font-size: 13px; }
.gdg-com-revision { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.gdg-segmento { display: inline-flex; align-self: flex-start; padding: 2px; border-radius: 999px; background: var(--gp-superficie-2, #f4f4f5); gap: 2px; }
.gdg-segmento > button { height: 26px; padding: 0 11px; border: 0; border-radius: 999px; background: transparent; color: var(--gp-tenue, #6b6b72); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.gdg-segmento > button[aria-pressed="true"] { background: var(--gp-superficie, #fff); color: var(--gp-texto, #27272a); box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.gdg-com-mini { border: 1px solid var(--gp-borde-suave, #f0f0f2); border-radius: 8px; overflow: hidden; }
@media (max-width: 980px) {
  .gdg { height: auto; min-height: 100dvh; padding: 12px 16px; }
  .gdg-cuerpo { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(360px, 60vh) auto; }
  .gdg-col-lista { overflow: visible; }
  .gdg-chat-cuerpo { flex: none; height: 72dvh; min-height: 0; }
}
`;
