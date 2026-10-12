'use client';

// =============================================================================
// Botón "Compartir" del portal — sirve para CUALQUIER curso, no solo Branding
// =============================================================================
// Dos modos, como Google Drive: "cualquiera con el enlace" o solo las personas
// invitadas por email (cada una recibe SU propio enlace, revocable de a una).
//
// La lista de abajo es "quién tiene acceso", no "cuántos links hay": cada
// invitado se ve como PERSONA (foto + nombre + email + si entró) y se le revoca
// el acceso de a uno. Un enlace de invitados sin gente adentro no dice nada.
//
// Estética CLARA a propósito: el portal es paper (.ahc, var(--ink)/var(--card)).
// La primera versión usaba fondo oscuro con `color: inherit` y quedaba negro
// sobre negro — ilegible.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';

type Invitado = {
  id: number; email: string; nombre: string | null; gravatar: string; token_prefijo: string;
  enviado_at: string | null; visitas: number; ultima_visita: string | null; revocado_at: string | null;
};
type ShareRow = {
  id: number; recurso: string; alcance: string; recurso_id: string | null; modo: string;
  etiqueta: string | null; token_prefijo: string; revocado_at: string | null; visitas: number;
  ultima_visita: string | null; created_at: string; invitados: Invitado[];
  /**
   * QUÉ comparte esta fila, con el nombre de HOY. Lo deriva el server con
   * `nombreDeShare` (lib/share-nombre.ts) y NO es `etiqueta`, que es el título del día
   * en que se emitió el link y ya divergió en producción.
   *
   * ⚠️ No se resuelve acá aunque el catálogo esté a mano: este componente también viaja
   * en /compartido/[token], y atarlo al catálogo de cursos le mandaría los 132 cursos al
   * navegador de cualquier pantalla que lo monte. Y el mail de invitación necesita el
   * MISMO nombre — con dos resolvedores, el modal y el mail dicen cosas distintas de la
   * misma fila.
   */
  titulo: string;
};
/** Lo que devuelve el POST por cada persona: si el mail salió, y si no, su link. */
type ResultadoInv = { email: string; nombre: string | null; enviado: boolean; error?: string; enlace?: string };

// ── Identidad visual de una persona ─────────────────────────────────────────
// Sin nombre cargado, la parte local del email es la mejor aproximación:
// "tejadomartin@gmail.com" → "Tejadomartin". Nunca dejamos el renglón vacío.
function nombreDe(i: { nombre: string | null; email: string }): string {
  if (i.nombre?.trim()) return i.nombre.trim();
  const local = i.email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return local ? local.replace(/\b\w/g, (c) => c.toUpperCase()) : i.email;
}
function iniciales(nombre: string): string {
  const p = nombre.split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}
/** Color estable por email: la misma persona siempre tiene el mismo círculo. */
function hueDe(email: string): number {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % 360;
  return h;
}

const fechaCorta = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }); }
  catch { return ''; }
};

/** Foto real si la persona tiene Gravatar; si no (d=404 → onError), iniciales. */
function Avatar({ inv }: { inv: { nombre: string | null; email: string; gravatar?: string } }) {
  const [sinFoto, setSinFoto] = useState(false);
  const nom = nombreDe(inv), hue = hueDe(inv.email);
  return (
    <span className="av" style={{ background: `hsl(${hue} 62% 88%)`, color: `hsl(${hue} 58% 26%)` }}>
      {!sinFoto && inv.gravatar && (
        <img className="av-img" alt="" src={`https://www.gravatar.com/avatar/${inv.gravatar}?d=404&s=96`}
          onError={() => setSinFoto(true)} referrerPolicy="no-referrer" />
      )}
      {iniciales(nom)}
      <style jsx>{`
        .av { position: relative; flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
          font-size: 12.5px; font-weight: 700; letter-spacing: .02em; overflow: hidden; }
        .av-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      `}</style>
    </span>
  );
}

/**
 * Lo que el modal suma en la variante 'app' (el Dashboard): entra en la pila de capas de la casa y Escape lo
 * cierra a ÉL (frenando a los demás: todos los Escape viven en `document`, y `stopPropagation` no frena a los
 * listeners hermanos). Es un componente aparte para que Conocimientos, que no lo monta, siga exactamente igual.
 */
function CapaDeApp({ onEscape }: { onEscape: () => void }) {
  const capa = useCapaModal(true);
  const arriba = capa.esElDeArriba;
  const escape = useRef(onEscape);
  useLayoutEffect(() => { escape.current = onEscape; });
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !arriba()) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      escape.current();
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [arriba]);
  return null;
}

/**
 * `recursoId` es opcional porque hay recursos que NO apuntan a una cosa: la tab
 * entera de Conocimientos (`recurso='conocimientos'`) tiene alcance 'todo' y no
 * lleva id. Sin id, la lista de "quién tiene acceso" trae todos los enlaces de
 * ese recurso, que es exactamente lo que corresponde.
 *
 * `nota` es la letra chica de QUÉ entra en el link. Va solo donde el alcance no
 * se puede leer del título: "Compartir «Curso X»" se explica solo, "Compartir
 * «Conocimientos»" no dice cuántos cursos son ni qué queda afuera.
 */
export default function Compartir({ recurso, recursoId = '', etiqueta, nota, compacto, parametros, claseBoton, abierto: abiertoDesdeAfuera, onCerrar, variante = 'conocimientos' }: {
  recurso: string; recursoId?: string; etiqueta: string; nota?: string;
  /**
   * MODO CONTROLADO (el Dashboard, tanda v5 punto 3: «Compartir» va adentro del ⋮). Con `abierto` definido el
   * componente NO dibuja su botón: lo abre quien lo monta (un renglón de un menú) y «Cerrar», el clic en el
   * fondo y Escape llaman `onCerrar`. Va montado AFUERA del menú: si viviera adentro, cerrar el menú lo
   * desmontaría junto con el modal. Sin `abierto`, el de siempre (su botón y su estado propio).
   */
  abierto?: boolean;
  onCerrar?: () => void;
  /**
   * El estilo del modal. 'conocimientos' (el de siempre, el papel y el lima del portal) o 'app' (punto 16 de
   * v5: en el Dashboard heredaba el verde de Conocimientos, porque `--card` y `--lime` no existen fuera del
   * portal y caían a sus respaldos). Con 'app', los tokens de la casa —se dan vuelta en oscuro—, sin el lima
   * ni la sombra corrida, y además entra en la pila de capas (Escape cierra sólo esto).
   */
  variante?: 'conocimientos' | 'app';
  /**
   * La clase del DISPARADOR cuando lo monta otra pantalla con su propio botón (la topbar del Dashboard
   * usa el azul de su barra, como el «Compartir» de Looker). Sin ella, el botón de Conocimientos.
   */
  claseBoton?: string;
  /**
   * Lo que viaja en CADA pedido a /api/compartir, además de lo de siempre. Lo usa el informe del
   * Dashboard (app/dashboard/CompartirInforme.tsx) para mandar la hoja abierta: el server la pega como
   * `?hoja=` en todo link que devuelve (crear, copiar, rotar e invitar). Sin esto, los pedidos son
   * idénticos a los de Conocimientos.
   */
  parametros?: Record<string, string>;
  /**
   * `compacto` es el botón para una TARJETA de la grilla, no otro componente.
   *
   * Lo único que cambia es el tamaño del disparador: el modal, los dos modos y la
   * lista de invitados son los mismos. Un segundo componente «CompartirChico» sería
   * la copia que se queda vieja — acá ya pasó con el contrato del `detalle`.
   */
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const controlado = abiertoDesdeAfuera !== undefined;
  const visible = controlado ? abiertoDesdeAfuera : abierto;
  const esApp = variante === 'app';
  const [modo, setModo] = useState<'link' | 'invitados'>('link');
  const [emails, setEmails] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<{ enlace: string | null; invitados: ResultadoInv[] } | null>(null);
  const [lista, setLista] = useState<ShareRow[] | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  // Sumar gente a un enlace que ya existe: qué share está con el form abierto,
  // qué se escribió y cómo salió el envío.
  const [sumandoA, setSumandoA] = useState<number | null>(null);
  const [sumaTexto, setSumaTexto] = useState('');
  const [sumando, setSumando] = useState(false);
  const [sumaResultado, setSumaResultado] = useState<{ shareId: number; invitados: ResultadoInv[] } | null>(null);
  // Estado del correo del workspace, y el último link reemitido (de un enlace
  // público `s:<id>` o del de una persona `p:<id>`) para poder re-copiarlo.
  const [correo, setCorreo] = useState<{ listo: boolean; remitente: string } | null>(null);
  const [linkEmitido, setLinkEmitido] = useState<{ key: string; enlace: string } | null>(null);
  // Abierto desde afuera: al abrirse, lo mismo que hace el clic del botón propio (lo de la vez anterior se va).
  // Se ajusta en el render y no en un efecto: así el primer cuadro abierto ya sale limpio.
  const [visibleAntes, setVisibleAntes] = useState(visible);
  if (visible !== visibleAntes) {
    setVisibleAntes(visible);
    if (visible && controlado) { setNuevo(null); setError(null); setSumaResultado(null); }
  }
  const cerrar = () => { if (controlado) onCerrar?.(); else setAbierto(false); };

  // `parametros` en la query de los GET/PATCH y en el cuerpo de los POST. Vacío = los pedidos de siempre.
  const extra = parametros ? new URLSearchParams(parametros).toString() : '';
  const conExtra = (q: string) => (extra ? `${q}&${extra}` : q);

  const cargar = useCallback(async () => {
    try {
      const q = `recurso=${encodeURIComponent(recurso)}&recursoId=${encodeURIComponent(recursoId)}`;
      const r = await fetch(`/api/compartir?${extra ? `${q}&${extra}` : q}`);
      const j = await r.json();
      setLista(j.ok ? j.shares : []);
      if (j.ok && j.correo) setCorreo(j.correo);
    } catch { setLista([]); }
  }, [recurso, recursoId, extra]);

  useEffect(() => { if (visible) cargar(); }, [visible, cargar]);

  async function crear() {
    setCreando(true); setError(null); setNuevo(null);
    try {
      const r = await fetch('/api/compartir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parametros, recurso, recursoId, modo, etiqueta, destinatarios: modo === 'invitados' ? emails : '' }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || 'no se pudo crear');
      else { setNuevo({ enlace: j.enlace, invitados: j.invitados || [] }); setEmails(''); cargar(); }
    } catch { setError('no se pudo crear'); }
    setCreando(false);
  }

  async function sumar(shareId: number) {
    setSumando(true); setError(null); setSumaResultado(null);
    try {
      const r = await fetch('/api/compartir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parametros, shareId, destinatarios: sumaTexto }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || 'no se pudo invitar');
      else { setSumaResultado({ shareId, invitados: j.invitados || [] }); setSumaTexto(''); setSumandoA(null); cargar(); }
    } catch { setError('no se pudo invitar'); }
    setSumando(false);
  }

  // "Copiame el link otra vez" — COPIAR, no rotar.
  //
  // Desde la mig 0131 el token se guarda además cifrado, así que el link se
  // puede volver a mostrar tal cual: se copia y listo, sin preguntar nada. Rotar
  // era la única salida cuando lo único guardado era el hash, y preguntar por
  // algo que el usuario no pidió («estoy queriendo copiarlo, no rotar el link»).
  //
  // La rotación sobrevive para UN caso: las filas anteriores a la migración, de
  // las que no hay token que recuperar. Ahí sí se pregunta, porque mata el link
  // que ya está repartido.
  async function copiarLink(key: string, id: number, esInvitado: boolean, quien: string) {
    // Si ya lo tenemos a la vista, se re-copia sin volver a pedirlo.
    if (linkEmitido?.key === key) { copiar(linkEmitido.enlace, key); return; }
    setError(null);
    try {
      const q = esInvitado ? `copiarInvitado=${id}` : `copiar=${id}`;
      const r = await fetch(`/api/compartir?${conExtra(q)}`);
      const j = await r.json();
      if (j.ok && j.enlace) { setLinkEmitido({ key, enlace: j.enlace }); copiar(j.enlace, key); return; }
      // `ok` con `enlace: null` = fila vieja. No es un error: es que hay que rotar.
      if (j.ok) { await reemitir(key, esInvitado ? `invitado=${id}` : `id=${id}`, avisoViejo(quien)); return; }
      setError(j.error || 'no se pudo copiar el link');
    } catch { setError('no se pudo copiar el link'); }
  }

  /** Emite un token NUEVO. Mata el anterior, así que siempre pregunta. */
  async function reemitir(key: string, query: string, aviso: string) {
    if (!confirm(aviso)) return;
    setError(null);
    try {
      const r = await fetch(`/api/compartir?${conExtra(query)}`, { method: 'PATCH' });
      const j = await r.json();
      if (!j.ok) { setError(j.error || 'no se pudo generar el link'); return; }
      setLinkEmitido({ key, enlace: j.enlace });
      copiar(j.enlace, key);
      cargar();
    } catch { setError('no se pudo generar el link'); }
  }

  const visitasTxt = (n: number) => `${n} ${n === 1 ? 'visita' : 'visitas'}`;

  /** El aviso de una fila vieja: no hay token que copiar, solo se puede emitir
   *  otro. Dice el porqué, porque si no parece un capricho. */
  const avisoViejo = (quien: string) =>
    `${quien} es de antes de que se pudiera volver a copiar el link, así que de éste solo queda un hash: no hay forma de mostrarlo.\n\n`
    + 'Lo único posible es emitir uno NUEVO, y el que ya esté repartido deja de funcionar.\n\n¿Emitir uno nuevo?';

  async function revocar(id: number, invitadoId?: number) {
    await fetch(`/api/compartir?${invitadoId ? `invitado=${invitadoId}` : `id=${id}`}`, { method: 'DELETE' }).catch(() => {});
    cargar();
  }

  const copiar = (txt: string, key: string) => {
    navigator.clipboard?.writeText(txt);
    setCopiado(key); setTimeout(() => setCopiado((c) => (c === key ? null : c)), 1800);
  };

  const vivos = (lista ?? []).filter((s) => !s.revocado_at);

  /** Renglón de resultado de un envío: verde si salió, y si no, el link a mano. */
  const Resultado = ({ r, idx }: { r: ResultadoInv; idx: string }) => (
    <li className={r.enviado ? '' : 'mal'}>
      {r.enviado ? '✓ enviado a ' : '✖ no salió a '}<b>{r.email}</b>{r.error ? ` — ${r.error}` : ''}
      {!r.enviado && r.enlace && (
        <div className="cmp-linkrow mini">
          <input className="cmp-link" readOnly value={r.enlace} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="cmp-copy" onClick={() => copiar(r.enlace!, idx)}>{copiado === idx ? '✓' : 'Copiar'}</button>
        </div>
      )}
    </li>
  );

  return (
    <>
      {!controlado && (
        <button type="button" className={claseBoton ?? `cmp-btn${compacto ? ' chico' : ''}`}
          title={compacto ? `Compartir «${etiqueta}» por link` : undefined}
          onClick={() => { setAbierto(true); setNuevo(null); setError(null); setSumaResultado(null); }}>
          Compartir
        </button>
      )}

      {/* ⚠️ EL MODAL VA AL `body`, NO DONDE VIVE EL BOTÓN.
          `.cmp-ov` es `position: fixed; inset: 0; z-index: 120`, y eso promete la
          ventana entera — pero las dos cosas se las come cualquier ancestro
          posicionado: uno con `z-index` abre un contexto de apilamiento y le clampea
          el 120 contra SU nivel, y uno con `transform` pasa a ser el bloque
          contenedor del `fixed`, así que el `inset: 0` se mide contra ESE y no contra
          la ventana.
          Medido el 06/10/2026 al colgar este botón de una tarjeta de la grilla (un
          span absolute con z-index 2 que se mueve en el hover): el modal abría
          DETRÁS de las tarjetas de más abajo. No da error y no se ve mal — el
          navegador contesta que el botón «Cerrar» está visible y habilitado, y el
          clic no le llega nunca (`.al-rescard-resumen … intercepts pointer events`).
          Es la misma familia que el pop-up de prioridad abierto desde una barra
          sticky. Con el portal el modal no tiene ancestro que lo acote y da igual
          desde dónde se abra. */}
      {visible && createPortal((
        <div className="cmp-ov" role="dialog" aria-modal="true" data-variante={esApp ? 'app' : undefined}
          onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}
          // En el Dashboard las teclas de adentro no llegan a sus atajos: un Suprimir con el foco en un botón del
          // modal borraría la tarjeta elegida de atrás. React despacha desde `document` antes que el editor.
          onKeyDown={esApp ? (e) => { if (e.key !== 'Escape') e.nativeEvent.stopImmediatePropagation(); } : undefined}>
          {esApp && <CapaDeApp onEscape={cerrar} />}
          <div className="cmp-box">
            <h3 className="cmp-h">Compartir «{etiqueta}»</h3>
            {nota && <p className="cmp-nota">{nota}</p>}

            <label className={`cmp-modo${modo === 'link' ? ' on' : ''}`}>
              <input type="radio" name="cmp-modo" checked={modo === 'link'} onChange={() => setModo('link')} />
              <span><b>Cualquiera con el enlace</b><small>Quien tenga el link entra, sin login.</small></span>
            </label>
            <label className={`cmp-modo${modo === 'invitados' ? ' on' : ''}`}>
              <input type="radio" name="cmp-modo" checked={modo === 'invitados'} onChange={() => setModo('invitados')} />
              <span><b>Solo las personas que invite</b><small>Cada una recibe su propio enlace por mail.</small></span>
            </label>

            {modo === 'invitados' && (
              <>
                {correo && !correo.listo && (
                  <p className="cmp-aviso">
                    <b>El correo todavía no está verificado.</b> Los invitados quedan creados y con acceso,
                    pero el mail no les llega: cópiales el link con el botón de cada uno y pásaselo tú.
                  </p>
                )}
                <textarea className="cmp-mails" rows={2} value={emails} onChange={(e) => setEmails(e.target.value)}
                  placeholder={'Martín Tejado <martin@gmail.com>, otro@empresa.com'} />
                <p className="cmp-tip">Pon el nombre adelante para reconocerlo en la lista. Uno por línea o separados por coma.</p>
              </>
            )}

            {error && <p className="cmp-err">{error}</p>}

            {nuevo && (
              <div className="cmp-nuevo">
                {nuevo.enlace && (
                  <>
                    {/* Decía "se muestra una sola vez". Desde la mig 0131 es falso: el
                        link se guarda cifrado y «Copiar link» de la lista lo devuelve. */}
                    <p className="cmp-nuevo-t">Listo. Puedes volver a copiarlo cuando quieras desde <b>Copiar link</b>, aquí abajo:</p>
                    <div className="cmp-linkrow">
                      <input className="cmp-link" readOnly value={nuevo.enlace} onFocus={(e) => e.currentTarget.select()} />
                      <button type="button" className="cmp-copy" onClick={() => copiar(nuevo.enlace!, 'nuevo')}>{copiado === 'nuevo' ? '✓' : 'Copiar'}</button>
                    </div>
                  </>
                )}
                {!!nuevo.invitados.length && (
                  <ul className="cmp-invs">
                    {nuevo.invitados.map((i) => <Resultado key={i.email} r={i} idx={`n:${i.email}`} />)}
                  </ul>
                )}
                {nuevo.invitados.some((i) => !i.enviado && i.enlace) && (
                  <p className="cmp-tip">El acceso ya está creado: pásale ese link por donde quieras y funciona igual.</p>
                )}
              </div>
            )}

            {!nuevo && (
              <button type="button" className="cmp-crear" onClick={crear} disabled={creando || (modo === 'invitados' && !emails.trim())}>
                {creando ? 'Creando…' : 'Crear enlace'}
              </button>
            )}

            {!!vivos.length && (
              <div className="cmp-lista">
                <p className="cmp-lista-t">Quién tiene acceso</p>
                {vivos.map((s) => {
                  const gente = s.invitados.filter((i) => !i.revocado_at);
                  return (
                    <div key={s.id} className="cmp-grupo">
                      <div className="cmp-item">
                        <div className="cmp-item-in">
                          <span className="cmp-item-t">
                            {s.modo === 'link' ? 'Cualquiera con el enlace' : `${gente.length} ${gente.length === 1 ? 'persona invitada' : 'personas invitadas'}`}
                            <span className="cmp-pref"> · {s.token_prefijo}…</span>
                          </span>
                          {/* QUÉ comparte, pedido de Martín el 06/10/2026: «debería decir
                              también el título de lo que estoy comparto si es todos los
                              cursos o uno en específico».
                              Va en el SEGUNDO renglón y no arriba: el h3 del modal ya dice
                              ese mismo nombre, y la API filtra la lista por recurso_id, así
                              que es idéntico en todas las filas. En negrita y primero, la
                              lista serían N copias del encabezado y taparían lo único que
                              distingue una fila de otra — el modo, el prefijo y las visitas.
                              El `title` lleva el nombre entero: el renglón recorta con «…». */}
                          <span className="cmp-item-m">
                            <span className="cmp-item-q" title={s.titulo}>{s.titulo}</span>
                            <span className="cmp-item-v">· {visitasTxt(s.visitas)}</span>
                          </span>
                        </div>
                        {/* Recuperar el link de un enlace público: sin esto, perderlo obligaba
                            a revocar y crear otro — lo mismo, con más pasos y perdiendo las visitas. */}
                        {s.modo === 'link' && (
                          <button type="button" className="cmp-link-btn"
                            onClick={() => copiarLink(`s:${s.id}`, s.id, false, 'Este enlace')}
                            title="Copiar el enlace">
                            {copiado === `s:${s.id}` ? '✓ copiado' : 'Copiar link'}
                          </button>
                        )}
                        <button type="button" className="cmp-rev" onClick={() => revocar(s.id)}>
                          {s.modo === 'link' ? 'Revocar' : 'Revocar a todos'}
                        </button>
                      </div>
                      {linkEmitido?.key === `s:${s.id}` && (
                        <div className="cmp-linkrow mini">
                          <input className="cmp-link" readOnly value={linkEmitido.enlace} onFocus={(e) => e.currentTarget.select()} />
                          <button type="button" className="cmp-copy" onClick={() => copiar(linkEmitido.enlace, `s:${s.id}`)}>
                            {copiado === `s:${s.id}` ? '✓' : 'Copiar'}
                          </button>
                        </div>
                      )}

                      {s.modo === 'invitados' && (
                        <>
                          {gente.map((i) => (
                            <div key={i.id} className="cmp-persona">
                              <div className="cmp-persona-fila">
                                <Avatar inv={i} />
                                <div className="cmp-persona-in">
                                  <span className="cmp-persona-n">{nombreDe(i)}</span>
                                  <span className="cmp-persona-e">{i.email}</span>
                                  <span className={`cmp-persona-s${i.enviado_at ? '' : ' warn'}`}>
                                    {!i.enviado_at
                                      ? 'el mail no le llegó — pásale el link a mano'
                                      : i.visitas > 0
                                        ? `entró ${i.visitas} ${i.visitas === 1 ? 'vez' : 'veces'}${i.ultima_visita ? ` · ${fechaCorta(i.ultima_visita)}` : ''}`
                                        : 'invitado, todavía no entró'}
                                  </span>
                                </div>
                                <button type="button" className="cmp-link-btn"
                                  onClick={() => copiarLink(`p:${i.id}`, i.id, true, `El enlace de ${nombreDe(i)}`)}
                                  title={`Copiar el enlace personal de ${i.email}`}>
                                  {copiado === `p:${i.id}` ? '✓ copiado' : 'Copiar link'}
                                </button>
                                <button type="button" className="cmp-rev chico" onClick={() => revocar(s.id, i.id)}
                                  title={`Quitarle el acceso a ${i.email}`}>Quitar</button>
                              </div>
                              {linkEmitido?.key === `p:${i.id}` && (
                                <div className="cmp-linkrow mini">
                                  <input className="cmp-link" readOnly value={linkEmitido.enlace} onFocus={(e) => e.currentTarget.select()} />
                                  <button type="button" className="cmp-copy" onClick={() => copiar(linkEmitido.enlace, `p:${i.id}`)}>
                                    {copiado === `p:${i.id}` ? '✓' : 'Copiar'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                          {sumaResultado?.shareId === s.id && (
                            <ul className="cmp-invs sangria">
                              {sumaResultado.invitados.map((i) => <Resultado key={i.email} r={i} idx={`s:${s.id}:${i.email}`} />)}
                            </ul>
                          )}

                          {sumandoA === s.id ? (
                            <div className="cmp-suma">
                              <textarea className="cmp-mails" rows={2} value={sumaTexto} autoFocus
                                onChange={(e) => setSumaTexto(e.target.value)}
                                placeholder={'Nombre <mail@empresa.com>'} />
                              <div className="cmp-suma-btns">
                                <button type="button" className="cmp-crear chico" disabled={sumando || !sumaTexto.trim()} onClick={() => sumar(s.id)}>
                                  {sumando ? 'Invitando…' : 'Invitar'}
                                </button>
                                <button type="button" className="cmp-cerrar chico" onClick={() => { setSumandoA(null); setSumaTexto(''); }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" className="cmp-sumar" onClick={() => { setSumandoA(s.id); setSumaResultado(null); setError(null); }}>
                              + Invitar a alguien más
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="cmp-pie">
              <button type="button" className="cmp-cerrar" onClick={cerrar}>Cerrar</button>
            </div>
          </div>
        </div>
      ), document.body)}

      <style jsx>{`
        .cmp-btn { font-family: var(--mono, ui-monospace), monospace; font-size: 12px; letter-spacing: .05em; text-transform: uppercase;
          color: var(--ink, #1a1a1a); background: var(--lime, #C8F169); border: 1.5px solid var(--ink, #1a1a1a);
          border-radius: 8px; padding: 8px 14px; cursor: pointer; transition: .14s; }
        .cmp-btn:hover { box-shadow: 3px 3px 0 var(--ink, #1a1a1a); transform: translate(-1px,-1px); }
        /* El de una tarjeta de la grilla. Dice "Compartir" igual: un ícono solo en una
           esquina no se entiende, y el techo de texto de pantalla no se viola con una
           palabra. El hover se apaga porque la tarjeta ya se mueve sola al pasar. */
        .cmp-btn.chico { font-size: 10px; letter-spacing: .06em; padding: 4px 8px; border-width: 1px; border-radius: 6px; }
        .cmp-btn.chico:hover { box-shadow: 2px 2px 0 var(--ink, #1a1a1a); transform: none; }
        .cmp-ov { position: fixed; inset: 0; z-index: 120; background: rgba(24,26,22,.44); display: grid; place-items: center; padding: 20px; }
        .cmp-box { width: min(560px, 100%); max-height: 88vh; overflow: auto; background: var(--card, #fffdf7);
          color: var(--ink, #1a1a1a); border: 1.5px solid var(--ink, #1a1a1a); border-radius: 14px; padding: 22px; box-shadow: 6px 6px 0 rgba(24,26,22,.16); }
        .cmp-h { margin: 0 0 15px; font-size: 19px; font-weight: 800; letter-spacing: -.02em; }
        .cmp-nota { margin: -9px 0 14px; font-size: 12.5px; line-height: 1.5; opacity: .66; }
        .cmp-modo { display: flex; gap: 10px; align-items: flex-start; padding: 12px; margin-bottom: 8px; border-radius: 10px;
          border: 1.5px solid rgba(24,26,22,.18); cursor: pointer; font-size: 13.5px; line-height: 1.45; }
        .cmp-modo.on { border-color: var(--ink, #1a1a1a); background: rgba(200,241,105,.22); }
        .cmp-modo small { display: block; opacity: .62; margin-top: 2px; }
        .cmp-mails { width: 100%; margin: 4px 0 2px; padding: 10px 12px; border-radius: 9px; font-family: inherit; font-size: 13.5px;
          background: #fff; border: 1.5px solid rgba(24,26,22,.2); color: var(--ink, #1a1a1a); resize: vertical; }
        .cmp-tip { margin: 6px 0 0; font-size: 12px; opacity: .58; line-height: 1.45; }
        .cmp-err { color: #b3261e; font-size: 13px; margin: 10px 0 0; }
        .cmp-crear { margin-top: 14px; width: 100%; padding: 11px; border-radius: 9px; cursor: pointer; font-size: 14px; font-weight: 700;
          font-family: inherit; background: var(--lime, #C8F169); border: 1.5px solid var(--ink, #1a1a1a); color: var(--ink, #1a1a1a); }
        .cmp-crear:disabled { opacity: .5; cursor: not-allowed; }
        .cmp-crear.chico { margin-top: 0; width: auto; padding: 8px 16px; font-size: 13px; }
        .cmp-nuevo { margin-top: 14px; padding: 13px; border-radius: 10px; background: rgba(200,241,105,.18); border: 1.5px solid var(--ink, #1a1a1a); }
        .cmp-nuevo-t { margin: 0 0 8px; font-size: 13.5px; }
        .cmp-linkrow { display: flex; gap: 7px; }
        .cmp-linkrow.mini { margin: 6px 0 4px; }
        .cmp-link { flex: 1; min-width: 0; padding: 9px 11px; border-radius: 8px; font-family: ui-monospace, monospace; font-size: 11.5px;
          background: #fff; border: 1.5px solid rgba(24,26,22,.22); color: var(--ink, #1a1a1a); }
        .cmp-copy { padding: 9px 14px; border-radius: 8px; cursor: pointer; font-size: 12.5px; font-weight: 700; font-family: inherit;
          background: var(--ink, #1a1a1a); color: #fff; border: 0; flex: none; }
        .cmp-invs { margin: 10px 0 0; padding-left: 17px; font-size: 12.5px; line-height: 1.7; }
        .cmp-invs.sangria { margin: 4px 0 8px; padding-left: 46px; }
        .cmp-invs :global(li.mal) { color: #8a3a34; }
        .cmp-lista { margin-top: 18px; border-top: 1.5px solid rgba(24,26,22,.14); padding-top: 14px; }
        .cmp-lista-t { margin: 0 0 9px; font-size: 11.5px; letter-spacing: .09em; text-transform: uppercase; opacity: .55; font-family: var(--mono, monospace); }
        .cmp-grupo { padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1px solid rgba(24,26,22,.08); }
        .cmp-grupo:last-child { border-bottom: 0; margin-bottom: 0; }
        .cmp-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 0; }
        /* ⚠️ NADA DE BACKTICKS EN LOS COMENTARIOS DE ACÁ ABAJO: esta hoja entera es un
           template literal y uno solo la cierra a la mitad. El síntoma no es un error de
           CSS — es el typecheck quejándose de un token inesperado treinta líneas más
           abajo. Se nombra una propiedad sin comillas de ningún tipo.

           El flex de la columna va en 1, no sólo con min-width 0: sin él mide su
           CONTENIDO (225 px medidos) y el justify-content space-between del padre reparte
           los 114 px que sobran en DOS huecos iguales — uno de ellos ENTRE los dos
           botones, que se ven separados sin que nadie lo haya pedido. Con flex 1 el
           sobrante se lo lleva el texto, los botones quedan juntos, y recién ahí el
           recorte de abajo tiene de qué recortar. */
        .cmp-item-in { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
        .cmp-item-t { font-size: 13px; font-weight: 600; }
        .cmp-pref { font-family: ui-monospace, monospace; font-size: 11px; opacity: .5; font-weight: 400; }
        /* El título más largo del catálogo son 82 caracteres y el renglón tiene ~330 px,
           así que no entra con cualquier curso. Se declara QUIÉN CEDE en vez de acertarle
           a una cuenta: cede el título (lo que se puede terminar de leer en el tooltip y
           en el h3 de arriba) y las visitas van enteras, que son el dato. Es el mismo
           arreglo que las dos clases de la fila de un invitado, treinta líneas más abajo. */
        .cmp-item-m { font-size: 11.5px; opacity: .55; display: flex; gap: 5px; min-width: 0; }
        .cmp-item-q { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cmp-item-v { flex: none; }
        .cmp-persona { padding: 7px 0 7px 6px; }
        .cmp-persona-fila { display: flex; align-items: center; gap: 8px; }
        .cmp-persona-in { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .cmp-persona-n { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cmp-persona-e { font-size: 12px; opacity: .62; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cmp-persona-s { font-size: 11.5px; opacity: .5; margin-top: 1px; }
        .cmp-persona-s.warn { color: #b3261e; opacity: .85; }
        .cmp-rev { padding: 6px 12px; border-radius: 7px; cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit;
          background: transparent; border: 1.5px solid rgba(179,38,30,.45); color: #b3261e; flex: none; }
        .cmp-rev.chico { padding: 4px 10px; font-size: 11.5px; border-color: rgba(179,38,30,.3); }
        .cmp-link-btn { padding: 4px 10px; border-radius: 7px; cursor: pointer; font-size: 11.5px; font-weight: 600; font-family: inherit;
          background: transparent; border: 1.5px solid rgba(24,26,22,.25); color: var(--ink, #1a1a1a); flex: none; white-space: nowrap; }
        .cmp-link-btn:hover { border-color: var(--ink, #1a1a1a); background: rgba(200,241,105,.28); }
        .cmp-aviso { margin: 2px 0 8px; padding: 10px 12px; border-radius: 9px; font-size: 12.5px; line-height: 1.5;
          background: rgba(201,138,12,.1); border: 1.5px solid rgba(201,138,12,.4); color: #6b4a06; }
        .cmp-sumar { margin: 2px 0 4px 6px; padding: 5px 0; background: none; border: 0; cursor: pointer; font-family: inherit;
          font-size: 12.5px; font-weight: 600; color: var(--ink, #1a1a1a); opacity: .62; text-decoration: underline; }
        .cmp-sumar:hover { opacity: 1; }
        .cmp-suma { padding: 4px 0 8px 6px; }
        .cmp-suma-btns { display: flex; gap: 8px; margin-top: 8px; }
        .cmp-pie { display: flex; justify-content: flex-end; margin-top: 16px; }
        .cmp-cerrar { padding: 9px 17px; border-radius: 9px; cursor: pointer; font-size: 13.5px; font-weight: 600; font-family: inherit;
          background: transparent; border: 1.5px solid rgba(24,26,22,.25); color: var(--ink, #1a1a1a); }
        .cmp-cerrar.chico { padding: 8px 14px; font-size: 13px; }

        /* LA VARIANTE DE LA APP (el Dashboard, tanda v5 punto 16): los tokens de la casa, que se dan vuelta en
           oscuro, sin el papel ni el lima del portal ni la sombra corrida, y la letra de la app en vez de la
           mono. Reglas ESTÁTICAS encima de las de siempre: sin la marca, nada de esto aplica y Conocimientos se
           ve exactamente igual. Ni comillas invertidas ni signos de pesos con llave acá adentro (ver arriba). */
        .cmp-ov[data-variante="app"] { background: rgba(18, 21, 27, .42); }
        .cmp-ov[data-variante="app"] .cmp-box { background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: 0 30px 70px rgba(18, 21, 27, .35); font-family: 'Geist', system-ui, sans-serif; }
        .cmp-ov[data-variante="app"] .cmp-h { font-size: 18px; font-weight: 600; letter-spacing: -.01em; }
        .cmp-ov[data-variante="app"] .cmp-nota { color: var(--dim); opacity: 1; font-size: 13px; }
        .cmp-ov[data-variante="app"] .cmp-modo { border: 1px solid var(--border-strong); }
        .cmp-ov[data-variante="app"] .cmp-modo input { accent-color: var(--primary); }
        .cmp-ov[data-variante="app"] .cmp-modo.on { border-color: var(--primary); background: var(--primary-bg); }
        .cmp-ov[data-variante="app"] .cmp-modo small { color: var(--dim); opacity: 1; }
        .cmp-ov[data-variante="app"] .cmp-mails, .cmp-ov[data-variante="app"] .cmp-link { background: var(--surface); border: 1px solid var(--border-strong); color: var(--ink); font-family: inherit; }
        .cmp-ov[data-variante="app"] .cmp-mails:focus, .cmp-ov[data-variante="app"] .cmp-link:focus { outline: none; border-color: var(--primary); box-shadow: var(--focus-ring); }
        .cmp-ov[data-variante="app"] .cmp-tip { color: var(--dim); opacity: 1; font-size: 13px; }
        .cmp-ov[data-variante="app"] .cmp-err { color: var(--bad); }
        .cmp-ov[data-variante="app"] .cmp-crear { background: var(--primary); border: 1px solid var(--primary); color: var(--on-primary); font-weight: 600; border-radius: 18px; }
        .cmp-ov[data-variante="app"] .cmp-crear:hover:not(:disabled) { background: var(--primary-strong); border-color: var(--primary-strong); }
        .cmp-ov[data-variante="app"] .cmp-nuevo { background: var(--primary-bg); border: 1px solid var(--primary-weak); }
        .cmp-ov[data-variante="app"] .cmp-copy { background: var(--primary); color: var(--on-primary); }
        .cmp-ov[data-variante="app"] .cmp-invs :global(li.mal) { color: var(--bad); }
        .cmp-ov[data-variante="app"] .cmp-lista { border-top: 1px solid var(--border); }
        .cmp-ov[data-variante="app"] .cmp-lista-t { font-family: inherit; font-size: 13px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--dim); opacity: 1; }
        .cmp-ov[data-variante="app"] .cmp-grupo { border-bottom-color: var(--border); }
        .cmp-ov[data-variante="app"] .cmp-pref { font-family: inherit; color: var(--faint); opacity: 1; }
        .cmp-ov[data-variante="app"] .cmp-item-m, .cmp-ov[data-variante="app"] .cmp-persona-e, .cmp-ov[data-variante="app"] .cmp-persona-s { color: var(--dim); opacity: 1; }
        .cmp-ov[data-variante="app"] .cmp-persona-s.warn { color: var(--bad); }
        .cmp-ov[data-variante="app"] .cmp-rev { border: 1px solid var(--bad); color: var(--bad); border-radius: var(--r-sm); }
        .cmp-ov[data-variante="app"] .cmp-rev:hover { background: var(--bad-bg); }
        .cmp-ov[data-variante="app"] .cmp-link-btn, .cmp-ov[data-variante="app"] .cmp-cerrar { background: var(--surface); border: 1px solid var(--border-strong); color: var(--ink); }
        .cmp-ov[data-variante="app"] .cmp-cerrar { border-radius: 18px; }
        .cmp-ov[data-variante="app"] .cmp-link-btn:hover, .cmp-ov[data-variante="app"] .cmp-cerrar:hover { background: var(--surface-2); border-color: var(--border-strong); }
        .cmp-ov[data-variante="app"] .cmp-aviso { background: var(--warn-bg); border: 1px solid var(--warn); color: var(--warn); }
        .cmp-ov[data-variante="app"] .cmp-sumar { color: var(--primary); opacity: 1; text-decoration: none; }
        .cmp-ov[data-variante="app"] .cmp-sumar:hover { text-decoration: underline; }
      `}</style>
    </>
  );
}
