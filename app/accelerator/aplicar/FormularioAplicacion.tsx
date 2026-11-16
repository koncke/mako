'use client';

// =============================================================================
// El formulario de aplicación a MaKo Accelerator (16/11/2026): un paso por sección, y al final el gracias y la prueba de MaKo
// =============================================================================
// Martín, 16/11/2026: «yo no pondría el botón de agendar llamada, sino justamente el botón de aplicar ahora. Y ahí pondría
// justamente un formulario… muy similar [al de Mastery Haus]. El formulario evidentemente tiene que funcionar… y debería estar
// evidentemente bien diseñado todo».
//
// LAS PREGUNTAS, CÓMO SE VALIDAN Y QUIÉN CALIFICA son el contrato (lib/aplicacion-accelerator.ts): el mismo que vuelve a leer
// el servidor. Acá, cómo se recorren:
//   · UN PASO POR SECCIÓN (seis), con la barra de seis tramos y «Paso N de 6 · <la sección>». Al tocar «Siguiente» se marcan los
//     errores de ese paso (`errorDelCampo`), el foco va al primero, y desde ahí se corrigen EN VIVO mientras escribe o elige.
//   · Cada tipo, su control: texto, email y link son un input con su teclado y su autocompletado (./reglas.ts, `entradaDe`); el
//     WhatsApp, el código de país que se ELIGE y el número (`TelefonoConPais`, el del checkout: revisión del 16/11/2026, un número
//     local se guardaba con el país equivocado), arrancando en el país de donde está la persona (`ladaInicial`); las largas, un
//     textarea que crece, con el contador cerca del tope; las de una opción, tarjetas con radios de verdad dentro de un fieldset
//     (se eligen con las flechas); las de varias, con casilleros; el compromiso, un casillero.
//   · EL BORRADOR vive en el navegador (`CLAVE_BORRADOR`, con su versión y la campaña con que llegó): si cierra la pestaña, retoma
//     donde lo dejó. Se borra al enviar bien. Sin almacenamiento (una ventana privada), el formulario anda igual.
//   · El POST va a `API_APLICAR` con `{ respuestas, web, origen }`: las opciones viajan como ÍNDICES; `web` es el campo trampa.
//     Si el servidor marca un `campo`, vuelve a su paso y lo marca.
//   · EL INSTAGRAM Y EL YOUTUBE (16/11/2026): escribe su @, su nombre o pega el link, y la búsqueda de Competitor Spy
//     (`API_CANAL`) le ofrece las cuentas para que elija la suya (`CampoCanal`). Si la búsqueda no anda, lo escrito vale igual.
//   · LA PANTALLA FINAL, LA MISMA PARA TODOS (16/11/2026, Martín: «no tiene sentido de que automaticemos… siempre debería ser
//     gracias, voy a revisar tu aplicación, te responderé en máximo 24 horas… estate atento a tu WhatsApp y a tu email»): el
//     gracias, el video de Martín (`VIDEO_DE_GRACIAS`) y el paso siguiente, «obligatorio» al final de toda aplicación: la prueba
//     gratuita de MaKo o «Ya hice la prueba gratuita»; con cuenta, «Entrar a MaKo». NADIE ve la agenda de Calendly al aplicar
//     (hasta esa tarde la veía quien calificaba): `califica` queda para el correo de Martín y la ficha. La aplicación enviada queda
//     una semana en el navegador (sólo el nombre y si tiene cuenta, `enviadaParaGuardar`): quien vuelve ve su pantalla final.
// Habla Martín, en primera persona: no hay equipo (memoria «sin-equipo-todavia»).
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, Check, Play } from 'lucide-react';
import {
  API_APLICAR, API_CANAL, LARGO_MAXIMO, SECCIONES, campo as campoDe, campoVisible, errorDelCampo, erroresDeLaSeccion, queBuscarDelCanal,
  tieneCuentaDeMako, type Campo, type Respuestas, type Valor,
} from '@/lib/aplicacion-accelerator';
import { PROGRAMA_ACELERADOR, PRUEBA_DIAS } from '@/lib/planes-mako';
import type { OrigenCompra } from '@/lib/compra-plan-reglas';
import { telefonoDeFormulario } from '@/lib/paises';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import {
  CLAVE_BORRADOR, CLAVE_ENVIADA, ID_TRAMPA, NOMBRE_TRAMPA, ROTULO_TRAMPA, VIDEO_DE_GRACIAS, borradorLimpio, borradorParaGuardar, enUnaColumna,
  entradaDe, enviadaLimpia, enviadaParaGuardar, filasDeLaSeccion, idDelCampo, linkDeLaPrueba, nombreDelSaludo, origenDelReferer, pasoDelCampo,
  telefonoDelBorrador,
} from './reglas';

const TOTAL = SECCIONES.length;
const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ERROR_DE_RED = 'No se pudo conectar. Revisa tu internet y prueba otra vez: lo que escribiste sigue guardado.';
const ERROR_DEL_ENVIO = 'No se pudo enviar tu aplicación. Prueba otra vez en un minuto.';

type Pendiente = { a: 'titulo' } | { a: 'campo'; id: string } | { a: 'final' };
/** El WhatsApp como se ve: el código de país elegido y el número sin él (`TelefonoConPais`). La respuesta es `+` y los dígitos. */
type Telefono = { lada: string; numero: string };

export function FormularioAplicacion({ origen, clavesOrigen, rutaPrueba, rutaEntrar, ladaInicial }: {
  /** La campaña que trajo la URL de esta página (lo lee page.tsx con `origenLimpio`). */
  origen: OrigenCompra | null;
  /** Qué parámetros de la URL son de la campaña (`CLAVES_ORIGEN`): para leerlos de la página anterior si esta URL no los trae. */
  clavesOrigen: readonly string[];
  /** El checkout de la prueba gratuita de la pantalla final (MaKo Pro); le suma la campaña (`linkDeLaPrueba`). */
  rutaPrueba: string;
  /** «Entrar a MaKo» y «Ya hice la prueba gratuita» de la pantalla final: el login. */
  rutaEntrar: string;
  /** El código de país que arranca elegido en el WhatsApp: el de donde está la persona (page.tsx, `ladaDelPais`). Lo puede cambiar. */
  ladaInicial: string;
}) {
  const [paso, setPaso] = useState(0);
  const [r, setR] = useState<Respuestas>({});
  const [tel, setTel] = useState<Telefono>({ lada: ladaInicial, numero: '' });
  /** Los pasos donde ya se tocó «Siguiente»: ahí los errores se muestran, y en vivo. */
  const [intentados, setIntentados] = useState<readonly number[]>([]);
  /** El error que marcó el servidor en un campo: se va cuando la persona cambia ese valor. */
  const [delServidor, setDelServidor] = useState<{ campo: string; texto: string; valor: Valor | undefined } | null>(null);
  const [web, setWeb] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  /** La pantalla final, la misma para todos (16/11/2026): ya se envió, o vuelve en la semana (`CLAVE_ENVIADA`). */
  const [final, setFinal] = useState(false);
  /** Retomó un borrador: 'todo', o 'telefono' si su WhatsApp era de antes del selector de país (sin país: que lo mire). */
  const [retomada, setRetomada] = useState<'todo' | 'telefono' | null>(null);
  /**
   * Donde se dibuja el menú del código de país: adentro del formulario (toma sus colores, ./estilo.ts `.apl-menus`) y FUERA de
   * los campos. ⚠️ Los campos entran con una animación de `transform` (`.apl-entra`): un menú `position: fixed` adentro de ellos
   * se ubica contra ESA caja mientras dura, y al enfocar su buscador la página saltaba y el menú se cerraba (medido el 16/11/2026,
   * abriéndolo apenas cargado el paso).
   */
  const [menus, setMenus] = useState<HTMLDivElement | null>(null);
  const [listo, setListo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [, forzar] = useState(0);
  const pendiente = useRef<Pendiente | null>(null);
  /** Un envío en vuelo: el doble Enter no manda dos aplicaciones (el estado `enviando` llega un render tarde). */
  const enVuelo = useRef(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const tituloFinal = useRef<HTMLHeadingElement>(null);
  const tarjeta = useRef<HTMLFormElement>(null);
  const origenDelEnvio = useRef<OrigenCompra | Record<string, string> | null>(origen);

  // Lo guardado, una vez y después de hidratar (el servidor no ve el navegador). Retomar NO mueve el foco ni la página. Primero, la
  // aplicación ya ENVIADA (vuelve a su pantalla final); si no, el borrador.
  useEffect(() => {
    const leer = (clave: string): unknown => {
      try {
        const crudo = window.localStorage.getItem(clave);
        return crudo ? JSON.parse(crudo) : null;
      } catch {
        // Sin almacenamiento (una ventana privada, o bloqueado) o algo que no es JSON: como si no hubiera nada.
        return null;
      }
    };
    const enviada = enviadaLimpia(leer(CLAVE_ENVIADA), Date.now());
    const b = enviada ? null : borradorLimpio(leer(CLAVE_BORRADOR), Date.now(), clavesOrigen);
    if (enviada) {
      setR(enviada.respuestas);
      setFinal(true);
      // Una de antes (con lo que leía la agenda): se vuelve a guardar sólo con lo que esta pantalla usa.
      if (enviada.reescribir) {
        try { window.localStorage.setItem(CLAVE_ENVIADA, enviadaParaGuardar(enviada.respuestas, Date.now())); } catch { /* bloqueado */ }
      }
    } else if (b) {
      // El WhatsApp, al selector de país: el guardado puede ser de antes del selector, sin país (`telefonoDelBorrador`).
      const t = telefonoDelBorrador(b.respuestas.whatsapp, ladaInicial);
      const respuestas = { ...b.respuestas };
      if (t.whatsapp) respuestas.whatsapp = t.whatsapp; else delete respuestas.whatsapp;
      setTel({ lada: t.lada, numero: t.numero });
      setR(respuestas);
      setPaso(b.paso);
      setRetomada(t.revisar ? 'telefono' : 'todo');
      // La campaña con que llegó la primera vez, si esta visita no trae otra (la de la URL, o la de la página anterior, abajo).
      if (!origen && b.origen) origenDelEnvio.current = b.origen;
    }
    setListo(true);
    // Una vez, al hidratar: las props no cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La campaña: la de esta URL; si no trae, la de la página de la que vino (la landing con su ?utm_…); si tampoco, la del borrador.
  useEffect(() => {
    if (origen) return;
    const delReferer = origenDelReferer(document.referrer, window.location.href, clavesOrigen);
    if (delReferer) origenDelEnvio.current = delReferer;
  }, [origen, clavesOrigen]);

  // Lo que escribe se guarda mientras escribe (nunca antes de haber leído el borrador: lo pisaría vacío), con la campaña.
  useEffect(() => {
    if (!listo || final || !Object.keys(r).length) return;
    try {
      window.localStorage.setItem(CLAVE_BORRADOR, borradorParaGuardar(paso, r, Date.now(), origenDelEnvio.current as Record<string, string> | null));
    } catch {
      // Lleno o bloqueado: el formulario sigue igual.
    }
  }, [r, paso, listo, final]);

  // El foco, DESPUÉS de dibujar: al título del paso nuevo, al primer campo con error, o al título de la pantalla final.
  useEffect(() => {
    const p = pendiente.current;
    if (!p) return;
    pendiente.current = null;
    if (p.a === 'campo') { enfocarCampo(p.id); return; }
    if (p.a === 'final') {
      tituloFinal.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
      return;
    }
    titulo.current?.focus({ preventScroll: true });
    // Sólo si el principio de la tarjeta quedó arriba, debajo de la barra fija: si se ve, la página no salta.
    const t = tarjeta.current;
    if (t && t.getBoundingClientRect().top < 80) t.scrollIntoView({ block: 'start' });
  });

  const seccion = SECCIONES[paso];
  const errores: Record<string, string> = intentados.includes(paso) ? erroresDeLaSeccion(seccion, r) : {};
  const errorDe = (c: Campo): string | null => errores[c.id]
    ?? (delServidor && delServidor.campo === c.id && Object.is(r[c.id], delServidor.valor) ? delServidor.texto : null);

  function anunciar(m: string) {
    // El mismo texto dos veces seguidas no se vuelve a leer: se le cambia un espacio invisible.
    setAviso((antes) => (antes === m ? `${m} ` : m));
  }

  function cambiar(id: string, v: Valor | undefined) {
    setR((antes) => {
      const n = { ...antes };
      if (v === undefined || v === '' || v === false || (Array.isArray(v) && !v.length)) delete n[id];
      else n[id] = v;
      return n;
    });
    setErrorEnvio(null);
  }

  /** El WhatsApp: lo que se ve (la lada y el número) y la respuesta, siempre con su país (`telefonoDeFormulario`, como el checkout). */
  function cambiarTel(t: Telefono) {
    setTel(t);
    const d = telefonoDeFormulario(t.lada, t.numero);
    cambiar('whatsapp', d ? `+${d}` : undefined);
  }

  function irA(n: number) {
    pendiente.current = { a: 'titulo' };
    setPaso(n);
    setErrorEnvio(null);
    setAviso('');
    setRetomada(null);
  }

  /** Marca los errores del paso `i` y lleva al primero. true = había errores. */
  function frenarEn(i: number): boolean {
    const e = erroresDeLaSeccion(SECCIONES[i], r);
    const ids = SECCIONES[i].campos.map((c) => c.id).filter((id) => e[id]);
    if (!ids.length) return false;
    setIntentados((antes) => (antes.includes(i) ? antes : [...antes, i]));
    if (i !== paso) setPaso(i);
    anunciar(ids.length === 1 ? 'Revisa el campo marcado.' : `Revisa los ${ids.length} campos marcados.`);
    pendiente.current = { a: 'campo', id: ids[0] };
    forzar((x) => x + 1);
    return true;
  }

  function siguiente(e: FormEvent) {
    e.preventDefault();
    if (enviando || frenarEn(paso)) return;
    if (paso < TOTAL - 1) { irA(paso + 1); return; }
    // Antes de mandar, TODOS los pasos (un borrador retomado pudo quedar a medias en uno de atrás).
    for (let i = 0; i < TOTAL; i++) if (frenarEn(i)) return;
    void enviar();
  }

  async function enviar() {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const res = await fetch(API_APLICAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestas: r, web, origen: origenDelEnvio.current }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; campo?: string };
      if (res.ok && j.ok) {
        try {
          window.localStorage.removeItem(CLAVE_BORRADOR);
          window.localStorage.setItem(CLAVE_ENVIADA, enviadaParaGuardar(r, Date.now()));
        } catch {
          // Bloqueado: no hay borrador que borrar, y si vuelve a entrar ve el formulario vacío.
        }
        pendiente.current = { a: 'final' };
        setFinal(true);
        return;
      }
      const donde = j.campo ? pasoDelCampo(j.campo) : -1;
      if (j.campo && donde >= 0) {
        // El texto del campo, sin el «WhatsApp: » con que el servidor lo nombra (acá ya está al lado de su pregunta).
        const c = campoDe(j.campo);
        const delSrv = (j.error ?? '').replace(new RegExp(`^${(c.corto ?? c.rotulo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*`), '');
        const texto = errorDelCampo(c, r[c.id]) ?? (delSrv || 'Revisa este campo.');
        setDelServidor({ campo: c.id, texto, valor: r[c.id] });
        setPaso(donde);
        anunciar(texto);
        pendiente.current = { a: 'campo', id: c.id };
        return;
      }
      setErrorEnvio(j.error ?? ERROR_DEL_ENVIO);
    } catch {
      setErrorEnvio(ERROR_DE_RED);
    } finally {
      enVuelo.current = false;
      setEnviando(false);
    }
  }

  /** «Enviar otra aplicación»: borra la enviada y deja el formulario vacío, en el paso 1. */
  function otra() {
    try { window.localStorage.removeItem(CLAVE_ENVIADA); } catch { /* bloqueado: no había nada guardado */ }
    setR({});
    setTel({ lada: ladaInicial, numero: '' });
    setIntentados([]);
    setDelServidor(null);
    setRetomada(null);
    setFinal(false);
    irA(0);
  }

  if (final) {
    return (
      <PantallaFinal
        nombre={nombreDelSaludo(r)} conCuenta={tieneCuentaDeMako(r)} rutaEntrar={rutaEntrar}
        rutaPrueba={linkDeLaPrueba(rutaPrueba, origenDelEnvio.current as Record<string, string> | null, clavesOrigen)}
        video={VIDEO_DE_GRACIAS} tituloRef={tituloFinal} onOtra={otra}
      />
    );
  }

  const [primera, ...resto] = PROGRAMA_ACELERADOR.nombre.split(' ');
  const ultimo = paso === TOTAL - 1;
  return (
    <div className="apl-wrap">
      <div className="apl-cabeza">
        <span className="acl-pill">Aplicación</span>
        <h1>{primera} <em>{resto.join(' ')}</em></h1>
        <p className="apl-bajada">Te lleva unos 5 minutos. Leo cada aplicación personalmente.</p>
        {retomada && (
          <p className="apl-retomada">
            {retomada === 'telefono'
              ? 'Lo que habías escrito sigue aquí. Revisa el código de país de tu WhatsApp y sigue.'
              : 'Lo que habías escrito sigue aquí: retomas donde lo dejaste.'}
          </p>
        )}
      </div>

      {/* ⚠️ SIN JAVASCRIPT ESTE FORMULARIO NO SE MANDA: un <form> sin `action` se manda por GET a esta misma URL, y los datos
          (nombre, email, WhatsApp) quedaban en la barra de direcciones y en los registros. Por eso el botón nace deshabilitado
          hasta que el formulario despierta en el navegador (`listo`), y `method="post"` por las dudas (la página contesta 405). */}
      <form className="apl-tarjeta" ref={tarjeta} onSubmit={siguiente} noValidate method="post" aria-labelledby="apl-titulo-paso">
        <div className="apl-barra" aria-hidden="true">
          {SECCIONES.map((s, i) => <span key={s.id} className={i < paso ? 'apl-hecho' : i === paso ? 'apl-actual' : undefined} />)}
        </div>
        <h2 className="apl-titulo-paso" id="apl-titulo-paso" ref={titulo} tabIndex={-1}>
          <span className="apl-paso-n">Paso {paso + 1} de {TOTAL}<span className="apl-oculto"> · </span></span>{seccion.titulo}
        </h2>
        {seccion.bajada && <p className="apl-tarjeta-bajada">{seccion.bajada}</p>}

        {/* Con la clave del paso: al cambiar, los campos entran de nuevo (y su animación corre otra vez). */}
        <div className="apl-campos apl-entra" key={seccion.id}>
          {/* Sólo lo que se pregunta con lo que ya contestó (`campoVisible`: el email de la cuenta, si es otro). */}
          {filasDeLaSeccion({ ...seccion, campos: seccion.campos.filter((c) => campoVisible(c, r)) }).map((fila) => {
            const campos = fila.map((c) => (
              <CampoDeLaAplicacion
                key={c.id} c={c} valor={r[c.id]} error={errorDe(c)} onCambio={(v) => cambiar(c.id, v)}
                telefono={c.tipo === 'whatsapp' ? { ...tel, onCambio: cambiarTel, menus } : undefined}
              />
            ));
            return fila.length > 1 ? <div className="apl-fila" key={fila[0].id}>{campos}</div> : campos[0];
          })}
        </div>
        <div className="apl-menus" ref={setMenus} />

        {/* El campo trampa, con un nombre y un rótulo que ningún autocompletado toma por «sitio web» (./reglas.ts, `ID_TRAMPA`). */}
        <div className="apl-trampa" aria-hidden="true">
          <label htmlFor={ID_TRAMPA}>{ROTULO_TRAMPA}</label>
          <input id={ID_TRAMPA} name={NOMBRE_TRAMPA} type="text" tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} />
        </div>

        {/* `role="status"` + `aria-live="assertive"` y no `role="alert"` (16/11/2026): el «Reportar a Soporte» que exige un alert
            (tests/reportar-a-soporte.test.ts) manda el ticket con la sesión de MaKo, y quien aplica todavía no tiene cuenta: le
            contestaría «Vuelve a entrar a MaKo». Como los formularios públicos de /planes (QuieroPlan.tsx). Se anuncia igual. */}
        {errorEnvio && <p className="apl-aviso-error" role="status" aria-live="assertive">{errorEnvio}</p>}
        <div className="apl-nav">
          {paso > 0 && (
            <button type="button" className="apl-atras" onClick={() => irA(paso - 1)} disabled={enviando}>
              {/* En el teléfono queda sólo la flecha (el texto lo sigue leyendo el lector de pantalla): «Enviar aplicación» no entraba al lado. */}
              <ArrowLeft aria-hidden="true" /><span className="apl-atras-texto">Atrás</span>
            </button>
          )}
          <button type="submit" className="acl-btn" disabled={enviando || !listo}>
            {enviando
              ? <><span className="apl-girando" aria-hidden="true" />Enviando…</>
              : ultimo ? 'Enviar aplicación' : <>Siguiente<ArrowRight aria-hidden="true" /></>}
          </button>
        </div>
        <p className="apl-oculto" role="status" aria-live="polite">{aviso}</p>
      </form>
      {/* Sin «hasta que lo envíes»: enviada, queda una semana para volver a la pantalla final (`CLAVE_ENVIADA`). */}
      <p className="apl-nota">Lo que escribes se guarda en este navegador: si cierras la página, sigues donde lo dejaste.</p>
    </div>
  );
}

/**
 * El foco y la vista en un campo: el radio o casillero marcado de su grupo, o el primero. La página se mueve sólo si el campo no
 * se ve entero (debajo de la barra fija y arriba del borde): si ya está a la vista, no salta.
 */
function enfocarCampo(id: string) {
  const c = campoDe(id);
  let el = document.getElementById(idDelCampo(id));
  if (c.tipo === 'una' || c.tipo === 'varias') el = document.querySelector<HTMLInputElement>(`input[name="${id}"]:checked`) ?? el;
  const caja = el?.closest('.apl-campo') ?? el;
  const r = caja?.getBoundingClientRect();
  if (caja && r && (r.top < 84 || r.bottom > window.innerHeight - 16)) caja.scrollIntoView({ block: r.height > window.innerHeight - 120 ? 'start' : 'center' });
  el?.focus({ preventScroll: true });
}

/** Lo que necesita el WhatsApp: la lada y el número que se ven, cómo cambiarlos, y dónde se dibuja el menú de los países. */
type TelefonoDelCampo = Telefono & { onCambio: (t: Telefono) => void; menus: HTMLElement | null };

/** Un campo de la aplicación, según su tipo. `telefono`: el del WhatsApp. */
function CampoDeLaAplicacion({ c, valor, error, onCambio, telefono }: {
  c: Campo; valor: Valor | undefined; error: string | null; onCambio: (v: Valor | undefined) => void;
  telefono?: TelefonoDelCampo;
}) {
  const id = idDelCampo(c.id);
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const describe = [c.ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ') || undefined;
  const opcional = c.obligatorio ? null : <span className="apl-opcional"> (opcional)</span>;
  const ayuda = c.ayuda ? <p className="apl-ayuda" id={idAyuda}>{c.ayuda}</p> : null;
  const textoError = error ? <p className="apl-error" id={idError}>{error}</p> : null;

  if (c.tipo === 'whatsapp' && telefono) {
    return (
      <div className="apl-campo">
        <label className="apl-rotulo" htmlFor={id}>{c.rotulo}{opcional}</label>
        {ayuda}
        <CampoWhatsapp id={id} c={c} telefono={telefono} invalido={!!error} describe={describe} />
        {textoError}
      </div>
    );
  }

  if (c.tipo === 'una' || c.tipo === 'varias') {
    const varias = c.tipo === 'varias';
    const elegidas = varias ? (Array.isArray(valor) ? valor : []) : [];
    // ⚠️ El error y la ayuda, también en CADA opción (revisión del 16/11/2026): el foco va al radio o al casillero, no al fieldset,
    // y el lector de pantalla no decía el error. Las de una opción son un radiogroup obligatorio (`aria-required` no vale en un
    // grupo de casilleros: ahí lo dice la ayuda).
    const grupo = !varias && c.obligatorio ? { role: 'radiogroup' as const, 'aria-required': true as const } : {};
    return (
      <fieldset className={`apl-campo apl-grupo${error ? ' apl-con-error' : ''}`} aria-describedby={describe} {...grupo}>
        <legend className="apl-rotulo">{c.rotulo}{opcional}</legend>
        {ayuda}
        <div className={`apl-opciones${enUnaColumna(c) ? ' apl-una-col' : ''}`}>
          {(c.opciones ?? []).map((o, i) => {
            const sel = varias ? elegidas.includes(i) : valor === i;
            return (
              <label key={o} className={`apl-op${varias ? ' apl-op-caja' : ''}${sel ? ' apl-op-sel' : ''}`}>
                <input
                  className="apl-op-input" type={varias ? 'checkbox' : 'radio'} name={c.id} value={i} checked={sel}
                  id={i === 0 ? id : undefined} aria-invalid={error ? true : undefined} aria-describedby={describe}
                  onChange={() => onCambio(varias ? (sel ? elegidas.filter((x) => x !== i) : [...elegidas, i].sort((x, y) => x - y)) : i)}
                />
                <span className="apl-marca" aria-hidden="true" />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
        {textoError}
      </fieldset>
    );
  }

  if (c.tipo === 'confirmo') {
    const sel = valor === true;
    return (
      <div className={`apl-campo${error ? ' apl-con-error' : ''}`}>
        <label className={`apl-op apl-op-caja apl-op-confirmo${sel ? ' apl-op-sel' : ''}`}>
          <input
            className="apl-op-input" type="checkbox" id={id} name={c.id} checked={sel}
            aria-invalid={error ? true : undefined} aria-describedby={describe} onChange={() => onCambio(!sel)}
          />
          <span className="apl-marca" aria-hidden="true" />
          <span>{c.rotulo}</span>
        </label>
        {textoError}
      </div>
    );
  }

  const texto = typeof valor === 'string' ? valor : '';
  if (c.tipo === 'canal') {
    return (
      <div className="apl-campo">
        <label className="apl-rotulo" htmlFor={id}>{c.rotulo}{opcional}</label>
        {ayuda}
        <CampoCanal id={id} c={c} valor={texto} invalido={!!error} describe={describe} onCambio={(v) => onCambio(v)} />
        {textoError}
      </div>
    );
  }
  if (c.tipo === 'largo') {
    return (
      <div className="apl-campo">
        <label className="apl-rotulo" htmlFor={id}>{c.rotulo}{opcional}</label>
        {ayuda}
        <AreaQueCrece
          id={id} name={c.id} value={texto} placeholder={c.placeholder} maxLength={LARGO_MAXIMO.largo}
          aria-invalid={error ? true : undefined} aria-describedby={describe} aria-required={c.obligatorio || undefined}
          onChange={(v) => onCambio(v)}
        />
        <PieDelCampo error={textoError} largo={texto.length} tope={LARGO_MAXIMO.largo} />
      </div>
    );
  }

  const e = entradaDe(c);
  return (
    <div className="apl-campo">
      <label className="apl-rotulo" htmlFor={id}>{c.rotulo}{opcional}</label>
      {ayuda}
      <input
        className="apl-input" id={id} name={c.id} type={e.type} inputMode={e.inputMode} autoComplete={e.autoComplete}
        autoCapitalize={e.autoCapitalize} spellCheck={e.spellCheck} placeholder={c.placeholder} value={texto}
        maxLength={LARGO_MAXIMO[c.tipo]} aria-invalid={error ? true : undefined} aria-describedby={describe}
        aria-required={c.obligatorio || undefined} onChange={(ev) => onCambio(ev.target.value)}
      />
      {textoError}
    </div>
  );
}

/** La cara del selector de país (el `buttonStyle` del Dropdown): del alto y del oscuro de los campos de este formulario (./estilo.ts). */
const CARA_LADA: CSSProperties = {
  height: 54, minHeight: 54, padding: '0 12px 0 14px', borderRadius: 12, border: '1.5px solid var(--apl-borde-campo)',
  background: 'var(--apl-campo)', color: 'var(--acl-ink)', fontFamily: 'var(--acl-body)', fontSize: 16, fontWeight: 600,
};

/**
 * El WhatsApp: el código de país que se elige y el número (`TelefonoConPais`, el del checkout). El menú del selector es el de la
 * app y se dibuja en `menus` (`portalTo`), adentro del formulario: así toma los colores de este formulario (./estilo.ts,
 * `.apl-tel` y `.apl-menus`) y no los del tema de la app, que en una página pública puede ser el claro.
 */
function CampoWhatsapp({ id, c, telefono, invalido, describe }: {
  id: string; c: Campo; telefono: TelefonoDelCampo; invalido: boolean; describe: string | undefined;
}) {
  const { lada, numero, onCambio, menus } = telefono;
  return (
    <div className="apl-tel">
      <TelefonoConPais
        lada={lada} numero={numero} onLada={(v) => onCambio({ lada: v, numero })} onNumero={(v) => onCambio({ lada, numero: v })}
        inputStyle={{}} inputClassName="apl-input" estiloLada={CARA_LADA} anchoLada={118} portalTo={menus}
        autoComplete={c.autoComplete ?? 'tel'} inputId={id} placeholder={c.placeholder}
        inputAria={{ invalid: invalido, describedBy: describe, required: c.obligatorio }}
      />
    </div>
  );
}

/** Una cuenta que ofrece la búsqueda (app/api/accelerator/canal): `valor` es lo que queda escrito al elegirla. */
type Candidato = { valor: string; nombre: string | null; usuario: string; foto: string | null; seguidores: number | null };
type Busqueda =
  | { q: string; estado: 'buscando' }
  | { q: string; estado: 'listo'; candidatos: Candidato[]; vacio: 'no-anda' | 'limite' | null };
/** Cuánto se espera a que deje de escribir antes de buscar: cada búsqueda puede costar una corrida de Apify. */
const ESPERA_BUSQUEDA_MS = 700;

/**
 * EL INSTAGRAM O EL YOUTUBE, CON LA BÚSQUEDA DE SPY (16/11/2026, Martín: «reutilicemos lo que ya tenemos en Competitor Spy… la
 * persona puede como seleccionarse su propio canal»). Escribe su @, su nombre o pega el link; cuando deja de escribir, la búsqueda
 * (`API_CANAL`) trae las cuentas y elige la suya («Es la mía»), que queda escrita como su @ o el link del canal. Si la búsqueda no
 * anda (sin crédito, el tope del día), lo dice y lo escrito vale igual: un @ o un link pasan la validación (`errorDelCampo`).
 */
function CampoCanal({ id, c, valor, invalido, describe, onCambio }: {
  id: string; c: Campo; valor: string; invalido: boolean; describe: string | undefined; onCambio: (v: string) => void;
}) {
  const red = c.red ?? 'instagram';
  const [busqueda, setBusqueda] = useState<Busqueda | null>(null);
  const [elegido, setElegido] = useState<Candidato | null>(null);
  const idEstado = `${id}-busqueda`;
  useEffect(() => {
    const pedido = queBuscarDelCanal(red, valor);
    // Lo que no se busca (vacío, muy corto) y lo recién elegido no piden nada.
    if ((!pedido.exacto && !pedido.nombre) || elegido?.valor === valor) { setBusqueda(null); return; }
    const ctrl = new AbortController();
    const espera = window.setTimeout(async () => {
      setBusqueda({ q: valor, estado: 'buscando' });
      try {
        const res = await fetch(`${API_CANAL}?red=${red}&q=${encodeURIComponent(valor.trim())}`, { signal: ctrl.signal });
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; candidatos?: unknown; vacio?: unknown };
        const bien = res.ok && j.ok === true;
        const candidatos = bien && Array.isArray(j.candidatos) ? (j.candidatos as Candidato[]).filter((k) => k && typeof k.valor === 'string').slice(0, 5) : [];
        const vacio = !bien ? 'no-anda' : j.vacio === 'no-anda' || j.vacio === 'limite' ? j.vacio : null;
        setBusqueda({ q: valor, estado: 'listo', candidatos, vacio });
      } catch {
        if (!ctrl.signal.aborted) setBusqueda({ q: valor, estado: 'listo', candidatos: [], vacio: 'no-anda' });
      }
    }, ESPERA_BUSQUEDA_MS);
    return () => { ctrl.abort(); window.clearTimeout(espera); };
  }, [red, valor, elegido]);

  const elegir = (k: Candidato) => { setElegido(k); setBusqueda(null); onCambio(k.valor); };
  const cuantos = red === 'youtube' ? 'suscriptores' : 'seguidores';
  const listo = busqueda?.estado === 'listo' && busqueda.q === valor ? busqueda : null;
  const estado = busqueda?.estado === 'buscando' ? 'Buscando…'
    : !listo ? ''
      : listo.candidatos.length ? (listo.candidatos.length === 1 ? '¿Es tu cuenta?' : 'Elige la tuya:')
        : listo.vacio ? 'No pude buscarla ahora: escribe tu @ o pega el link.'
          : 'No la encontré: revisa el @ o pega el link.';
  const e = entradaDe(c);
  return (
    <div className="apl-canal">
      <input
        className="apl-input" id={id} name={c.id} type={e.type} inputMode={e.inputMode} autoComplete={e.autoComplete}
        autoCapitalize={e.autoCapitalize} spellCheck={e.spellCheck} placeholder={c.placeholder} value={valor}
        maxLength={LARGO_MAXIMO.canal} aria-invalid={invalido ? true : undefined}
        aria-describedby={[describe, estado ? idEstado : null].filter(Boolean).join(' ') || undefined}
        onChange={(ev) => onCambio(ev.target.value)}
      />
      {elegido?.valor === valor
        ? <p className="apl-canal-ok"><Check aria-hidden="true" width={16} height={16} />{elegido.nombre ?? elegido.usuario}{elegido.nombre ? <span>{elegido.usuario}</span> : null}</p>
        : <p className="apl-canal-estado" id={idEstado} role="status" aria-live="polite">{estado}</p>}
      {listo && listo.candidatos.length > 0 && elegido?.valor !== valor && (
        <ul className="apl-canal-lista">
          {listo.candidatos.map((k) => (
            <li key={k.valor}>
              <button type="button" className="apl-canal-op" onClick={() => elegir(k)}>
                <span className="apl-canal-foto" aria-hidden="true">
                  {(k.nombre ?? k.usuario).replace(/^@/, '').slice(0, 1).toUpperCase()}
                  {k.foto && (
                    // eslint-disable-next-line @next/next/no-img-element -- la foto que trae la búsqueda (Instagram o YouTube), de otro sitio
                    <img src={k.foto} alt="" width={40} height={40} loading="lazy" referrerPolicy="no-referrer" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />
                  )}
                </span>
                <span className="apl-canal-quien">
                  <b>{k.nombre ?? k.usuario}</b>
                  {/* Sin nombre, el @ ya va arriba: abajo, sólo los seguidores (si se saben). */}
                  {(k.nombre || k.seguidores != null) && (
                    <span>{[k.nombre ? k.usuario : null, k.seguidores != null ? `${miles(k.seguidores)} ${cuantos}` : null].filter(Boolean).join(' · ')}</span>
                  )}
                </span>
                <span className="apl-canal-es">Es la mía</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** El error y, cerca del tope, cuánto lleva (suave hasta el 95 %, después en naranja). */
function PieDelCampo({ error, largo, tope }: { error: ReactNode; largo: number; tope: number }) {
  const cerca = largo >= tope * 0.8;
  if (!error && !cerca) return null;
  return (
    <div className="apl-pie-campo">
      {error}
      {cerca && <span className={`apl-contador${largo >= tope * 0.95 ? ' apl-contador-tope' : ''}`}>{miles(largo)} / {miles(tope)}</span>}
    </div>
  );
}

/** Un textarea que crece con lo que se escribe (sin barra de scroll adentro). */
function AreaQueCrece({ value, onChange, ...resto }: {
  id: string; name: string; value: string; placeholder?: string; maxLength: number; onChange: (v: string) => void;
  'aria-invalid'?: boolean; 'aria-describedby'?: string; 'aria-required'?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
  }, [value]);
  return <textarea ref={ref} className="apl-input" rows={4} value={value} onChange={(e) => onChange(e.target.value)} {...resto} />;
}

/**
 * LA PANTALLA DE DESPUÉS DE ENVIAR, LA MISMA PARA TODOS (16/11/2026). Martín: «siempre debería ser gracias, voy a revisar tu
 * aplicación, te responderé en máximo 24 horas… estate atento a tu WhatsApp y a tu email… al final de toda aplicación… como un
 * paso obligatorio. El siguiente paso que tienes que dar es iniciar tu prueba gratuita de 7 días en MaKo… Y ahí te da una opción de
 * iniciar prueba gratuita de 7 días o ya hice la prueba gratuita… Y deja ahí un espacio… para un video… no hace falta tanto texto…
 * Tal vez solamente los botones». Con cuenta de MaKo (lo contestó en «Tus datos»), el botón es «Entrar a MaKo».
 * Sin agenda: hasta esa tarde, quien calificaba elegía ahí su horario en el Calendly de Martín.
 */
export function PantallaFinal({ nombre, conCuenta, rutaPrueba, rutaEntrar, video, tituloRef, onOtra }: {
  nombre: string;
  /** Ya tiene cuenta de MaKo (`tieneCuentaDeMako`): «Entrar a MaKo» en vez de la prueba. */
  conCuenta: boolean;
  /** El checkout de la prueba gratuita, con la campaña (`linkDeLaPrueba`). */
  rutaPrueba: string;
  /** El login de MaKo. */
  rutaEntrar: string;
  /** El video de Martín (`VIDEO_DE_GRACIAS`, el reproductor de Panda); sin él, el espacio con «Muy pronto». */
  video: string | null;
  tituloRef?: RefObject<HTMLHeadingElement | null>;
  /** «Empezar de nuevo» (la aplicación enviada queda guardada una semana en el navegador): sin esto, no se ofrece. */
  onOtra?: () => void;
}) {
  return (
    <div className="apl-wrap">
      <div className="apl-fin">
        <div className="apl-fin-ico" aria-hidden="true" />
        <div aria-live="polite">
          <h1 ref={tituloRef} tabIndex={-1}>{nombre ? `¡Gracias, ${nombre}!` : '¡Gracias!'}</h1>
          <p className="apl-fin-texto">Voy a revisar tu aplicación y te respondo en máximo 24 horas. Estate atento a tu WhatsApp y a tu email.</p>
        </div>
        <div className="apl-video">
          <span className="acl-esq acl-esq-1" /><span className="acl-esq acl-esq-2" />
          <span className="acl-esq acl-esq-3" /><span className="acl-esq acl-esq-4" />
          {video
            ? <iframe src={video} title="Un video de Martín para ti" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            : (
              <div className="apl-video-falta">
                <span className="apl-video-play" aria-hidden="true"><Play width={22} height={22} /></span>
                <span>Muy pronto, un video mío para ti</span>
              </div>
            )}
        </div>
        <div className="apl-siguiente">
          <p className="apl-siguiente-ceja">Tu siguiente paso</p>
          {/* Sólo los botones (Martín: «no hace falta tanto texto… Tal vez solamente los botones»). */}
          <div className="apl-siguiente-botones">
            {conCuenta
              ? <a className="acl-btn" href={rutaEntrar}>Entrar a MaKo</a>
              : (
                <>
                  <a className="acl-btn" href={rutaPrueba}>Iniciar prueba gratuita de {PRUEBA_DIAS} días</a>
                  <a className="apl-boton-borde" href={rutaEntrar}>Ya hice la prueba gratuita</a>
                </>
              )}
          </div>
        </div>
        {onOtra && (
          <p className="apl-otra">¿Quieres enviar otra aplicación? <button type="button" onClick={onOtra}>Empezar de nuevo</button></p>
        )}
      </div>
    </div>
  );
}
