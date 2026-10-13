'use client';

// =============================================================================
// NuevaHoja — el modal de «Nueva hoja»: «¿Qué vas a crear hoy?», en blanco, lo copiado, o una plantilla (punto 19)
// =============================================================================
// Martín, 11/10/2026: «Al momento de crear un nuevo lienzo, replica el modal que tenemos en
// "Automations", en donde al principio tenemos la opción de "Pídeselo a MaKo" y abajo se le ofrece
// TEMPLATES». El molde es la galería v2 de Automations (docs/diseno-automations-galeria-v2.md §1 y
// §2): sin rótulos de sección, el pedido ADENTRO del modal con su micrófono, el buscador, y «Hoja en
// blanco» primera siempre (ningún texto la saca).
//
// 13/10/2026 — «¿QUÉ VAS A CREAR HOY?» EN LUGAR DE «PÍDESELO A MaKo». Martín (12/10/2026, por el chat Chatbot),
// textual: «pasale la sección de "¿Qué vamos a hacer hoy?" al chat de graphics para que lo implemente tal cual en lo
// que se tiene hoy de "Pídeselo a MaKo". Tiene que ser funcional, es decir, que los dashboards también deberían poder
// copiarse y enviarse con ese token». ES LA CAJA de Automations y del Landing Generator (`CajaPedido`,
// app/landing-generator/CajaPedido.tsx), no una copia: el título, la tarjeta blanca, el ejemplo que se escribe solo
// (para mientras la caja tiene el foco y vuelve si se sale sin escribir: lo decide la caja), el «+», el micrófono de la
// casa y el ↑. El «+», como en «Nueva automatización» (app/automations/ChatMako.tsx, `BarraPideselo`):
//   · «Subir archivo o imagen»: lo lee el server con el lector de la casa (la ruta de Automations,
//     app/automations/archivo-pedido-cliente.ts; una imagen, por visión) y queda como chip arriba del campo. Al enviar,
//     va al pedido con lo escrito (`pedidoConArchivo`, dentro del tope del pedido de una hoja).
//   · «Pegar un dashboard»: lee el portapapeles. Lo mismo que pegar con Ctrl+V en el campo.
// UN DASHBOARD PEGADO: el token («MAKO-DASH-…», «Copiar dashboard» del ⋮ de una hoja) SALE del campo y en su lugar se
// lee «Dashboard copiado: <nombre>» (lo da el server). El ↑ lo agrega al informe con ids nuevos (`hojaConIdsNuevos`,
// lib/graficos-copia.ts); lo que se vació al copiarlo o al traerlo de otro negocio va en el toast. Y si al abrir hay uno
// en el portapapeles, la grilla ofrece «Pegar lo copiado» (como la galería de Automations).
//
// `onCrear` recibe la hoja YA saneada con ids nuevos (y, si la armó MaKo o se pegó, el primer aviso, para el toast). El
// editor la agrega con `mutar` (una foto de deshacer) y la abre. Después de `onCrear` el modal llama a `onCerrar`: que
// el editor también lo cierre no rompe nada.
//
// ⚠️ EL ESTADO «PENSANDO» VA ADENTRO DEL MODAL, no en una capa por portal: la de Automations es
//    `zIndex: 125` y un Modal de la pila arranca en 130 (app/_components/pila-modales.ts), así que
//    encima de éste quedaría DEBAJO, sin un error.
// ⚠️ CANCELAR SALE GRATIS: la ruta no escribe nada (app/api/graficos/ia/route.ts). Cerrar el modal
//    corta el pedido.
// ⚠️ `onCerrar` CON IDENTIDAD FIJA (`useCerrarEstable`): con una flecha nueva por render el campo pierde el foco con
//    cada letra (AGENTS.md, «Todo `<Modal>`…»). Y SIN FOCO AL ABRIR, a propósito: el ejemplo de la caja se escribe
//    solo MIENTRAS la caja no tiene el foco (decimoquinta tanda de Automations, punto 6); con el foco puesto al abrir,
//    no se movería nunca. «Nueva automatización» tampoco lo pone.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import Link from '@/app/_ui/Link';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { CajaPedido, ChipCaja, CSS_CAJA_PEDIDO, CSS_TOKENS_CASA, TITULO_CAJA } from '@/app/landing-generator/CajaPedido';
import { Ico } from '@/app/landing-generator/Ico';
import { CSS_NUEVO } from '@/app/automations/NuevoPlaceholder';
import { ACCEPT_ARCHIVO_FLUJO, pedidoConArchivo } from '@/app/automations/CrearConIA';
import { leerArchivoParaPedido } from '@/app/automations/archivo-pedido-cliente';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { FUENTES, hojaVacia, sanearHoja, type Hoja } from '@/lib/graficos-catalogo';
import { PLANTILLAS_HOJA, instanciarPlantilla } from '@/lib/graficos-plantillas';
import { filtrarPlantillasHoja } from '@/lib/graficos-plantillas-generales';
import { TOPE_PEDIDO_IA } from '@/lib/graficos-ia';
import { dashPegado, hojaConIdsNuevos, rotuloDashPegado } from '@/lib/graficos-copia';
import { leerDashPegado } from './copia-dash-cliente';

/** El tope de la ruta (`maxDuration = 120`) + margen: el `fetch` no puede esperar para siempre. */
const TOPE_CLIENTE_MS = 125_000;

/**
 * Los ejemplos del placeholder: GENÉRICOS a propósito. Lo que mira un negocio cualquiera, sin el
 * nombre de una campaña, un producto ni un cliente (AGENTS.md: un ejemplo de UI es ficticio por regla).
 */
export const EJEMPLOS_HOJA = [
  'Cuánto gasto en anuncios y cuánto me cuesta cada lead',
  'Los leads de la semana, por origen y por etapa',
  'Lo que cobré este mes y lo que falta cobrar',
  'Cómo rinden mis automatizaciones de WhatsApp',
  'Las llamadas de mis closers y cuántas cierran',
] as const;
const PLACEHOLDER_QUIETO = 'Escribe o dicta qué quieres ver';
/** El placeholder con un archivo adjunto (el ejemplo no se mueve: el pedido ya es el archivo). */
const PLACEHOLDER_ARCHIVO = 'Qué armar con el archivo (opcional)';
/** El pedido cuando sólo se subió el archivo, sin escribir nada. */
const PEDIDO_SOLO_ARCHIVO = 'Arma la hoja con lo que dice este archivo.';

/** El «+» de la caja: subir un archivo o una imagen, y pegar un dashboard copiado. */
const MAS_ARCHIVO = 'archivo';
const MAS_PEGAR = 'pegar';
const ACCIONES_MAS: DropdownOption[] = [
  { value: MAS_ARCHIVO, label: 'Subir archivo o imagen', icono: 'subir' },
  { value: MAS_PEGAR, label: 'Pegar un dashboard', icono: 'copiar' },
];
/** Lo que dice la caja cuando el token no existe (o no se pudo preguntar). */
const NO_ES_DASH = 'No encontré ese dashboard.';
/** «Pegar un dashboard» sin un dashboard en el portapapeles. */
const SIN_DASH_COPIADO = 'No hay un dashboard copiado.';
/** «Pegar un dashboard» sin permiso para leer el portapapeles. */
const PEGALO_A_MANO = 'Pega el dashboard en la caja (Ctrl+V).';

/** El archivo de la caja: leyéndose, leído (con su texto) o que no se pudo leer. */
type ArchivoCaja = { nombre: string; imagen: boolean } & ({ estado: 'leyendo' } | { estado: 'listo'; texto: string } | { estado: 'error' });

// Sin backticks acá adentro: es un template literal. Sólo tokens de la app (se dan vuelta en oscuro).
const CSS = `
.nh-grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:12px}
.nh-tarjeta{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;padding:16px;min-height:124px;box-sizing:border-box;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink);font-family:inherit;cursor:pointer;transition:border-color .14s ease,box-shadow .14s ease,transform .14s ease}
.nh-tarjeta:hover:not(:disabled),.nh-tarjeta:focus-visible{border-color:var(--primary);box-shadow:0 2px 12px color-mix(in srgb,var(--ink) 10%,transparent);outline:none}
.nh-tarjeta:active:not(:disabled){transform:scale(.98)}
.nh-blanco{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:124px;box-sizing:border-box;padding:16px;border-radius:14px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer}
.nh-buscar{display:flex;align-items:center;gap:8px;padding:0 12px;height:40px;box-sizing:border-box;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface);color:var(--dim)}
.nh-buscar:focus-within{border-color:var(--primary)}
.nh-buscar input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--ink);font:inherit;font-size:14px}
@media (prefers-reduced-motion: reduce){.nh-tarjeta{transition:none}.nh-tarjeta:active:not(:disabled){transform:none}}
`;

export function NuevaHoja({ onCerrar, onCrear, enBlanco = 'Página nueva' }: {
  onCerrar: () => void;
  /** La hoja nueva, saneada y con ids nuevos. `aviso`: lo primero que MaKo ajustó (o lo que se vació al pegar), para el toast. */
  onCrear: (h: Hoja, aviso?: string) => void;
  /** El nombre de la «Hoja en blanco» (el editor le pasa «Página N»). */
  enBlanco?: string;
}) {
  const cerrar = useCerrarEstable(onCerrar);
  // Las props de AHORA para los handlers asincrónicos (un `onCrear` de hace un minuto cerraría sobre
  // el informe de entonces).
  const props = useRef({ onCrear, enBlanco });
  useEffect(() => { props.current = { onCrear, enBlanco }; });

  const [pedido, setPedido] = useState('');
  /** Desde cuándo piensa MaKo (null = no piensa). */
  const [desde, setDesde] = useState<number | null>(null);
  const [error, setError] = useState<{ texto: string; link?: string } | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [busca, setBusca] = useState('');
  /** El dashboard pegado en la caja: su token y su nombre (null mientras el server contesta). */
  const [dash, setDash] = useState<{ token: string; nombre: string | null } | null>(null);
  const [archivo, setArchivo] = useState<ArchivoCaja | null>(null);
  /** El dashboard que había en el portapapeles al abrir: la grilla ofrece «Pegar lo copiado». */
  const [copiado, setCopiado] = useState<{ token: string; nombre: string } | null>(null);
  const pensando = desde != null;
  const ctrl = useRef<AbortController | null>(null);
  const subida = useRef<AbortController | null>(null);
  const vezDash = useRef(0);
  const elegirArchivo = useRef<HTMLInputElement>(null);

  // El reloj de lo que lleva: progreso real (GRAMATICA.analizando), sólo mientras piensa.
  useEffect(() => {
    if (!pensando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pensando]);

  // Cerrar el modal corta el pedido y la subida: la ruta no escribió nada, así que no queda nada a medias.
  useEffect(() => () => { ctrl.current?.abort(); subida.current?.abort(); }, []);

  // LO COPIADO, si hay (como «Pegar lo copiado» de la galería de Automations). Leer el portapapeles puede pedir
  // permiso: si no lo dan, la tarjeta no aparece. Una vez, al abrir.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;
    let vivo = true;
    navigator.clipboard.readText().then(async (t) => {
      const p = dashPegado(t);
      if (!p) return;
      const r = await leerDashPegado(p.token);
      if (vivo && r) setCopiado({ token: p.token, nombre: r.nombre });
    }).catch(() => { /* sin permiso: no se ofrece */ });
    return () => { vivo = false; };
  }, []);

  /** Lo que sea que se eligió: la hoja al editor, y el modal se cierra. */
  const crear = (h: Hoja, aviso?: string) => {
    ctrl.current?.abort();
    ctrl.current = null;
    props.current.onCrear(h, aviso);
    cerrar();
  };

  const cancelar = () => {
    ctrl.current?.abort();
    ctrl.current = null;
    setDesde(null);
  };

  // ── Lo que se suma al pedido: un archivo, o un dashboard pegado ──────────────────────────────
  const quitarArchivo = () => { subida.current?.abort(); subida.current = null; setArchivo(null); };
  const quitarDash = () => { vezDash.current++; setDash(null); };
  const ponerDash = (token: string) => {
    const vez = ++vezDash.current;
    quitarArchivo();
    setError(null);
    setDash({ token, nombre: null });
    void leerDashPegado(token).then((r) => {
      if (vezDash.current !== vez) return;
      if (!r) { setDash(null); setError({ texto: NO_ES_DASH }); return; }
      setDash({ token, nombre: r.nombre });
    });
  };
  /** Lo escrito o pegado en el campo: un token de un dashboard sale del texto y queda como «Dashboard copiado: …». */
  const alEscribir = (v: string) => {
    const p = dashPegado(v);
    if (p) { setPedido(p.resto); ponerDash(p.token); return; }
    setPedido(v);
  };
  const pegarDelPortapapeles = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) { setError({ texto: PEGALO_A_MANO }); return; }
    navigator.clipboard.readText().then((t) => {
      const p = dashPegado(t);
      if (!p) { setError({ texto: SIN_DASH_COPIADO }); return; }
      ponerDash(p.token);
    }).catch(() => setError({ texto: PEGALO_A_MANO }));
  };
  const subir = (file: File) => {
    quitarDash();
    quitarArchivo();
    setError(null);
    const base = { nombre: file.name, imagen: file.type.startsWith('image/') };
    const ac = new AbortController();
    subida.current = ac;
    setArchivo({ ...base, estado: 'leyendo' });
    void leerArchivoParaPedido(file, ac.signal).then((r) => {
      if (ac.signal.aborted) return;
      if (!r.ok) { setArchivo({ ...base, estado: 'error' }); setError({ texto: r.error }); return; }
      setArchivo({ ...base, estado: 'listo', texto: r.texto });
    });
  };
  const alMas = (v: string) => {
    if (v === MAS_ARCHIVO) elegirArchivo.current?.click();
    else if (v === MAS_PEGAR) pegarDelPortapapeles();
  };

  /** EL DASHBOARD PEGADO entra al informe con ids nuevos (lo resuelto ya está en memoria: no vuelve a preguntar). */
  const pegarDash = async (token: string) => {
    setError(null);
    const r = await leerDashPegado(token);
    if (!r) { setError({ texto: NO_ES_DASH }); return; }
    crear(hojaConIdsNuevos(r.hoja), r.aviso ?? undefined);
  };

  /** ¿Se puede mandar? Un dashboard con nombre, un archivo leído, o algo escrito (y nada leyéndose). */
  const listo = dash ? !!dash.nombre : archivo ? archivo.estado === 'listo' : !!pedido.trim();

  const enviar = async () => {
    if (pensando || !listo) return;
    if (dash) { void pegarDash(dash.token); return; }
    const escrito = pedido.trim();
    const texto = archivo?.estado === 'listo'
      ? pedidoConArchivo(escrito || PEDIDO_SOLO_ARCHIVO, { nombre: archivo.nombre, texto: archivo.texto }, TOPE_PEDIDO_IA)
      : escrito;
    if (!texto) return;
    const c = new AbortController();
    ctrl.current = c;
    const tope = setTimeout(() => c.abort(), TOPE_CLIENTE_MS);
    setError(null);
    setDesde(Date.now());
    setAhora(Date.now());
    try {
      const res = await fetch('/api/graficos/ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido: texto }), signal: c.signal,
      });
      const j = await res.json().catch(() => null) as { ok?: boolean; hoja?: unknown; avisos?: unknown; error?: string; link?: string } | null;
      if (ctrl.current !== c) return;
      if (!res.ok || !j?.ok) { setDesde(null); setError({ texto: j?.error || `Error ${res.status}`, link: j?.link }); return; }
      // Lo que llega por la red se vuelve a sanear: la hoja vale por lo que dice el catálogo de acá.
      const h = sanearHoja(j.hoja, 0);
      if (!h || !h.componentes.length) { setDesde(null); setError({ texto: 'Llegó una hoja vacía. Prueba de nuevo.' }); return; }
      const avisos = Array.isArray(j.avisos) ? j.avisos.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
      setDesde(null);
      crear(h, avisos[0]);
    } catch {
      // Cancelar no es un error: la caja vuelve con el pedido escrito.
      if (ctrl.current !== c) return;
      setDesde(null);
      setError({ texto: c.signal.aborted ? 'Tardó demasiado. Prueba de nuevo.' : 'Sin conexión. Prueba de nuevo.' });
    } finally {
      clearTimeout(tope);
      if (ctrl.current === c) ctrl.current = null;
    }
  };

  const plantillas = useMemo(() => filtrarPlantillasHoja(PLANTILLAS_HOJA, busca), [busca]);
  const segundos = desde != null ? Math.max(0, Math.round((ahora - desde) / 1000)) : 0;

  return (
    <Modal titulo="Nueva hoja" ancho={980} sinFiletes onCerrar={cerrar}>
      <style>{CSS_NUEVO}</style>
      <style>{CSS}</style>
      <div data-nueva-hoja="" style={S.todo}>
        {/* 1 · ¿Qué vas a crear hoy? (la caja de Automations y del Landing Generator, la MISMA) */}
        <div className="gp cp-casa" data-pedido-mako="">
          <style>{CSS_TOKENS_CASA + CSS_CAJA_PEDIDO}</style>
          <CajaPedido titulo={{ texto: TITULO_CAJA, nivel: 2 }} valor={pedido} onValor={alEscribir} onEnviar={() => { void enviar(); }}
            listo={listo} ejemplos={EJEMPLOS_HOJA} animar={!archivo} placeholderQuieto={archivo ? PLACEHOLDER_ARCHIVO : PLACEHOLDER_QUIETO}
            etiqueta="Qué quieres ver en la hoja" tope={TOPE_PEDIDO_IA} deshabilitado={pensando}
            onError={(m) => setError(m ? { texto: m } : null)}
            adjunto={archivo ? (
              <ChipCaja icono={archivo.imagen ? 'imagen' : 'archivo'} texto={archivo.nombre} error={archivo.estado === 'error'}
                detalle={archivo.estado === 'leyendo' ? 'Leyendo…' : null} onQuitar={quitarArchivo} etiquetaQuitar="Quitar el archivo" />
            ) : null}
            enLugarDelCampo={dash ? (
              <ChipCaja icono="grafico" texto={rotuloDashPegado(dash.nombre ?? '…')} onQuitar={quitarDash} etiquetaQuitar="Quitar el dashboard" />
            ) : null}
            antes={(
              <Dropdown value="" resetAfterSelect sinFlecha search={false} ariaLabel="Agregar" disabled={pensando}
                botonLabel={<Ico n="mas" t={16} />} options={ACCIONES_MAS} onChange={alMas} menuMinAncho={240}
                buttonStyle={BOTON_MAS} />
            )} />
          <input ref={elegirArchivo} type="file" accept={ACCEPT_ARCHIVO_FLUJO} hidden tabIndex={-1} aria-hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f); }} />
          {pensando && (
            <div role="status" aria-live="polite" style={S.estado}>
              <span style={S.rotulo}>✦ {GRAMATICA.analizando.rotulo}</span>
              <span style={S.dim}>· {FUENTES.length} conjuntos de datos · {segundos} s · hasta {Math.round(TOPE_CLIENTE_MS / 60_000)} min</span>
              <span style={{ marginLeft: 'auto' }}><Button variant="tertiary" size="sm" onClick={cancelar}>Cancelar</Button></span>
            </div>
          )}
          {error && <p role="alert" style={S.error}><TextoConLink texto={error.texto} link={error.link} /></p>}
        </div>

        {/* 2 · El buscador */}
        <label className="nh-buscar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" />
          </svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar plantilla" aria-label="Buscar plantilla" />
        </label>

        {/* 3 · La grilla: «Hoja en blanco» primera SIEMPRE, lo copiado y después las plantillas */}
        <div className="nh-grilla">
          <button type="button" className="mk-nuevo nh-blanco" data-empezar="blanco"
            onClick={() => crear(hojaVacia(props.current.enBlanco))}>
            <span aria-hidden className="mk-nuevo__mas" style={{ fontSize: 22, lineHeight: 1 }}>＋</span>
            Hoja en blanco
          </button>
          {copiado && (
            <button type="button" className="nh-tarjeta" data-pegar="" disabled={pensando}
              onClick={() => { void pegarDash(copiado.token); }}>
              <span aria-hidden style={{ lineHeight: 1 }}><IconoMenu nombre="copiar" size={28} /></span>
              <span style={S.nombre}>Pegar lo copiado</span>
              <span style={S.linea}>«{copiado.nombre}»</span>
            </button>
          )}
          {plantillas.map((p) => (
            <button key={p.id} type="button" className="nh-tarjeta" data-plantilla={p.id}
              onClick={() => crear(instanciarPlantilla(p))}>
              <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>{p.emoji}</span>
              <span style={S.nombre}>{p.nombre}</span>
              <span style={S.linea}>{p.linea}</span>
            </button>
          ))}
        </div>
        {!plantillas.length && <div style={S.sinResultados}>Ninguna plantilla con eso</div>}
      </div>
    </Modal>
  );
}

/** El error, con la palabra «Integraciones» convertida en el link a donde se arregla (si lo hay). */
function TextoConLink({ texto, link }: { texto: string; link?: string }) {
  if (!link) return <>{texto}</>;
  const i = texto.indexOf('Integraciones');
  if (i < 0) return <>{texto} <Link href={link} style={S.link}>Abrir</Link></>;
  return <>{texto.slice(0, i)}<Link href={link} style={S.link}>Integraciones</Link>{texto.slice(i + 'Integraciones'.length)}</>;
}

/** El «+» de la caja (`.gp-cc-mas` de CajaPedido) con el desplegable de la casa: 34 redondo, el azul de Gamma (el de Automations). */
const BOTON_MAS: CSSProperties = {
  width: 34, height: 34, padding: 0, border: 0, borderRadius: 9999, justifyContent: 'center',
  background: 'var(--gp-azul-50)', color: 'var(--gp-azul-600)',
};

// Sólo tokens que existen en claro y en oscuro (app/globals.css → [data-tema="oscuro"]).
const S: Record<string, CSSProperties> = {
  todo: { display: 'flex', flexDirection: 'column', gap: 16 },
  // El renglón de «pensando» y el del error van a lo ancho de la caja (los 720 de CSS_CAJA_PEDIDO).
  estado: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, width: '100%', maxWidth: 720, minHeight: 36, margin: '-6px 0 0' },
  rotulo: { fontSize: 14, fontWeight: 600, color: 'var(--mako-ink)' },
  dim: { fontSize: 13, color: 'var(--dim)' },
  error: { margin: '-6px 0 0', width: '100%', maxWidth: 720, fontSize: 13, lineHeight: 1.4, color: 'var(--bad)' },
  link: { color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' },
  nombre: { fontSize: 15, fontWeight: 700, lineHeight: 1.25 },
  linea: { fontSize: 13, color: 'var(--dim)', lineHeight: 1.4 },
  sinResultados: { fontSize: 13, color: 'var(--dim)' },
};
