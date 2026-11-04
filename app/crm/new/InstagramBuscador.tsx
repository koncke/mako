'use client';

// =============================================================================
// InstagramBuscador — el campo «Instagram» del alta de un lead (punto 28, 12/10/2026)
// =============================================================================
// Martín: «que Instagram sea un buscador real de todos los usuarios existentes de instagram, como la
// barra de busqueda que tiene el propio instagram, y que si escribo "Martin koncke" me salten las
// opciones con las fotos de perfil y pueda seleccionar».
//
// CONTRATO con el alta (app/crm/new/NewLeadForm.tsx, lo monta otro agente):
//   import { InstagramBuscador, type PerfilIg } from '@/app/crm/new/InstagramBuscador'
//   <InstagramBuscador valor={perfil} onElegir={setPerfil} />
// Lo que se guarda en `leads.instagram` es `valor.usuario` (sin la @). Este campo NO emite un input
// oculto: el padre decide qué manda (un `name` acá le sumaría una entrada al FormData a escondidas).
// Y si nadie eligió un perfil, el padre manda lo ESCRITO cuando es un usuario: lo recibe por
// `onTexto` (opcional) y lo decide `instagramDelAlta` (app/crm/campo-inline.ts).
//
// Cómo busca (y por qué dos fuentes): lib/instagram-buscar.ts y app/api/crm/instagram-buscar/route.ts.
// Lo que vive acá:
//   · ESPERA 500 ms después de la última tecla y pide 3 letras: la búsqueda por nombre gasta una de las
//     100 gratis del día de la plataforma. El pedido anterior se CANCELA al tipear (AbortController) y
//     lleva su tope (62 s: la ruta corta a los 60, porque Apify tarda ~20 s): un `fetch` sin `signal` es un giro eterno.
//   · Una respuesta sólo se dibuja si es la del texto que está escrito AHORA (`resp.texto`): una vieja
//     que llega tarde no pisa la lista.
//   · NADA SE INVENTA: sin resultados, la lista dice POR QUÉ (#844, `avisoSinResultados`): por nombre no hay
//     fuente, y por @ Meta no muestra cuentas personales, o el negocio no tiene Meta conectado, o Meta no
//     contestó. «Sin resultados» a secas mentía: Martín buscó su @ exacto y lo leyó como un bug. Si lo
//     escrito es un @, ofrece «Usar @x» (lo que la persona escribió, no una cuenta que alguien vio).
//   · La foto es una URL del CDN de Meta que VENCE: se muestra y no se guarda. Si no carga, iniciales. Se dibuja por NUESTRA ruta
//     (`fotoPorNosotros`): directo, el CDN la bloquea en silencio y las iniciales parecían una cuenta sin foto (3/11/2026).
//
// ⚠️ LA LISTA VA EN UN PORTAL (position: fixed sobre el body), como el Dropdown de la casa: el alta vive
// adentro de un Modal con su propio scroll, y una lista absoluta adentro se cortaba en el borde. El lado
// (abajo o arriba) se decide UNA vez por apertura con el alto TOPE (`lugarDelMenu`): decidir con lo que
// mide hoy la haría saltar de arriba a abajo mientras se tipea.
//
// ⚠️ EL ESCAPE SE ATAJA EN `window`, EN CAPTURA, y sólo con la lista abierta. El Modal escucha Escape en
// `document` en captura (app/_ui/Modal.tsx): un `stopPropagation` desde el input llega tarde y la tecla
// cerraba el alta entera con lo escrito. `window` en captura corre antes que `document`.
//
// ⚠️ ENTER NUNCA MANDA EL FORMULARIO CON UNA BÚSQUEDA A MEDIAS: elige la opción marcada, y si no hay, no
// hace nada. Sin eso, Enter creaba el lead sin el Instagram que se estaba buscando.
//
// «CONECTAR META» AHÍ MISMO (22/10/2026). Martín: «La búsqueda de Instagram: no funciona porque tengo que conectar Meta.
// No entiendo eso». La búsqueda es con la Meta del NEGOCIO, y sin conexión el campo dejaba escribir el @ a ciegas. Ahora,
// la primera vez que se enfoca, pregunta `?estado=1` (la ruta: token + cuenta de Instagram de la página, sin buscar a
// nadie); sin conexión, debajo del campo va una línea corta y «Conectar Meta», y la fila de la lista sin resultados lleva
// el mismo botón. Abre EL modal de /integraciones sin salir de la tab (AGENTS.md); al conectar, pregunta de nuevo sin la
// caché y vuelve a buscar lo escrito. «Usar @x» a mano sigue.
//   ⚠️ ES `useConectarIntegracion` Y NO `BotonIntegracion`: el botón guarda el modal ADENTRO suyo, y acá los dos botones
//   desaparecen al abrirlo (la lista se cierra al soltar el foco; en la ficha, salir del campo lo cierra entero). Con el
//   modal en el botón, el modal se iba con él. El clic marca `conectandoRef` ANTES de soltar el foco, y ese blur no
//   confirma nada; al cerrar el modal el foco vuelve al campo (ModalShell no lo devuelve).
//
// EN LA FICHA (22/10/2026, `enLaFicha`): el Instagram de un lead se corrige con ESTE buscador (`InstagramEditable`, app/
// crm/lead-view/CampoEditable.tsx), no con un texto plano. Ahí el campo abre con el foco y el @ guardado, no lo busca
// hasta la primera tecla (abrirlo no gasta una búsqueda), Enter sin nada que elegir o salir del campo confirman lo
// escrito, y Escape cancela (también sin la lista abierta: se ataja en `window` antes que el Escape de la ficha).
// =============================================================================

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '@/app/_ui/Avatar';
import { Spinner } from '@/app/_ui/Feedback';
import { Icon } from '@/app/_components/icons';
import { useConectarIntegracion } from '@/app/_components/ConectarIntegracion';
import { altoMaximoDelMenu, lugarDelMenu, CAJA_MENU, SEPARACION_MENU } from '@/app/components/dropdown-lugar';
import {
  AVISO_SIN_INSTAGRAM, AVISO_SIN_META, ESPERA_MS, alcanzaParaBuscar, avisoSinResultados, esConexionMeta, esEstadoMeta, perfilManual, pideConectarMeta,
  urlDePerfil, usuarioDeTexto, type ConexionMeta, type EstadoMeta, type PerfilIg,
} from '@/lib/instagram-buscar';
import { fotoPorNosotros } from '@/lib/foto-instagram-reglas';

export type { PerfilIg };

const SANS = "'Geist', sans-serif";
/** El tope de la ruta (60 s) + un margen. */
const TOPE_MS = 62_000;
/** El alto de diseño de la lista: con él se decide el lado, y es su máximo. */
const ALTO_LISTA = 360;

const campo: CSSProperties = {
  width: '100%', padding: '10px 13px 10px 38px', borderRadius: 10, border: '1px solid var(--border-strong)',
  background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none',
};

export type Respuesta =
  | { texto: string; perfiles: PerfilIg[]; porNombre: boolean | null; meta: EstadoMeta | null; limite: boolean }
  | { texto: string; fallo: true };

type Lugar = { top?: number; bottom?: number; left: number; width: number; alto: number };

/** La foto del perfil, o sus iniciales si no tiene o si la URL ya venció. */
function Foto({ perfil, size, rota, onRota }: { perfil: PerfilIg; size: number; rota: boolean; onRota: () => void }) {
  const src = rota ? null : fotoPorNosotros(perfil.foto);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} onError={onRota}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none', display: 'block' }} />
    );
  }
  return <Avatar name={perfil.nombre ?? perfil.usuario} size={size} />;
}

/**
 * LA búsqueda: espera, cancela lo viejo y tiene tope (ver la cabecera). Salió del componente el 3/11/2026 para que el modal
 * de Competitors Spy use ESTA y no otra: su lista se dibuja distinto, pero buscar se hace de una sola manera.
 */
export function useBusquedaInstagram(consulta: string, buscable: boolean, ronda: number, alLlegar?: () => void) {
  const [resp, setResp] = useState<Respuesta | null>(null);
  const alLlegarRef = useRef(alLlegar);
  useLayoutEffect(() => { alLlegarRef.current = alLlegar; });

  useEffect(() => {
    if (!buscable) return;
    let vigente = true;
    const ctrl = new AbortController();
    const espera = setTimeout(async () => {
      const tope = setTimeout(() => ctrl.abort(), TOPE_MS);
      try {
        const r = await fetch(`/api/crm/instagram-buscar?q=${encodeURIComponent(consulta)}`, { signal: ctrl.signal });
        const j = (await r.json().catch(() => null)) as { ok?: boolean; perfiles?: unknown; porNombre?: unknown; meta?: unknown; limite?: unknown } | null;
        if (!vigente) return;
        if (!r.ok || !j?.ok || !Array.isArray(j.perfiles)) throw new Error(`HTTP ${r.status}`);
        const perfiles = (j.perfiles as PerfilIg[]).filter((p) => p && typeof p.usuario === 'string' && p.usuario);
        setResp({ texto: consulta, perfiles, porNombre: typeof j.porNombre === 'boolean' ? j.porNombre : null, meta: esEstadoMeta(j.meta) ? j.meta : null, limite: j.limite === true });
        alLlegarRef.current?.();
      } catch {
        // Lo cancelado por una tecla nueva no es un fallo: `vigente` ya es false.
        if (vigente) setResp({ texto: consulta, fallo: true });
      } finally {
        clearTimeout(tope);
      }
    }, ESPERA_MS);
    return () => { vigente = false; clearTimeout(espera); ctrl.abort(); };
  }, [buscable, consulta, ronda]);

  return [resp, setResp] as const;
}

export function InstagramBuscador({ valor, onElegir, onTexto, textoInicial, enLaFicha }: {
  valor: PerfilIg | null;
  onElegir: (p: PerfilIg | null) => void;
  /**
   * Lo ESCRITO en el campo, en cada tecla (y `''` al elegir un perfil). El alta lo usa para no
   * perder un @ tipeado y no elegido de la lista (`instagramDelAlta`, app/crm/campo-inline.ts).
   */
  onTexto?: (texto: string) => void;
  /**
   * Lo que el campo trae escrito al MONTARSE: el borrador del alta (app/crm/new/borrador-alta.ts).
   * Se lee una sola vez; para cambiarlo después, quien monta cambia la `key`.
   */
  textoInicial?: string;
  /**
   * EN LA FICHA del lead (22/10/2026, ver la cabecera): Enter sin nada que elegir y salir del campo llaman a
   * `confirmar` con lo escrito; Escape, a `cancelar`. El alta no lo pasa: ahí el campo vive en el formulario.
   */
  enLaFicha?: { confirmar: (texto: string) => void; cancelar: () => void };
}) {
  const [texto, setTexto] = useState(textoInicial ?? '');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [rotas, setRotas] = useState<ReadonlySet<string>>(() => new Set());
  const [lugar, setLugar] = useState<Lugar | null>(null);
  // En la ficha, el @ con el que abre no se busca hasta la primera tecla: abrir el campo no gasta una búsqueda.
  const [tocado, setTocado] = useState(!enLaFicha);
  // Sube después de conectar Meta: lo escrito se vuelve a buscar, ahora con la conexión.
  const [ronda, setRonda] = useState(0);
  const [conexion, setConexion] = useState<ConexionMeta | null>(null);
  const preguntada = useRef(false);
  const conectandoRef = useRef(false);
  const fichaRef = useRef(enLaFicha);
  useLayoutEffect(() => { fichaRef.current = enLaFicha; });
  const cajaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const idLista = useId();

  const consulta = texto.trim();
  const buscable = !valor && tocado && alcanzaParaBuscar(consulta);
  const [resp, setResp] = useBusquedaInstagram(consulta, buscable, ronda, () => setActivo(0));

  // ¿El negocio puede buscar en Meta? Una vez por campo, al enfocarlo; y otra, `fresco`, después de conectar. Sin
  // respuesta no se dice nada: el campo sigue sirviendo para escribir el @.
  const preguntarConexion = useCallback(async (fresco: boolean) => {
    try {
      const r = await fetch(`/api/crm/instagram-buscar?estado=1${fresco ? '&fresco=1' : ''}`, { signal: AbortSignal.timeout(TOPE_MS) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; conexion?: unknown } | null;
      if (r.ok && j?.ok && esConexionMeta(j.conexion)) setConexion(j.conexion);
    } catch { /* sin respuesta: el campo queda como estaba */ }
  }, []);

  const integracion = useConectarIntegracion({
    onConectado: () => { void preguntarConexion(true).then(() => { setResp(null); setRonda((n) => n + 1); }); },
  });
  const conectando = integracion.abierto != null;

  // Cerrado el modal, el foco vuelve al campo (ModalShell no lo devuelve): en la ficha, un campo abierto y sin foco
  // no tendría cómo cerrarse con el teclado.
  useEffect(() => {
    if (conectando || !conectandoRef.current) return;
    conectandoRef.current = false;
    inputRef.current?.focus();
  }, [conectando]);

  // En la ficha el campo abre con el foco y el cursor al final del @, como el resto de la ficha (`abrirCampoEn`).
  const enFicha = !!enLaFicha;
  useEffect(() => {
    const el = inputRef.current;
    if (!enFicha || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [enFicha]);

  // Lo que se dibuja sale del texto de AHORA: una respuesta de otro texto no cuenta.
  const actual = resp && resp.texto === consulta ? resp : null;
  const encontrados = actual && 'perfiles' in actual ? actual.perfiles : null;
  const fallo = !!actual && 'fallo' in actual;
  const buscando = buscable && !actual;
  const manual = perfilManual(consulta);
  const opciones: PerfilIg[] = [
    ...(encontrados ?? []),
    ...(manual && !(encontrados ?? []).some((p) => p.usuario === manual.usuario) ? [manual] : []),
  ];
  const iActivo = opciones.length ? Math.min(activo, opciones.length - 1) : -1;
  const listaVisible = abierto && buscable;

  const ubicar = useCallback(() => {
    const r = cajaRef.current?.getBoundingClientRect();
    if (!r) return;
    const l = lugarDelMenu({ top: r.top, bottom: r.bottom, ventana: window.innerHeight, alto: ALTO_LISTA });
    const alto = altoMaximoDelMenu(ALTO_LISTA, Math.max(0, l.espacio - CAJA_MENU));
    setLugar(l.arriba
      ? { bottom: window.innerHeight - r.top + SEPARACION_MENU, left: r.left, width: r.width, alto }
      : { top: r.bottom + SEPARACION_MENU, left: r.left, width: r.width, alto });
  }, []);

  useLayoutEffect(() => {
    if (listaVisible) ubicar();
  }, [listaVisible, ubicar]);

  useEffect(() => {
    if (!listaVisible) return;
    // La lista es fija sobre la ventana: si scrollea lo de atrás (el cuerpo del modal), se la reubica.
    const seguir = (e?: Event) => {
      if (e?.target instanceof Node && listaRef.current?.contains(e.target)) return;
      ubicar();
    };
    window.addEventListener('scroll', seguir, true);
    window.addEventListener('resize', seguir);
    return () => {
      window.removeEventListener('scroll', seguir, true);
      window.removeEventListener('resize', seguir);
    };
  }, [listaVisible, ubicar]);

  // El Escape: con la lista abierta, la cierra. En la ficha cancela la edición, también sin la lista (con el foco en el
  // campo). Con el modal de Meta encima, el Escape es del modal.
  useEffect(() => {
    if (!listaVisible && !enFicha) return;
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || conectandoRef.current) return;
      if (!listaVisible && document.activeElement !== inputRef.current) return;
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
      setAbierto(false);
      fichaRef.current?.cancelar();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [listaVisible, enFicha]);

  // «Conectar Meta»: el modal de la casa, sin salir de la tab. ⚠️ Se marca ANTES de soltar el foco: ese blur no confirma
  // (en la ficha cerraría el campo, y el modal con él).
  const conectar = () => {
    conectandoRef.current = true;
    setAbierto(false);
    inputRef.current?.blur();
    integracion.abrir('meta');
  };
  // ⚠️ `onMouseDown` sin default: el clic no le saca el foco al campo antes de su `click` (en la ficha, ese blur
  // guardaba y cerraba el campo, y el botón desaparecía antes de abrir nada).
  const botonConectar = (
    <button type="button" data-conectar-integracion="meta" onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.stopPropagation(); conectar(); }}
      style={{ appearance: 'none', background: 'none', border: 0, padding: 0, margin: 0, font: 'inherit', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', flex: 'none' }}>
      Conectar Meta
    </button>
  );

  const elegir = (p: PerfilIg) => {
    onElegir(p);
    setTexto('');
    onTexto?.('');
    setResp(null);
    setAbierto(false);
  };

  const quitar = () => {
    onElegir(null);
    // El input vuelve a existir en el render siguiente.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const marcarRota = (url: string | null) => () => {
    if (url) setRotas((prev) => new Set(prev).add(url));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && opciones.length) {
      e.preventDefault();
      setAbierto(true);
      setActivo((i) => (Math.min(i, opciones.length - 1) + 1) % opciones.length);
    } else if (e.key === 'ArrowUp' && opciones.length) {
      e.preventDefault();
      setActivo((i) => (Math.min(i, opciones.length - 1) - 1 + opciones.length) % opciones.length);
    } else if (e.key === 'Enter' && consulta) {
      e.preventDefault();
      if (listaVisible && iActivo >= 0) elegir(opciones[iActivo]);
      else enLaFicha?.confirmar(texto);
    } else if (e.key === 'Enter' && enLaFicha) {
      // Vacío, en la ficha: confirmarlo es borrar el dato.
      e.preventDefault();
      enLaFicha.confirmar(texto);
    }
  };

  // ── Elegido: la cuenta puesta, con su foto y una ✕ para sacarla ────────────
  if (valor) {
    return (
      <>
        {integracion.modal}
        <div style={{ ...campo, padding: '6px 6px 6px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Foto perfil={valor} size={30} rota={!!valor.foto && rotas.has(valor.foto)} onRota={marcarRota(valor.foto)} />
          <div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}>
            <a href={urlDePerfil(valor.usuario)} target="_blank" rel="noopener noreferrer" title="Abrir en Instagram"
              style={{ display: 'block', fontWeight: 600, fontSize: 14, color: 'var(--ink)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              @{valor.usuario}
            </a>
            {valor.nombre && (
              <div style={{ fontSize: 13, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor.nombre}</div>
            )}
          </div>
          <button type="button" onClick={quitar} aria-label="Quitar el Instagram" title="Quitar"
            style={{ flex: 'none', width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--dim)', cursor: 'pointer' }}>
            <Icon name="x" size={14} />
          </button>
        </div>
      </>
    );
  }

  // ── Buscando: el campo y su lista ──────────────────────────────────────────
  const vacio = !buscando && !encontrados?.length;
  const fila: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, cursor: 'pointer' };
  const nota: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', fontSize: 13, color: 'var(--dim)' };
  const metaDeLaBusqueda = actual && 'meta' in actual ? actual.meta : null;

  return (
    <>
      <div ref={cajaRef} style={{ position: 'relative' }}>
        <span aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', color: 'var(--faint)', pointerEvents: 'none' }}>
          <Icon name="instagram" size={17} />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={texto}
          onChange={(e) => { setTexto(e.target.value); onTexto?.(e.target.value); setActivo(0); setAbierto(true); setTocado(true); }}
          onFocus={() => {
            setAbierto(true);
            if (!preguntada.current) { preguntada.current = true; void preguntarConexion(false); }
          }}
          onBlur={() => {
            setAbierto(false);
            // En la ficha, salir del campo confirma lo escrito; no cuando el foco se lo llevó «Conectar Meta».
            if (!conectandoRef.current) fichaRef.current?.confirmar(texto);
          }}
          onKeyDown={onKeyDown}
          placeholder="Su @usuario de Instagram"
          aria-label="Instagram"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listaVisible}
          aria-controls={idLista}
          aria-activedescendant={listaVisible && iActivo >= 0 ? `${idLista}-${iActivo}` : undefined}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          style={{ ...campo, paddingRight: buscando ? 38 : 13 }}
        />
        {buscando && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', color: 'var(--faint)' }}>
            <Spinner size={15} />
          </span>
        )}

        {listaVisible && lugar && createPortal(
          <div
            ref={listaRef}
            id={idLista}
            role="listbox"
            aria-label="Cuentas de Instagram"
            // Que el clic en una opción no le saque el foco al campo (el blur cerraría la lista antes del clic).
            onMouseDown={(e) => e.preventDefault()}
            style={{
              position: 'fixed', top: lugar.top, bottom: lugar.bottom, left: lugar.left, width: lugar.width, zIndex: 1000,
              maxHeight: lugar.alto, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.22)', padding: 6, fontFamily: SANS,
            }}
          >
            {buscando && (
              <div style={nota}><Spinner size={14} /> Buscando en Instagram…</div>
            )}
            {!buscando && fallo && (
              <div style={nota}>No pude buscar{manual ? '' : '. Escribe el @ exacto'}</div>
            )}
            {!buscando && !fallo && vacio && (
              <div style={{ ...nota, flexWrap: 'wrap' }}>
                <span>{avisoSinResultados({
                  esUsuario: usuarioDeTexto(consulta) != null,
                  meta: metaDeLaBusqueda,
                  porNombre: actual && 'porNombre' in actual ? actual.porNombre : null,
                })}</span>
                {/* Sin Meta conectado, la fila lleva el botón: la frase sola no dejaba hacer nada (22/10/2026). ⚠️ UNA VEZ
                    (24/10/2026: salía «Conectar Meta» DOS veces, acá y debajo del campo): si la línea de debajo ya lo
                    ofrece, la fila sólo dice el porqué. */}
                {pideConectarMeta(metaDeLaBusqueda) && !pideConectarMeta(conexion) && botonConectar}
              </div>
            )}
            {opciones.map((p, i) => {
              const esManual = p === manual;
              return (
                <div
                  key={`${esManual ? 'manual' : 'perfil'}:${p.usuario}`}
                  id={`${idLista}-${i}`}
                  role="option"
                  aria-selected={i === iActivo}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => elegir(p)}
                  style={{ ...fila, background: i === iActivo ? 'var(--surface-2)' : 'transparent' }}
                >
                  {esManual ? (
                    <span aria-hidden style={{ width: 36, height: 36, flex: 'none', borderRadius: '50%', border: '1px solid var(--border-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)' }}>
                      <Icon name="instagram" size={17} />
                    </span>
                  ) : (
                    <Foto perfil={p} size={36} rota={!!p.foto && rotas.has(p.foto)} onRota={marcarRota(p.foto)} />
                  )}
                  <div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {esManual ? `Usar @${p.usuario}` : p.usuario}
                    </div>
                    {!esManual && p.nombre && (
                      <div style={{ fontSize: 13, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
      </div>
      {/* Sin Meta conectado, ANTES de escribir: el porqué y el botón (22/10/2026). Afuera de `cajaRef`: la lista se
          ubica contra el campo, no contra esta línea. */}
      {(pideConectarMeta(conexion) || (conexion === 'sin-instagram' && !encontrados?.length)) && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 8px', marginTop: 6, fontFamily: SANS, fontSize: 12.5, fontWeight: 400, color: 'var(--dim)' }}>
          {/* Con Meta conectada pero sin Instagram (24/10/2026), el porqué SIN botón: conectar no lo arregla. */}
          <span>{conexion === 'sin-instagram' ? AVISO_SIN_INSTAGRAM : AVISO_SIN_META}</span>
          {pideConectarMeta(conexion) && botonConectar}
        </div>
      )}
      {integracion.modal}
    </>
  );
}
