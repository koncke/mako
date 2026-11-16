'use client';

// =============================================================================
// El formulario de aplicación a MaKo Accelerator (16/11/2026): un paso por sección, y al final la agenda de Martín adentro
// =============================================================================
// Martín, 16/11/2026: «yo no pondría el botón de agendar llamada, sino justamente el botón de aplicar ahora. Y ahí pondría
// justamente un formulario… muy similar [al de Mastery Haus]. El formulario evidentemente tiene que funcionar… y debería estar
// evidentemente bien diseñado todo».
//
// LAS PREGUNTAS, CÓMO SE VALIDAN Y QUIÉN CALIFICA son el contrato (lib/aplicacion-accelerator.ts): el mismo que vuelve a leer
// el servidor. Acá, cómo se recorren:
//   · UN PASO POR SECCIÓN (seis), con la barra de seis tramos y «Paso N de 6 · <la sección>». Al tocar «Siguiente» se marcan los
//     errores de ese paso (`errorDelCampo`), el foco va al primero, y desde ahí se corrigen EN VIVO mientras escribe o elige.
//   · Cada tipo, su control: texto, email, WhatsApp y link son un input con su teclado y su autocompletado (./reglas.ts,
//     `entradaDe`); las largas, un textarea que crece, con el contador cerca del tope; las de una opción, tarjetas con radios de
//     verdad dentro de un fieldset (se eligen con las flechas); las de varias, con casilleros; el compromiso, un casillero.
//   · EL BORRADOR vive en el navegador (`CLAVE_BORRADOR`, con su versión): si cierra la pestaña, retoma donde lo dejó. Se borra
//     al enviar bien. Sin almacenamiento (una ventana privada), el formulario anda igual.
//   · El POST va a `API_APLICAR` con `{ respuestas, web, origen }`: las opciones viajan como ÍNDICES; `web` es el campo trampa.
//     Si el servidor marca un `campo`, vuelve a su paso y lo marca.
//   · LA PANTALLA FINAL: quien califica elige su horario en la agenda de Martín, ahí mismo y con lo que escribió ya cargado
//     (`linkDeLaAgenda`); el resto lee «la leo personalmente y, si hay match, te escribo por WhatsApp», y un link a /planes.
//     La aplicación enviada queda una semana en el navegador: quien vuelve sin haber agendado ve su agenda otra vez; quien ya
//     agendó (Calendly avisa `calendly.event_scheduled`) lee que su llamada ya quedó agendada, SIN la agenda: no agenda dos.
// Habla Martín, en primera persona: no hay equipo (memoria «sin-equipo-todavia»).
// =============================================================================

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  API_APLICAR, LARGO_MAXIMO, SECCIONES, campo as campoDe, errorDelCampo, erroresDeLaSeccion, linkDeLaAgenda,
  type Campo, type Respuestas, type Valor,
} from '@/lib/aplicacion-accelerator';
import { PROGRAMA_ACELERADOR } from '@/lib/planes-mako';
import type { OrigenCompra } from '@/lib/compra-plan-reglas';
import {
  CLAVE_BORRADOR, CLAVE_ENVIADA, borradorLimpio, borradorParaGuardar, enUnaColumna, entradaDe, enviadaLimpia, enviadaParaGuardar,
  filasDeLaSeccion, idDelCampo, nombreDelSaludo, origenDelReferer, pasoDelCampo,
} from './reglas';

const TOTAL = SECCIONES.length;
const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ERROR_DE_RED = 'No se pudo conectar. Revisa tu internet y prueba otra vez: lo que escribiste sigue guardado.';
const ERROR_DEL_ENVIO = 'No se pudo enviar tu aplicación. Prueba otra vez en un minuto.';

type Pendiente = { a: 'titulo' } | { a: 'campo'; id: string } | { a: 'final' };

export function FormularioAplicacion({ origen, clavesOrigen, rutaPlanes }: {
  /** La campaña que trajo la URL de esta página (lo lee page.tsx con `origenLimpio`). */
  origen: OrigenCompra | null;
  /** Qué parámetros de la URL son de la campaña (`CLAVES_ORIGEN`): para leerlos de la página anterior si esta URL no los trae. */
  clavesOrigen: readonly string[];
  /** A dónde lleva el link a los planes de MaKo de la pantalla final. */
  rutaPlanes: string;
}) {
  const [paso, setPaso] = useState(0);
  const [r, setR] = useState<Respuestas>({});
  /** Los pasos donde ya se tocó «Siguiente»: ahí los errores se muestran, y en vivo. */
  const [intentados, setIntentados] = useState<readonly number[]>([]);
  /** El error que marcó el servidor en un campo: se va cuando la persona cambia ese valor. */
  const [delServidor, setDelServidor] = useState<{ campo: string; texto: string; valor: Valor | undefined } | null>(null);
  const [web, setWeb] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  /** La pantalla final: si califica, y si ya agendó (leído del navegador al volver: entonces no ve la agenda otra vez). */
  const [final, setFinal] = useState<{ califica: boolean; agendada: boolean } | null>(null);
  const [retomada, setRetomada] = useState(false);
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
  // aplicación ya ENVIADA (vuelve a su pantalla final, con su agenda); si no, el borrador.
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
    const b = enviada ? null : borradorLimpio(leer(CLAVE_BORRADOR), Date.now());
    if (enviada) {
      setR(enviada.respuestas);
      setFinal({ califica: enviada.califica, agendada: enviada.agendada });
    } else if (b) {
      setR(b.respuestas);
      setPaso(b.paso);
      setRetomada(true);
    }
    setListo(true);
  }, []);

  // La campaña: la de esta URL; si no trae, la de la página de la que vino (la landing con su ?utm_…).
  useEffect(() => {
    if (!origen) origenDelEnvio.current = origenDelReferer(document.referrer, window.location.href, clavesOrigen);
  }, [origen, clavesOrigen]);

  // Lo que escribe se guarda mientras escribe (nunca antes de haber leído el borrador: lo pisaría vacío).
  useEffect(() => {
    if (!listo || final || !Object.keys(r).length) return;
    try {
      window.localStorage.setItem(CLAVE_BORRADOR, borradorParaGuardar(paso, r, Date.now()));
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

  function irA(n: number) {
    pendiente.current = { a: 'titulo' };
    setPaso(n);
    setErrorEnvio(null);
    setAviso('');
    setRetomada(false);
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
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; califica?: boolean; error?: string; campo?: string };
      if (res.ok && j.ok) {
        const califica = j.califica === true;
        try {
          window.localStorage.removeItem(CLAVE_BORRADOR);
          window.localStorage.setItem(CLAVE_ENVIADA, enviadaParaGuardar(califica, r, Date.now()));
        } catch {
          // Bloqueado: no hay borrador que borrar, y si vuelve a entrar ve el formulario vacío.
        }
        pendiente.current = { a: 'final' };
        setFinal({ califica, agendada: false });
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
    setIntentados([]);
    setDelServidor(null);
    setRetomada(false);
    setFinal(null);
    irA(0);
  }

  /** Calendly avisó que agendó: queda en la aplicación guardada, así al volver no ve la agenda otra vez. */
  const alAgendar = useCallback(() => {
    try {
      window.localStorage.setItem(CLAVE_ENVIADA, enviadaParaGuardar(true, r, Date.now(), true));
    } catch {
      // Bloqueado: si vuelve a entrar, ve la agenda otra vez (como antes de esto).
    }
  }, [r]);

  if (final) {
    return (
      <PantallaFinal
        nombre={nombreDelSaludo(r)} califica={final.califica} yaAgendada={final.agendada} rutaPlanes={rutaPlanes}
        tituloRef={tituloFinal} onOtra={otra} onAgendada={alAgendar}
        agenda={final.califica && !final.agendada ? linkDeLaAgenda(r, { embed: window.location.hostname }) : ''}
        agendaAparte={final.califica && !final.agendada ? linkDeLaAgenda(r) : ''}
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
        {retomada && <p className="apl-retomada">Lo que habías escrito sigue aquí: retomas donde lo dejaste.</p>}
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
          {filasDeLaSeccion(seccion).map((fila) => {
            const campos = fila.map((c) => <CampoDeLaAplicacion key={c.id} c={c} valor={r[c.id]} error={errorDe(c)} onCambio={(v) => cambiar(c.id, v)} />);
            return fila.length > 1 ? <div className="apl-fila" key={fila[0].id}>{campos}</div> : campos[0];
          })}
        </div>

        <div className="apl-trampa" aria-hidden="true">
          <label htmlFor="apl-web">Web</label>
          <input id="apl-web" name="web" type="text" tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} />
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
      {/* Sin «hasta que lo envíes»: enviada, la aplicación sigue guardada una semana para volver a la agenda (`CLAVE_ENVIADA`). */}
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

/** Un campo de la aplicación, según su tipo. */
function CampoDeLaAplicacion({ c, valor, error, onCambio }: {
  c: Campo; valor: Valor | undefined; error: string | null; onCambio: (v: Valor | undefined) => void;
}) {
  const id = idDelCampo(c.id);
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const describe = [c.ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ') || undefined;
  const opcional = c.obligatorio ? null : <span className="apl-opcional"> (opcional)</span>;
  const ayuda = c.ayuda ? <p className="apl-ayuda" id={idAyuda}>{c.ayuda}</p> : null;
  const textoError = error ? <p className="apl-error" id={idError}>{error}</p> : null;

  if (c.tipo === 'una' || c.tipo === 'varias') {
    const varias = c.tipo === 'varias';
    const elegidas = varias ? (Array.isArray(valor) ? valor : []) : [];
    return (
      <fieldset className={`apl-campo apl-grupo${error ? ' apl-con-error' : ''}`} aria-describedby={describe}>
        <legend className="apl-rotulo">{c.rotulo}{opcional}</legend>
        {ayuda}
        <div className={`apl-opciones${enUnaColumna(c) ? ' apl-una-col' : ''}`}>
          {(c.opciones ?? []).map((o, i) => {
            const sel = varias ? elegidas.includes(i) : valor === i;
            return (
              <label key={o} className={`apl-op${varias ? ' apl-op-caja' : ''}${sel ? ' apl-op-sel' : ''}`}>
                <input
                  className="apl-op-input" type={varias ? 'checkbox' : 'radio'} name={c.id} value={i} checked={sel}
                  id={i === 0 ? id : undefined} aria-invalid={error ? true : undefined}
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
 * La pantalla de después de enviar. Quien califica, la agenda de Martín ADENTRO (con su alto: Calendly avisa cuánto mide su
 * página con `calendly.page_height`, y si no, el del CSS); si ya agendó (vuelve después de agendar), que su llamada ya quedó
 * agendada y SIN la agenda (no agenda dos); el resto, «la leo personalmente» y los planes de MaKo.
 */
export function PantallaFinal({ nombre, califica, yaAgendada = false, agenda, agendaAparte, rutaPlanes, tituloRef, onOtra, onAgendada }: {
  nombre: string; califica: boolean;
  /** Ya agendó antes, en este navegador (`CLAVE_ENVIADA` con `agendada`): no ve la agenda otra vez. */
  yaAgendada?: boolean;
  /** La agenda para el iframe (`linkDeLaAgenda` con `embed`) y la de otra pestaña (sin `embed`). Vacías si no califica. */
  agenda: string; agendaAparte: string;
  rutaPlanes: string;
  tituloRef?: RefObject<HTMLHeadingElement | null>;
  /** «Empezar de nuevo» (la aplicación enviada queda guardada una semana en el navegador): sin esto, no se ofrece. */
  onOtra?: () => void;
  /** Calendly avisó que agendó (`calendly.event_scheduled`): quien la usa lo guarda. */
  onAgendada?: () => void;
}) {
  const [alto, setAlto] = useState<number | null>(null);
  const [agendada, setAgendada] = useState(false);
  const conAgenda = califica && !yaAgendada;
  useEffect(() => {
    if (!conAgenda) return;
    // Calendly avisa cuánto mide lo que muestra (medido el 16/11/2026: 927 px en una columna, 798 en dos, y unos 26 y 2 px mientras
    // carga, que se descartan). Con su alto, la agenda no tiene barra de scroll adentro; si no avisa, queda el del CSS.
    const escuchar = (e: MessageEvent) => {
      if (e.origin !== 'https://calendly.com') return;
      const d = e.data as { event?: unknown; payload?: { height?: unknown } } | null;
      if (d?.event === 'calendly.page_height') {
        const h = Number.parseInt(String(d.payload?.height ?? ''), 10);
        if (h >= 400 && h <= 3600) setAlto(h);
      }
      if (d?.event === 'calendly.event_scheduled') {
        setAgendada(true);
        onAgendada?.();
      }
    };
    window.addEventListener('message', escuchar);
    return () => window.removeEventListener('message', escuchar);
  }, [conAgenda, onAgendada]);

  // Recién agendada, la agenda sigue (adentro, Calendly muestra el día y la hora), pero lo de arriba ya no dice «elige el horario».
  const texto = !califica
    ? 'Recibí tu aplicación. La leo personalmente y, si hay match, te escribo por WhatsApp.'
    : yaAgendada || agendada
      ? 'Tu llamada conmigo ya quedó agendada.'
      : 'Por lo que me cuentas, tiene sentido que hablemos. Elige el día y la hora de tu llamada conmigo:';
  return (
    <div className="apl-wrap">
      <div className="apl-fin">
        <div className="apl-fin-ico" aria-hidden="true" />
        <div aria-live="polite">
          <h1 ref={tituloRef} tabIndex={-1}>{nombre ? `¡Gracias, ${nombre}!` : '¡Gracias!'}</h1>
          <p className="apl-fin-texto">{texto}</p>
        </div>
        {conAgenda ? (
          <>
            {!agendada && <p className="apl-fin-nota">Lo que me contaste ya va cargado en la agenda: sólo elige el horario.</p>}
            {/* La región está desde el principio: un aviso que entra ya escrito no siempre se lee en voz alta. */}
            <div role="status" aria-live="polite">
              {agendada && <p className="apl-agendada">¡Listo! Te llegó la confirmación por email, con el día y la hora. Nos vemos ahí.</p>}
            </div>
            <div className="apl-agenda">
              <iframe src={agenda} title={`Mi agenda: elige el horario de tu llamada de ${PROGRAMA_ACELERADOR.nombre}`} style={alto ? { height: alto } : undefined} />
            </div>
            <p className="apl-agenda-pie">¿No se ve la agenda? <a href={agendaAparte} target="_blank" rel="noopener noreferrer">Ábrela aquí</a></p>
          </>
        ) : califica ? (
          <p className="apl-fin-nota">La confirmación te llegó por email: ahí tienes el día, la hora y el link para cambiarla si lo necesitas.</p>
        ) : (
          <div className="apl-mako">
            <p className="apl-mako-ceja">Mientras tanto</p>
            <p className="apl-mako-texto">Conoce MaKo, el software con el que armo los sistemas de mis clientes.</p>
            <a className="apl-link" href={rutaPlanes}>Ver los planes de MaKo<ArrowRight aria-hidden="true" width={16} height={16} /></a>
          </div>
        )}
        {onOtra && (
          <p className="apl-otra">¿Quieres enviar otra aplicación? <button type="button" onClick={onOtra}>Empezar de nuevo</button></p>
        )}
      </div>
    </div>
  );
}
