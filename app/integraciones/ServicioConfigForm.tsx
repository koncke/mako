'use client';

// =============================================================================
// ServicioConfigForm — BYOK embebido en los modales de /integraciones
// =============================================================================
// TODA la lista de credenciales del servicio junta (no wizard de a un paso), y
// cada key se basta a sí misma: UNA barra por campo, del mismo alto siempre, con
// el semáforo, el valor y sus acciones como íconos ADENTRO. No hay botones
// globales de "Guardar"/"Probar" — se guarda y se prueba key por key, y el
// resultado sale abajo de ESA key, no al final del modal.
//
// Sin lápiz de "reconfigurar": una credencial guardada se cambia BORRÁNDOLA
// (con confirmación), y ahí el campo vuelve a estar en blanco. Es un camino
// menos y hace imposible pisar una key sin querer.
//
// Reusa la infra de /metodo:
//   · GET  /api/integraciones/credencial?servicio=<key>  → catálogo + estado
//   · POST { action:'guardar'|'borrar'|'verificar'|'revelar', ... }
// El estado por campo (configurado / máscara / ilegible) manda el semáforo y qué
// íconos aparecen. Solo se envían los campos TIPEADOS: "vacío" nunca pisa nada.
// OJO: no existe el concepto "configurada en el servidor" — TODO campo es editable.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../_components/icons';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dropdown } from '../components/Dropdown';

/** Lo que Meta devolvió y el cliente todavía tiene que elegir (si hay varias). */
type OpcionesMeta = {
  cuentas: Array<{ id: string; nombre: string; activa?: boolean; moneda?: string }>;
  paginas: Array<{ id: string; nombre: string }>;
  pixeles: Array<{ id: string; nombre: string }>;
};

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// El "ojito" muestra el secreto un rato corto y lo vuelve a tapar solo: que una
// credencial no quede a la vista en una pantalla compartida o grabada. Además se
// tapa sola si te vas de la pestaña — no hace falta que el reloj llegue al final.
const OCULTAR_MS = 8_000;

type OrigenCampo = 'servidor' | 'panel' | null;
type Tutorial = { pasos: string[]; url?: string; urlLabel?: string };
type Campo = {
  env: string;
  label: string;
  placeholder: string | null;
  secreto: boolean;
  opcional: boolean;
  nota: string | null;
  host: boolean;
  /** La app lo completa sola: no se pide, se muestra como resultado. */
  auto?: boolean;
  /** Nº de CUENTA de esta API key (1 = la de siempre). Las de la 2 en adelante
   *  llegan plegadas: se muestran si ya están cargadas o si pedís agregar otra. */
  slot?: number;
  configurado: boolean;
  origen: OrigenCampo;
  mask: string;
  ilegible: boolean;
  /** Cómo se consigue ESTA credencial. Si falta, cae al tutorial del servicio. */
  ayuda: Tutorial | null;
};
/** Lo que hay que pegar del OTRO lado. Ver PasoExterno en lib/metodo-catalogo. */
type PasoExterno = { titulo: string; porque: string; valor: string; donde: string; ojo?: string[] };
type Servicio = {
  key: string;
  nombre: string;
  categoria: string;
  paraQue: string;
  soloServidor: boolean;
  tutorial: Tutorial;
  pasoExterno: PasoExterno | null;
  campos: Campo[];
};
type Msg = { ok: boolean; text: string };

const caja: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 };

// Solo los campos con valor tipeado: un input vacío sobre una guardada significa
// "no la toques", nunca "borrala".
function tipeados(campos: Campo[], valores: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of campos) {
    const v = (valores[c.env] ?? '').trim();
    if (v) out[c.env] = v;
  }
  return out;
}

function calcConectada(campos: Campo[]): boolean {
  const requeridos = campos.filter((c) => !c.opcional);
  return requeridos.length ? requeridos.every((c) => c.configurado) : campos.some((c) => c.configurado);
}

/**
 * Una credencial está "cerrada" (máscara + ojito + tacho) solo si vive en la
 * base. Si viniera del entorno del server —la ventana entre un deploy y la
 * migración del boot— no hay fila que borrar: se muestra ABIERTA para poder
 * pisarla. Sin esto quedaría sin tacho y sin lápiz, o sea imposible de cambiar.
 */
function estaCerrada(c: Campo): boolean {
  return c.configurado && !c.ilegible && c.origen === 'panel';
}

// Semáforo + placeholder de cada fila. La barra NO cambia de tamaño entre
// estados: lo único que cambia es el color del punto y el texto de adentro.
function semaforo(c: Campo, tipeado: boolean): { color: string; texto: string; placeholder: string } {
  if (tipeado) return { color: 'var(--primary)', texto: 'sin guardar', placeholder: '' };
  if (c.ilegible) return { color: 'var(--bad)', texto: 'ilegible', placeholder: 'Volvé a pegarla' };
  if (c.configurado) return { color: 'var(--good)', texto: 'guardada', placeholder: `••••${c.mask}` };
  if (c.opcional) return { color: 'var(--faint)', texto: 'opcional', placeholder: 'Opcional' };
  return { color: 'var(--warn-fill)', texto: 'pendiente', placeholder: 'Pendiente' };
}

/**
 * Acción de fila: ícono + tooltip. Sin texto — el `title` explica qué hace.
 *
 * Se EXPORTA porque la barra del código de la landing usa exactamente la misma
 * acción adentro de la misma barra: copiarla sería garantizar que en dos meses
 * los botones de una barra se vean distintos de los de la otra.
 *
 * El `mk-icon-btn` no es decorativo: es el gancho con el que la variante oscura
 * de la barra (`.mk-key-row--code`) redefine el borde y el fondo, que sobre
 * negro desaparecerían.
 */
export function IconBtn({ name, title, onClick, disabled, tone = 'dim' }: {
  name: string; title: string; onClick: () => void; disabled?: boolean; tone?: 'dim' | 'bad' | 'primary' | 'good';
}) {
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'primary' ? 'var(--primary)' : tone === 'good' ? 'var(--good)' : 'var(--dim)';
  // ⚠️ El fondo y el borde NO van inline: viven en `.mk-icon-btn` (globals.css).
  // Un estilo inline le gana a cualquier clase, así que mientras estuvieron acá,
  // la variante OSCURA de la barra no podía repintarlos — los botones salían
  // blancos sobre negro, con un contraste que partía la barra al medio.
  // Lo único que sigue inline es el `color`, que depende del `tone`.
  return (
    <button type="button" className="mk-icon-btn" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      style={{ color, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
      <Icon name={name} size={15} />
    </button>
  );
}

// "¿Cómo consigo ESTA key?" — se despliega bajo su propia fila. Va en azul suave
// para que no se confunda ni con la barra gris de la key ni con el aviso de
// seguridad de arriba.
function PasosAyuda({ ayuda }: { ayuda: Tutorial }) {
  return (
    <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 11, background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)', animation: 'mkFade .18s ease' }}>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {ayuda.pasos.map((p, i) => (
          <li key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 19, height: 19, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--primary-weak)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 10, color: 'var(--primary-strong)' }}>{i + 1}</span>
            <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>{p}</span>
          </li>
        ))}
      </ol>
      {ayuda.url && (
        <a href={ayuda.url} target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12.5, fontWeight: 600, color: 'var(--primary-strong)', textDecoration: 'none' }}>
          {ayuda.urlLabel ?? 'Abrir'} ↗
        </a>
      )}
    </div>
  );
}

/**
 * El paso que va al REVÉS: algo que se copia de MaKo y se pega en la otra
 * herramienta (hoy, la URL del webhook de Fathom).
 *
 * Es un bloque propio y no la ayuda de un campo, porque no es lo mismo pegar una
 * key ACÁ que ir a pegar algo ALLÁ. Y a diferencia de un campo, esto tiene que
 * poder verse SIEMPRE: no hay estado "ya guardado" que lo dé por hecho —el valor
 * cambia si cambia el dominio, y del otro lado puede haber quedado el viejo sin
 * que nada por acá lo delate.
 */
function PasoExternoBloque({ paso }: { paso: PasoExterno }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(paso.valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* sin permiso de portapapeles: queda seleccionable a mano */ }
  };
  return (
    <div style={{ ...caja, background: 'var(--warn-bg)', borderColor: 'var(--warn-fill)', padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{paso.titulo}</div>
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 4 }}>{paso.porque}</div>
      </div>

      {/* La URL, grande y monoespaciada, con el botón de copiar al lado. Es lo
          único accionable del bloque: todo lo demás es contexto. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <code style={{
          flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 12.5, color: 'var(--ink)',
          background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 9,
          padding: '9px 11px', overflowX: 'auto', whiteSpace: 'nowrap',
        }}>{paso.valor}</code>
        <button type="button" onClick={copiar}
          style={{
            flex: 'none', padding: '9px 14px', borderRadius: 9, border: 'none', background: 'var(--ink)',
            color: 'var(--on-sidebar)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}>
          {copiado ? '¡Copiada!' : 'Copiar'}
        </button>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
        <b style={{ color: 'var(--ink)' }}>Dónde va:</b> {paso.donde}
      </div>

      {!!paso.ojo?.length && (
        <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {paso.ojo.map((o, i) => (
            <li key={i} style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>{o}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Por qué esto es seguro, sin marketing: cada línea es algo que el código hace
// de verdad. Ojo al mantenerlo — si cambia lib/credenciales.ts o el guard de
// /api/integraciones/credencial, este texto pasa a ser mentira.
//
// Va ARRIBA de todo y a propósito NO usa la caja gris de las filas de key: es un
// encabezado (candado + línea + link), no un campo más para completar.
function AvisoSeguridad({ abierto, onToggle }: { abierto: boolean; onToggle: () => void }) {
  const b: CSSProperties = { color: 'var(--ink)', fontWeight: 600 };
  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: abierto ? 15 : 0 }}>
      <button type="button" onClick={onToggle} aria-expanded={abierto}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 13px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SANS }}>
        <span aria-hidden style={{ flex: 'none', width: 27, height: 27, borderRadius: 999, background: 'var(--good-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, lineHeight: 1 }}>🔒</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Tus llaves son seguras.</span>
        <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--primary)' }}>{abierto ? 'Ocultar' : 'Cómo las guardamos'}</span>
      </button>
      {abierto && (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <li style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          <span style={b}>Se guardan siempre cifradas.</span> Viajan por conexión segura y se cifran con AES-256-GCM
          —cifrado de grado bancario, con una clave única por escritura— antes de tocar la base. Ahí queda el texto
          cifrado, nunca tu token: si alguien manipulara esa fila, el sistema lo detecta y la rechaza.
        </li>
        <li style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          <span style={b}>La llave que las abre no está en la base.</span> La clave para descifrarlas vive en el
          servidor, separada de la base de datos. Una copia de la base, por sí sola, no sirve para leer nada.
        </li>
        <li style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          <span style={b}>Se descifran solo en el servidor.</span> Esta pantalla nunca recibe el valor completo:
          solo los últimos 4 caracteres. Para verla entera hay que pedirla con el ojito —es una acción aparte,
          registrada— y se vuelve a ocultar sola a los pocos segundos.
        </li>
        <li style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          <span style={b}>Solo tú las ves.</span> Revelar una credencial está habilitado únicamente para el
          administrador de este espacio; un closer, un setter o alguien de otro espacio reciben un acceso denegado,
          y el soporte de MaKo tampoco puede verlas. Cada vez que se consulta una llave, queda registrado.
        </li>
        <li style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
          <span style={b}>Son tuyas y solo tuyas.</span> Cada espacio de trabajo tiene su propia fila cifrada,
          aislada del resto, y puedes borrarlas cuando quieras desde acá.
        </li>
      </ul>
      )}
    </div>
  );
}

export default function ServicioConfigForm({ servicioKey, onEstado, onFacts, onGuardado }: {
  servicioKey: string;
  onEstado?: (conectada: boolean) => void;
  /**
   * Se guardó una credencial de este servicio, sea la que sea.
   *
   * No alcanza con `onEstado`: ese avisa solo cuando CAMBIA el conectado/no
   * conectado, así que sumar una segunda cuenta a un proveedor ya conectado —
   * justo lo que se hace cuando el primero se quedó sin cuota— no avisaba nada
   * y el cuadro de error quedaba pintado como si no hubiera pasado nada.
   */
  onGuardado?: () => void;
  /**
   * Los datos reales que devolvió el ping al probar. Los usa el aside negro
   * (PanelMarketing) para cambiar el carrusel de marketing por la prueba de que
   * quedó conectado, en el momento exacto en que el cliente aprieta el tilde.
   */
  onFacts?: (facts: Array<{ k: string; v: string; c?: string }>) => void;
}) {
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [probando, setProbando] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  // Mensajes POR KEY: el resultado sale abajo de la fila que lo pidió.
  const [msg, setMsg] = useState<Record<string, Msg>>({});
  const [segAbierto, setSegAbierto] = useState(false);
  const [ayudaAbierta, setAyudaAbierta] = useState<Record<string, boolean>>({});
  // Texto plano de las credenciales que el admin pidió ver. Nunca viene en la
  // carga del modal: se pide de a una (action 'revelar') y queda auditado.
  const [revelado, setRevelado] = useState<Record<string, string>>({});
  const [revelando, setRevelando] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Borrar es irreversible → confirmación. Guarda el campo a borrar.
  const [aBorrar, setABorrar] = useState<Campo | null>(null);
  // Lo último que sabe el de afuera. Solo se le avisa si CAMBIA: si avisáramos
  // en cada carga, abrir el modal dispararía un refresh del board al pedo.
  const conectadaRef = useRef<boolean | null>(null);
  // Dos guardados en vuelo devuelven cada uno su foto del servicio, y la lenta
  // puede llegar última con datos viejos y "despintar" la key que ya guardaste.
  // Cada mutación se numera y solo se aplica la foto más nueva.
  const seq = useRef(0);
  const ultimaAplicada = useRef(0);

  // ── Meta: con el token pegado, la app completa el resto de los campos ──────
  // Antes le pedíamos 6 credenciales de 6 pantallas distintas de Business Manager.
  // Cinco salen del token. Lo único que no se puede adivinar es CUÁL elegir si el
  // cliente tiene varias cuentas/páginas/píxeles: eso vuelve acá como `opciones`.
  const [descubriendo, setDescubriendo] = useState(false);
  const [opciones, setOpciones] = useState<OpcionesMeta>({ cuentas: [], paginas: [], pixeles: [] });
  const [avisosMeta, setAvisosMeta] = useState<string[]>([]);
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  // "Cargarlos a mano": el escape hatch para los campos que normalmente completa
  // la app. Cerrado por default — si estuviera abierto, volveríamos a la pantalla
  // de seis inputs que este rediseño vino a sacar.
  const [manual, setManual] = useState(false);
  // Cuentas EXTRA del mismo proveedor que el usuario pidió agregar en esta sesión.
  // Las ya cargadas se muestran siempre; las vacías, solo cuando las pide — si no,
  // conectar Gemini pasaba de un campo a tres y el segundo y el tercero no le
  // sirven a la enorme mayoría, que tiene una sola cuenta.
  const [extrasAbiertas, setExtrasAbiertas] = useState<string[]>([]);

  const hayQueElegir = opciones.cuentas.length > 0 || opciones.paginas.length > 0 || opciones.pixeles.length > 0;

  // GitHub: los repos que ve el token. El dueño tuvo que ADIVINAR «usuario/repo» la
  // primera vez —«sería mucho más fácil si es un desplegable»— y tenía razón: el dato ya
  // lo tiene GitHub, porque un token fine-grained se emite contra repos concretos.
  const [repos, setRepos] = useState<Array<{ value: string; label: string }>>([]);
  const [repoElegido, setRepoElegido] = useState('');

  const descubrirGithub = async (mostrarMsgEn = 'GITHUB_TOKEN') => {
    setDescubriendo(true);
    try {
      const n = ++seq.current;
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'descubrir-github' }),
      }).then((r) => r.json());
      if (!j.ok) { ponerMsg(mostrarMsgEn, { ok: false, text: j.error ?? 'No pude leer tus repos.' }); return; }
      if (j.servicio) aplicar(j.servicio as Servicio, n);
      setRepos((j.opciones as Array<{ value: string; label: string }>) ?? []);
      if (j.repo) setRepoElegido(String(j.repo));
      if (j.mensaje) ponerMsg(mostrarMsgEn, { ok: true, text: String(j.mensaje) });
    } finally { setDescubriendo(false); }
  };

  const elegirRepo = async (valor: string) => {
    setRepoElegido(valor);
    const j = await fetch('/api/integraciones/credencial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servicio: 'github', valores: { GITHUB_REPO: valor } }),
    }).then((r) => r.json());
    if (j.ok) { setRepos([]); ponerMsg('GITHUB_TOKEN', { ok: true, text: `Listo: ${valor}.` }); }
    else ponerMsg('GITHUB_TOKEN', { ok: false, text: j.error ?? 'No pude guardarlo.' });
  };

  const aplicar = (s: Servicio, n?: number) => {
    if (n !== undefined) {
      if (n < ultimaAplicada.current) return; // llegó tarde: ya hay algo más nuevo
      ultimaAplicada.current = n;
    }
    setServicio(s);
    const c = calcConectada(s.campos);
    if (conectadaRef.current !== null && c !== conectadaRef.current) onEstado?.(c);
    conectadaRef.current = c;
  };

  const cargar = () => {
    // Entra en la misma numeración que los guardados: la recarga de después de
    // borrar no puede pisar a un guardado más nuevo, ni al revés.
    const n = ++seq.current;
    setErrorCarga(null);
    fetch(`/api/integraciones/credencial?servicio=${encodeURIComponent(servicioKey)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.servicio) aplicar(j.servicio as Servicio, n);
        else setErrorCarga(j.error === 'solo admin' ? 'Necesitás ser admin para configurar esta integración.' : (j.error ?? 'No se pudo cargar el estado.'));
      })
      .catch(() => setErrorCarga('No se pudo cargar. Revisá tu conexión y probá de nuevo.'))
      .finally(() => setCargando(false));
  };

  // Al cambiar de servicio (o cerrar el modal) no quedan timers vivos ni se
  // arrastra a la vista el secreto que se reveló en el anterior.
  useEffect(() => {
    cargar();
    const t = timers.current;
    return () => {
      for (const env of Object.keys(t)) { clearTimeout(t[env]); delete t[env]; }
      setRevelado({});
      setMsg({});
    };
    // `cargar` se re-crea en cada render: incluirla recargaría en loop. El
    // servicio es lo único que debe disparar la recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicioKey]);

  // Escape con el confirm abierto: cancela SOLO el confirm. Va en captura y
  // frena la propagación porque /integraciones tiene un listener global de
  // Escape que si no cerraría el modal entero por debajo del diálogo.
  useEffect(() => {
    if (!aBorrar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setABorrar(null);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [aBorrar]);

  const ponerMsg = (env: string, m: Msg | null) =>
    setMsg((v) => { const nv = { ...v }; if (m) nv[env] = m; else delete nv[env]; return nv; });

  const ocultar = (env: string) => {
    clearTimeout(timers.current[env]);
    delete timers.current[env];
    setRevelado((r) => { const nr = { ...r }; delete nr[env]; return nr; });
  };

  const taparTodo = () => {
    for (const env of Object.keys(timers.current)) { clearTimeout(timers.current[env]); delete timers.current[env]; }
    setRevelado({});
  };

  // Si te vas de la pestaña o la ventana pierde el foco, se tapa sola sin esperar
  // al reloj: irse a otro lado con un token a la vista es justo lo que queremos
  // evitar. (Salir de /integraciones desmonta el componente → lo limpia el otro
  // efecto.) Solo escucha mientras haya algo revelado.
  const hayRevelado = Object.keys(revelado).length > 0;
  useEffect(() => {
    if (!hayRevelado) return;
    const onVis = () => { if (document.visibilityState === 'hidden') taparTodo(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', taparTodo);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', taparTodo);
    };
  }, [hayRevelado]);

  const copiar = async (env: string, valor: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      ponerMsg(env, { ok: true, text: 'Copiada al portapapeles.' });
    } catch {
      ponerMsg(env, { ok: false, text: 'El navegador no dejó copiar — seleccionala a mano.' });
    }
  };

  const revelar = async (env: string) => {
    setRevelando(env); ponerMsg(env, null);
    try {
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revelar', env }),
      }).then((r) => r.json());
      if (j.ok && typeof j.valor === 'string') {
        setRevelado((r) => ({ ...r, [env]: j.valor as string }));
        timers.current[env] = setTimeout(() => ocultar(env), OCULTAR_MS);
      } else ponerMsg(env, { ok: false, text: j.error ?? 'No se pudo mostrar la credencial.' });
    } catch { ponerMsg(env, { ok: false, text: 'No se pudo mostrar la credencial. Probá de nuevo.' }); }
    finally { setRevelando(null); }
  };

  // Probar es del SERVICIO (el ping necesita todos los campos), pero el
  // resultado se muestra en la fila desde la que lo pediste.
  const probar = async (env: string) => {
    if (!servicio) return;
    setProbando(env); ponerMsg(env, null);
    try {
      const enviados: Record<string, string> = {};
      for (const c of servicio.campos) {
        const v = (valores[c.env] ?? '').trim();
        if (v) enviados[c.env] = v;
      }
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verificar', servicio: servicio.key, valores: enviados }),
      }).then((r) => r.json());
      ponerMsg(env, j.ok ? { ok: true, text: j.detalle ?? 'Conexión OK.' } : { ok: false, text: j.error ?? 'No se pudo verificar.' });
      if (j.ok && Array.isArray(j.facts) && j.facts.length) onFacts?.(j.facts);
    } catch { ponerMsg(env, { ok: false, text: 'No se pudo verificar. Probá de nuevo.' }); }
    finally { setProbando(null); }
  };

  /**
   * El tilde NO es solo "guardar": primero prueba la credencial contra el
   * proveedor y, si no funciona, NO la guarda. Una key rota no entra: el usuario
   * no tiene que acordarse de apretar otro botón para enterarse.
   *
   * Con una salvedad honesta: el ping es del SERVICIO, no del campo. Si todavía
   * faltan otros campos obligatorios no hay contra qué probar —Meta pide token
   * Y cuenta— así que se guarda igual y se dice qué falta para poder probarla.
   * Sin esto, la primera key de un servicio de varios campos sería imposible de
   * guardar: siempre fallaría por culpa de las que todavía no cargaste.
   */
  const guardarCampo = async (env: string) => {
    if (!servicio) return;
    const v = (valores[env] ?? '').trim();
    if (!v) return;
    const n = ++seq.current;
    setGuardando(env); ponerMsg(env, null);
    try {
      const enviados = tipeados(servicio.campos, valores);
      const faltan = servicio.campos.filter((c) => !c.opcional && !c.configurado && !enviados[c.env]);
      // Espejo del guard anti-SSRF de lib/metodo-verificar.ts: si el host lo trae
      // el request y algún secreto sale de la base, ese ping se rechaza. No es que
      // la key esté mal — no se puede probar todavía.
      const hostTipeado = servicio.campos.some((c) => c.host && enviados[c.env]);
      const secretoGuardado = servicio.campos.some((c) => c.secreto && !enviados[c.env] && c.configurado);
      const motivoSinProbar = faltan.length
        ? `Falta ${faltan.map((c) => c.label).join(', ')} para poder probarla.`
        : (hostTipeado && secretoGuardado ? 'Para probarla con una URL nueva, volvé a pegar también las credenciales secretas.' : null);

      if (!motivoSinProbar) {
        const p = await fetch('/api/integraciones/credencial', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verificar', servicio: servicio.key, valores: enviados }),
        }).then((r) => r.json());
        // No funciona → no se guarda. Es el punto de que el tilde valide.
        if (!p.ok) { ponerMsg(env, { ok: false, text: `${p.error ?? 'No se pudo validar.'} No la guardé.` }); return; }
        if (Array.isArray(p.facts) && p.facts.length) onFacts?.(p.facts);
      }

      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guardar', servicio: servicio.key, valores: { [env]: v } }),
      }).then((r) => r.json());
      if (j.ok && j.servicio) {
        aplicar(j.servicio as Servicio, n);
        onGuardado?.();
        setValores((val) => { const nv = { ...val }; delete nv[env]; return nv; });
        // El token de Meta es el único campo que el cliente pega: apenas queda
        // guardado, la app sale a buscar cuenta, página, token de página y píxel.
        // (El mensaje lo pone descubrirMeta, que sabe cuántos campos completó.)
        if (servicio.key === 'meta' && env === 'META_ACCESS_TOKEN') { void descubrirMeta(env); return; }
        // Mismo molde para GitHub: con el token pegado, el repo sale solo.
        if (servicio.key === 'github' && env === 'GITHUB_TOKEN') { void descubrirGithub(); return; }
        ponerMsg(env, { ok: true, text: motivoSinProbar ? `Guardada. ${motivoSinProbar}` : 'Guardada y probada — funciona.' });
      } else ponerMsg(env, { ok: false, text: j.error ?? 'No se pudo guardar.' });
    } catch { ponerMsg(env, { ok: false, text: 'No se pudo guardar. Probá de nuevo.' }); }
    finally { setGuardando(null); }
  };

  /**
   * Meta: pide a la app que complete los campos que puede sacar sola del token.
   * Se llama solo (al guardar el token) y también a mano desde el botón. Nunca
   * rompe el flujo: si falla, el cliente sigue pudiendo cargar todo a mano.
   */
  const descubrirMeta = async (mostrarMsgEn?: string) => {
    setDescubriendo(true);
    try {
      const n = ++seq.current;
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'descubrir' }),
      }).then((r) => r.json());
      if (!j.ok) {
        if (mostrarMsgEn) ponerMsg(mostrarMsgEn, { ok: false, text: j.error ?? 'No se pudo leer tu cuenta de Meta.' });
        return;
      }
      if (j.servicio) aplicar(j.servicio as Servicio, n);
      setOpciones((j.opciones as OpcionesMeta) ?? { cuentas: [], paginas: [], pixeles: [] });
      const avisos = Array.isArray(j.avisos) ? (j.avisos as string[]) : [];
      // Un permiso que falta es lo ÚNICO que el cliente tiene que ir a arreglar a
      // Meta, así que se nombra con su nombre exacto en vez de un error genérico.
      const faltan = Array.isArray(j.faltanScopes) ? (j.faltanScopes as string[]) : [];
      if (faltan.length) avisos.unshift(`A tu token le faltan permisos (${faltan.join(', ')}). Volvé a generarlo marcándolos y pegalo de nuevo.`);
      setAvisosMeta(avisos);
      if (mostrarMsgEn) {
        const guardadas = Array.isArray(j.guardadas) ? j.guardadas.length : 0;
        ponerMsg(mostrarMsgEn, {
          ok: true,
          text: guardadas
            ? `Guardada. Completé ${guardadas} campo${guardadas === 1 ? '' : 's'} solo${guardadas === 1 ? '' : 's'} desde tu cuenta de Meta.`
            : 'Guardada. Revisá los avisos de abajo para que pueda completar el resto.',
        });
      }
    } catch {
      if (mostrarMsgEn) ponerMsg(mostrarMsgEn, { ok: false, text: 'Guardada, pero no pude leer tu cuenta de Meta. Probá "Buscar mis datos".' });
    } finally { setDescubriendo(false); }
  };

  /** El cliente eligió una de varias cuentas/páginas/píxeles. */
  const elegirMeta = async (tipo: 'cuenta' | 'pagina' | 'pixel', id: string) => {
    setEligiendo(tipo);
    try {
      const n = ++seq.current;
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'elegir', tipo, id }),
      }).then((r) => r.json());
      if (!j.ok) { setAvisosMeta([j.error ?? 'No se pudo guardar tu elección.']); return; }
      if (j.servicio) aplicar(j.servicio as Servicio, n);
      // Elegir la cuenta destraba los píxeles (cuelgan de ella): la respuesta trae
      // los que haya, y se consume la lista del tipo que acaba de elegirse.
      setOpciones((o) => ({
        cuentas: tipo === 'cuenta' ? [] : o.cuentas,
        paginas: tipo === 'pagina' ? [] : o.paginas,
        pixeles: tipo === 'pixel' ? [] : ((j.opciones as OpcionesMeta | undefined)?.pixeles ?? o.pixeles),
      }));
      setAvisosMeta(Array.isArray(j.avisos) ? (j.avisos as string[]) : []);
    } catch { setAvisosMeta(['No se pudo guardar tu elección. Probá de nuevo.']); }
    finally { setEligiendo(null); }
  };

  const quitar = async (env: string) => {
    setQuitando(env); ponerMsg(env, null);
    try {
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'borrar', env }),
      }).then((r) => r.json());
      if (j.ok) {
        ocultar(env);
        setValores((v) => { const nv = { ...v }; delete nv[env]; return nv; });
        cargar();
      } else ponerMsg(env, { ok: false, text: j.error ?? 'No se pudo quitar.' });
    } catch { ponerMsg(env, { ok: false, text: 'No se pudo quitar. Probá de nuevo.' }); }
    finally { setQuitando(null); }
  };

  if (cargando) {
    return <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)', padding: '6px 0' }}>Cargando configuración…</div>;
  }
  if (errorCarga || !servicio) {
    return (
      <div style={{ ...caja, padding: '13px 15px' }}>
        <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 8 }}>{errorCarga ?? 'No se pudo cargar la configuración.'}</div>
        <button type="button" onClick={() => { setCargando(true); cargar(); }}
          style={{ padding: '9px 15px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Arriba de todo: qué pasa con lo que estás por pegar. */}
      <AvisoSeguridad abierto={segAbierto} onToggle={() => setSegAbierto((o) => !o)} />

      {/* ── Las credenciales que el cliente SÍ tiene que pegar ───────────────
          Los campos `auto` (los que la app saca sola de otro campo: en Meta, 5
          de 6) no se piden acá — salen abajo como resultado, y solo se pueden
          editar a mano si el cliente abre "cargarlos a mano". Pedir seis tokens
          cuando cinco se descubren solos era la fricción entera del paso. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {servicio.campos.filter((c) => (!c.auto || manual) && ((c.slot ?? 1) === 1 || c.configurado || extrasAbiertas.includes(c.env))).map((c) => {
          const tipeado = !!(valores[c.env] ?? '').trim();
          const sem = semaforo(c, tipeado);
          const cerrada = estaCerrada(c);
          const verValor = revelado[c.env];
          const m = msg[c.env];
          const ocupada = guardando === c.env || probando === c.env || quitando === c.env || revelando === c.env;
          return (
            <div key={c.env}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                <span style={{ flex: 'none', marginLeft: 'auto', fontFamily: MONO, fontSize: 10.5, color: sem.color, whiteSpace: 'nowrap' }}>{sem.texto}</span>
              </div>

              {/* UNA barra: semáforo + valor + acciones, todo adentro */}
              <div className="mk-key-row">
                <span aria-hidden style={{ flex: 'none', width: 7, height: 7, borderRadius: 999, background: sem.color }} />

                {cerrada && !verValor ? (
                  <span style={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 13, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {/* Un campo NO secreto (el email de la cuenta) se muestra entero:
                        enmascarado se vería «••••.com», que es justo lo contrario de
                        para lo que existe — distinguir de un vistazo diez cuentas. */}
                    {c.secreto ? `••••${c.mask}` : c.mask}
                  </span>
                ) : verValor ? (
                  // Revelada: NO se edita, se copia. Va como botón y no como input
                  // para que quede claro que no es un campo — y sigue siendo del
                  // mismo alto que el resto de los estados.
                  <button type="button" onClick={() => copiar(c.env, verValor)}
                    title="Clic para copiar" aria-label={`Copiar ${c.label}`}
                    style={{
                      flex: 1, minWidth: 0, alignSelf: 'stretch', border: 0, background: 'transparent',
                      padding: 0, textAlign: 'left', cursor: 'pointer',
                      fontFamily: MONO, fontSize: 13, color: 'var(--ink)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                    {verValor}
                  </button>
                ) : (
                  <input
                    className="mk-key-input"
                    type={c.secreto ? 'password' : 'text'}
                    value={valores[c.env] ?? ''}
                    // El placeholder del catálogo (ej. "EAAG…", "act_1234567890")
                    // es la pista de FORMATO que evita que peguen cualquier cosa.
                    // Se pierde solo cuando el semáforo tiene algo más urgente que
                    // decir (credencial ilegible: "volvé a pegarla").
                    placeholder={!c.ilegible && c.placeholder ? c.placeholder : sem.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={c.label}
                    onChange={(e) => setValores((v) => ({ ...v, [c.env]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && tipeado) guardarCampo(c.env); }}
                  />
                )}

                {/* Qué botones tiene cada estado:
                    · guardada       → ver · probar · quitar
                    · algo tipeado   → ayuda · guardar (el tilde YA prueba antes
                                       de guardar, así que un "probar" aparte
                                       sobra y confunde)
                    · vacía          → ayuda, y nada más: sin key no hay nada que
                                       guardar ni que probar. */}
                {cerrada ? (
                  <>
                    {verValor
                      ? <IconBtn name="eye-off" title="Ocultar" tone="primary" onClick={() => ocultar(c.env)} />
                      : <IconBtn name="eye" title="Ver la credencial (se oculta sola)" disabled={ocupada} onClick={() => revelar(c.env)} />}
                    <IconBtn name="plug" title={probando === c.env ? 'Probando conexión…' : 'Probar conexión'} disabled={ocupada} onClick={() => probar(c.env)} />
                    <IconBtn name="trash" title="Quitar credencial" tone="bad" disabled={ocupada} onClick={() => setABorrar(c)} />
                  </>
                ) : (
                  <>
                    <IconBtn name="help" title={ayudaAbierta[c.env] ? 'Ocultar la ayuda' : `¿Cómo consigo ${c.label.toLowerCase()}?`}
                      tone={ayudaAbierta[c.env] ? 'primary' : 'dim'}
                      onClick={() => setAyudaAbierta((a) => ({ ...a, [c.env]: !a[c.env] }))} />
                    {tipeado && (
                      <IconBtn name="check" title={guardando === c.env ? 'Probando y guardando…' : 'Probar y guardar esta credencial'} tone="good" disabled={ocupada} onClick={() => guardarCampo(c.env)} />
                    )}
                  </>
                )}
              </div>

              {/* El resultado sale ACÁ, abajo de su propia key. */}
              {m && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', margin: '7px 0 0', fontSize: 12.5, fontWeight: 500, color: m.ok ? 'var(--good)' : 'var(--bad)', lineHeight: 1.45 }}>
                  <span style={{ flex: 'none' }}>{m.ok ? '✓' : '✗'}</span>
                  <span>{m.text}</span>
                </div>
              )}
              {c.ilegible && <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 6, lineHeight: 1.45 }}>Guardada pero ilegible (rotó la clave de cifrado) — volvé a pegarla.</div>}

              {/* La nota del catálogo dice qué es ESTE campo y de dónde sale ("Lo
                  completa MaKo", "Con el prefijo act_"). Solo mientras está por
                  cargarse: con la credencial ya guardada sobra, y con la ayuda
                  abierta la repetiría el tutorial. */}
              {!cerrada && !ayudaAbierta[c.env] && c.nota && (
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6, lineHeight: 1.45 }}>{c.nota}</div>
              )}

              {/* Ayuda de ESTA key. Solo mientras NO esté guardada: al guardar la
                  credencial (cerrada), el tutorial se cierra solo (no queda colgado). */}
              {!cerrada && ayudaAbierta[c.env] && <PasosAyuda ayuda={c.ayuda ?? servicio.tutorial} />}
            </div>
          );
        })}

        {/* ── Otra cuenta del mismo proveedor ────────────────────────────────
            El free tier se agota por CUENTA, no por proveedor: con dos keys de
            Gemini tenés el doble de cuota gratis, y MaKo pasa de una a la otra
            sola cuando la primera se queda sin nafta. Aparece SOLO con la
            primera ya guardada — ofrecer la segunda antes que la primera es
            pedir dos cosas para que funcione una. */}
        {(() => {
          const primera = servicio.campos.find((c) => (c.slot ?? 1) === 1);
          if (!primera?.configurado) return null;
          const proxima = servicio.campos.find((c) => (c.slot ?? 1) > 1 && !c.configurado && !extrasAbiertas.includes(c.env));
          const cargadas = servicio.campos.filter((c) => (c.slot ?? 1) > 1 && c.configurado).length + 1;
          if (!proxima) {
            return (
              <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.45 }}>
                {cargadas} cuentas conectadas — MaKo rota entre ellas cuando una se queda sin cuota.
              </div>
            );
          }
          return (
            <button type="button" onClick={() => setExtrasAbiertas((a) => [...a, proxima.env])}
              style={{
                alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 13px', borderRadius: 10, border: '1px dashed var(--border-strong)',
                background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}>
              <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>+</span>
              Agregar otra cuenta de {servicio.nombre}
            </button>
          );
        })()}
      </div>

      {/* ── El paso que va al revés ──────────────────────────────────────────
          Después de los campos porque primero se completa lo de acá y recién
          después se sale a la otra herramienta. Se muestra SIEMPRE, aunque las
          credenciales ya estén guardadas: que el secret esté cargado no prueba
          que la URL del otro lado sea la correcta (después de una mudanza de
          dominio, justamente, no lo es). */}
      {servicio.pasoExterno && <PasoExternoBloque paso={servicio.pasoExterno} />}

      {/* ── Lo que completó la app: resultado, no formulario ─────────────────
          Una línea por campo `auto`, con su tilde. No hay inputs: si el cliente
          quiere tocarlos, abre "cargarlos a mano" y recién ahí aparecen arriba. */}
      {(() => {
        const autos = servicio.campos.filter((c) => c.auto);
        if (!autos.length || manual) return null;
        const listos = autos.filter((c) => c.configurado && !c.ilegible);
        return (
          <div style={{ ...caja, padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>
              Esto lo completa MaKo
            </div>
            {listos.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                Al guardar {servicio.campos.find((c) => !c.auto)?.label.toLowerCase() ?? 'la credencial'}, MaKo busca el resto en tu cuenta y lo completa solo.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {autos.map((c) => {
                  const ok = c.configurado && !c.ilegible;
                  return (
                    <div key={c.env} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                      <span aria-hidden style={{ flex: 'none', color: ok ? 'var(--good)' : 'var(--faint)' }}>{ok ? '✓' : '·'}</span>
                      <span style={{ flex: 1, minWidth: 0, color: ok ? 'var(--ink)' : 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                      <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>
                        {ok ? `••••${c.mask}` : (c.opcional ? 'no hace falta' : 'pendiente')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Meta: lo que la app completó sola, y lo único que hay que elegir ──
          Vive acá (y no en cada superficie) porque este componente es el mismo
          que usan /integraciones, el onboarding y el panel de activación. */}
      {servicio.key === 'meta' && (descubriendo || hayQueElegir || avisosMeta.length > 0) && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {descubriendo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--dim)' }}>
              <span aria-hidden style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid var(--border-strong)', borderTopColor: 'var(--primary)', animation: 'mk-spin .8s linear infinite', flex: 'none' }} />
              Buscando tu cuenta, tu página y tu píxel en Meta…
            </div>
          ) : (
            <>
              {hayQueElegir && (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  Tenés más de una: elegí cuál usamos.
                </div>
              )}
              {opciones.cuentas.length > 0 && (
                <Elegir etiqueta="Cuenta publicitaria" cargando={eligiendo === 'cuenta'}
                  opciones={opciones.cuentas.map((c) => ({ value: c.id, label: c.nombre, sub: `${c.id}${c.moneda ? ` · ${c.moneda}` : ''}${c.activa === false ? ' · con restricción' : ''}` }))}
                  onElegir={(id) => elegirMeta('cuenta', id)} />
              )}
              {opciones.paginas.length > 0 && (
                <Elegir etiqueta="Página de Facebook" cargando={eligiendo === 'pagina'}
                  opciones={opciones.paginas.map((p) => ({ value: p.id, label: p.nombre, sub: p.id }))}
                  onElegir={(id) => elegirMeta('pagina', id)} />
              )}
              {opciones.pixeles.length > 0 && (
                <Elegir etiqueta="Píxel" cargando={eligiendo === 'pixel'}
                  opciones={opciones.pixeles.map((p) => ({ value: p.id, label: p.nombre, sub: p.id }))}
                  onElegir={(id) => elegirMeta('pixel', id)} />
              )}
              {avisosMeta.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.45 }}>
                  <span style={{ flex: 'none' }}>!</span><span>{a}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* El escape hatch, en chico y al final: quien QUIERA pegar los campos a
          mano puede, pero no es el camino por default. */}
      {servicio.campos.some((c) => c.auto) && (
        <button type="button" onClick={() => setManual((m) => !m)}
          style={{ alignSelf: 'flex-start', border: 0, background: 'none', padding: 0, color: 'var(--faint)', fontFamily: SANS, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
          {manual ? 'Ocultar los campos que completa MaKo' : 'Prefiero cargarlos a mano'}
        </button>
      )}

      {/* GitHub: el repo se ELIGE, no se escribe. */}
      {servicio.key === 'github' && (descubriendo || repos.length > 0 || repoElegido) && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {descubriendo ? (
            <div style={{ fontFamily: SANS, fontSize: 13, color: 'var(--dim)' }}>Buscando tus repos…</div>
          ) : repos.length > 0 ? (
            <>
              <div style={{ fontFamily: SANS, fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>¿Cuál es el repo de MaKo?</div>
              <Dropdown
                value={repoElegido}
                onChange={(v) => void elegirRepo(String(v))}
                options={repos.map((r) => ({ value: r.value, label: r.label }))}
                placeholder="Elegí el repositorio…"
              />
            </>
          ) : repoElegido ? (
            <div style={{ fontFamily: SANS, fontSize: 13, color: 'var(--dim)' }}>
              Repositorio: <strong style={{ color: 'var(--ink)' }}>{repoElegido}</strong>
            </div>
          ) : null}
        </div>
      )}

      {servicio.key === 'github' && !descubriendo && servicio.campos.some((c) => c.env === 'GITHUB_TOKEN' && c.configurado) && (
        <button type="button" onClick={() => void descubrirGithub()}
          style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          ↻ Buscar mis repos
        </button>
      )}

      {/* Reintento a mano: si el cliente arregla los permisos o asigna la página
          en Business Manager, no tiene que borrar y volver a pegar el token. */}
      {servicio.key === 'meta' && !descubriendo && servicio.campos.some((c) => c.env === 'META_ACCESS_TOKEN' && c.configurado) && (
        <button type="button" onClick={() => descubrirMeta('META_ACCESS_TOKEN')}
          style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          ↻ Buscar mis datos en Meta
        </button>
      )}

      {/* zIndex 310: el modal de /integraciones va en 300 y el confirm tiene que
          quedar ARRIBA (el default de 120 lo dejaría invisible por debajo). */}
      {aBorrar && (
        <ConfirmDialog
          zIndex={310}
          tone="danger"
          title={`¿Quitar ${aBorrar.label}?`}
          message={<>Se borra de tu espacio y <b>{servicio.nombre} deja de funcionar</b> hasta que pegues una nueva. Es la única forma de cambiarla: no se puede pisar sin borrarla antes.</>}
          confirmLabel="Quitar credencial"
          onCancel={() => setABorrar(null)}
          onConfirm={() => { const env = aBorrar.env; setABorrar(null); quitar(env); }}
        />
      )}
    </div>
  );
}

/**
 * Un desplegable de "elegí cuál" para lo que MaKo encontró en Meta y no puede
 * decidir solo (varias cuentas, páginas o píxeles). Elegir GUARDA en el acto:
 * no hay un botón aparte, porque la elección ES la acción.
 */
function Elegir({ etiqueta, opciones, cargando, onElegir }: {
  etiqueta: string;
  opciones: Array<{ value: string; label: string; sub?: string }>;
  cargando: boolean;
  onElegir: (id: string) => void;
}) {
  const [sel, setSel] = useState('');
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 5 }}>{etiqueta}</div>
      <Dropdown
        value={sel}
        onChange={(v) => { setSel(v); onElegir(v); }}
        width="100%"
        disabled={cargando}
        placeholder={cargando ? 'Guardando…' : `Elegí tu ${etiqueta.toLowerCase()}`}
        options={opciones}
      />
    </div>
  );
}
