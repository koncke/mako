'use client';

// =============================================================================
// GaleriaPlantillas — «＋ Nueva»: pedírsela a MaKo, en blanco o desde una plantilla
// =============================================================================
// Pedido de Martín (10/10/2026), al preguntarle si quería las automatizaciones de los clientes como
// galería al crear o copiadas a su workspace: «Si, hagamos la galería de las más comunes...». La
// galería sale de lib/plantillas-automatizaciones.ts (el catálogo, puro y con test) y la crea el
// server (POST /api/chat-agent/secuencias `crear_desde_plantilla`, lib/plantilla-crear.ts): APAGADA,
// en este workspace y sin un envío.
//
// ── LA GALERÍA v2 (décima tanda, 11/10/2026: docs/diseno-automations-galeria-v2.md §1 y §2) ──────────────
// Martín, textual: «elimina los pasos de "¿Qué la dispara?", eso ya lo hacemos dentro en el CRON», «Elimina los
// títulos... Como el de "O empieza así" o el de "Desde una plantilla"», «Que la primera "plantilla" sea siempre
// "Lienzo en blanco"», «Agrega una barra de busqueda y filtro para buscar plantillas. No importa la busqueda o filtro,
// la primera siempre "Lienzo en blanco"» y «La opción de "Pideselo a MaKo"... allí mismo ya debería poder escribir y
// grabar audio». De arriba abajo, sin rótulos de sección (queda sólo el título del Modal):
//   1. «Pídeselo a MaKo»: la barra de WhatsApp con el logo de MaKo (`BarraPideselo`, app/automations/ChatMako.tsx;
//      hasta la duodécima, la caja de CrearConIA.tsx y después el chat en `modo: 'galeria'`). DECIMOTERCERA TANDA (punto
//      2): NO trabaja acá. Al enviar, el modal se cierra y quien monta crea la fila YA, abre su lienzo y el chat de esa
//      fila le pasa el pedido a MaKo (`onPedirAMako`, ChatAgentApp.tsx).
//   2. El buscador y el filtro (Canal y Objetivo) en una fila. Lo que filtra es puro y con test
//      (`filtrarPlantillas`, `alternarFiltroGaleria`).
//   3. La grilla: «Lienzo en blanco» PRIMERA SIEMPRE (ningún texto ni filtro la saca), «Pegar lo copiado» si hay algo
//      copiado, y las plantillas que pasan el filtro — las del Chatbot y las de «MaKo en WhatsApp» MEZCLADAS, con la
//      misma tarjeta. Sin resultados: «Lienzo en blanco» y una línea.
//   · Undécima tanda (punto 9): la barra es UNA y la galería se abre siempre por «＋ Nueva», sin filtro puesto (se
//     fueron `seccion`, `filtroDeSeccion` y «Ya la tienes» del recordatorio, que ya no es una plantilla).
//   ⛔ Se fueron «¿Qué la dispara?» (los seis botones del CRON, `ElegirClase`) y su consumidor (`arranque`, que abría el
//   CRON de la recién creada en ese tipo), los rótulos de sección y el scroll a la sección de MaKo.
//
// UNA PREGUNTA POR PANTALLA (la regla de la casa, «un paso por pantalla»): elegir una plantilla que arranca en una etapa
// (o una etiqueta) del negocio pregunta CUÁL, con LAS MISMAS opciones que el editor del CRON (`seccionesParaCron`,
// `seccionesDeEtiquetas`). «Elegir después» la crea con el CRON a elegir.
//
// ⚠️ «LIENZO EN BLANCO» ES DE QUIEN MONTA ESTO (`onBlanco`): crea la automatización vacía de «＋ Nueva» (`crearNueva`,
// app/automations/ChatAgentApp.tsx). Esta pantalla no tiene su propio camino para eso: sería la segunda copia de «Nueva».
//
// ⚠️ EL `onCerrar` DEL MODAL VA CON IDENTIDAD FIJA (AGENTS.md: el efecto de foco del Modal depende
// de él, y una flecha nueva por render le devuelve el foco atrás en cada cambio). Y mientras se crea
// —una plantilla o con MaKo— no se cierra: lo único no interrumpible es una operación en curso.
//
// ⚠️ EL HOVER VA EN LA CLASE, NUNCA EN EL `style` (docs/hallazgos-chatbot.md, parte «horario»: un
// `border` en línea anula el `:hover` de la clase).

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { Dropdown } from '@/app/components/Dropdown';
import { Icon } from '@/app/_components/icons';
import {
  PLANTILLAS, seccionesParaCron, seccionesDeEtiquetas, rotuloDeEleccion, filtrarPlantillas, filtroDeValores, alternarFiltroGaleria,
  gruposDelFiltroGaleria,
  type PlantillaAutomatizacion, type PideCron, type EtiquetaParaPlantilla,
} from '@/lib/plantillas-automatizaciones';
import type { ProductoParaDisparo } from '@/lib/flujo-conversacion';
import { leerCopia } from '@/lib/flujo-copia';
import { useEtiquetasTodas } from '@/app/_components/etiquetas-cliente';
import { BarraPideselo } from './ChatMako';
import { CSS_NUEVO } from './NuevoPlaceholder';
import { IconoDisparador } from './IconosDisparador';

/** Lo que contesta el server al crear una desde una plantilla. */
export type CreadaGaleria = {
  secuenciaId: number;
  nombre: string;
  /** Qué falta elegir en el CRON (null = quedó puesta la etapa). */
  pide: PideCron | null;
  /** Por qué no se pudo guardar la etapa elegida, si pasó. */
  aviso: string | null;
};

const API = '/api/chat-agent/secuencias';
/** El tope del pedido: crear son tres escrituras; si no contesta en esto, algo está mal y se dice. */
const TOPE_MS = 30_000;

export const TITULO_GALERIA = 'Nueva automatización';
export const PREGUNTA_ETAPA = '¿En qué etapa arranca?';
export const PREGUNTA_ETIQUETA = '¿Con qué etiqueta arranca?';
/** «Lienzo en blanco»: la primera tarjeta, SIEMPRE (`data-empezar="blanco"`). */
export const BLANCO = { nombre: 'Lienzo en blanco', linea: 'Empieza de cero.' } as const;
export const PLACEHOLDER_BUSCAR = 'Buscar plantillas';
/** Lo que se lee cuando ninguna plantilla pasa el filtro (queda «Lienzo en blanco»). */
export const SIN_RESULTADOS = 'Ninguna plantilla con eso';

/**
 * ¿Al elegirla hay que preguntar la etapa (o la etiqueta)? Sólo si arranca en una y hay para ofrecer: si no, nace con
 * el CRON a elegir. Una con el CRON fijo (un evento de MaKo o de un canal) no pregunta nada.
 */
export function preguntaEtapa(p: PlantillaAutomatizacion, productos: readonly ProductoParaDisparo[], etiquetas: readonly EtiquetaParaPlantilla[] = []): boolean {
  if (!p.cron.pide) return false;
  return (p.cron.pide === 'etiqueta' ? seccionesDeEtiquetas(etiquetas) : seccionesParaCron(p.cron.pide, productos)).length > 0;
}

/**
 * EL ÍCONO DE CADA OPCIÓN DEL FILTRO (la regla de la casa: cada opción de un desplegable lleva el suyo). Instagram y
 * Messenger con sus logos (`IconoDisparador`, los del CRON); el resto, del set de la casa.
 */
const ICONO_FILTRO: Readonly<Record<string, NombreIconoMenu | ReactElement>> = {
  'canal:whatsapp': 'whatsapp', 'canal:email': 'email', 'canal:mako': 'mako',
  'canal:instagram': <IconoDisparador tipo="instagram" tam={18} />, 'canal:messenger': <IconoDisparador tipo="messenger" tam={18} />,
  'objetivo:captar': 'persona', 'objetivo:agendar': 'calendario', 'objetivo:reunion': 'cita', 'objetivo:recuperar': 'repetir',
  'objetivo:vender': 'producto', 'objetivo:clientes': 'cliente', 'objetivo:cobrar': 'dinero',
};

const CSS = `
.gal-grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:12px}
.gal-tarjeta{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;padding:16px;min-height:124px;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink);font-family:inherit;cursor:pointer;transition:border-color .14s ease,box-shadow .14s ease,transform .14s ease}
.gal-tarjeta:hover:not(:disabled),.gal-tarjeta:focus-visible{border-color:var(--primary);box-shadow:0 2px 12px rgba(18,21,27,.08);outline:none}
.gal-tarjeta:active:not(:disabled){transform:scale(.98)}
.gal-tarjeta:disabled{cursor:default;opacity:.55}
.gal-tarjeta[aria-busy="true"]{opacity:1;border-color:var(--primary)}
.gal-icono{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--dim)}
.gal-tarjeta:hover:not(:disabled) .gal-icono,.gal-tarjeta:focus-visible .gal-icono{color:var(--primary);background:var(--primary-bg)}
.gal-buscar{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;box-sizing:border-box;border-radius:10px;border:1px solid var(--border-strong);background:var(--surface);color:var(--dim)}
.gal-buscar:focus-within{border-color:var(--primary)}
.gal-buscar input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--ink);font:inherit;font-size:14px}
@media (prefers-reduced-motion: reduce){.gal-tarjeta{transition:none}.gal-tarjeta:active:not(:disabled){transform:none}}
`;

const NOMBRE: CSSProperties = { fontSize: 15, fontWeight: 700, lineHeight: 1.25 };
const LINEA: CSSProperties = { fontSize: 13, color: 'var(--dim)', lineHeight: 1.4 };

export function GaleriaPlantillas(p: {
  /** Los productos con sus etapas (los mismos que lee el editor del CRON). */
  productos: readonly ProductoParaDisparo[];
  onCerrar: () => void;
  /** «Lienzo en blanco»: quien monta crea la vacía de «＋ Nueva». */
  onBlanco: () => void;
  /** «Pegar lo copiado»: el texto del portapapeles (lib/flujo-copia.ts). Quien monta la crea. */
  onPegar?: (texto: string) => void;
  /** La que se creó desde una plantilla: quien monta la abre. */
  onCreada: (r: CreadaGaleria) => void;
  /**
   * «Pídeselo a MaKo» (decimotercera tanda, punto 2): el pedido escrito o dictado. Quien monta cierra el modal, crea la
   * fila YA y abre su lienzo con el chat de MaKo trabajando. Sin esto, la barra no se dibuja.
   */
  onPedirAMako?: (pedido: string) => void;
  /** Lo que se le había pedido y no llegó a crear la fila (vuelve a la barra). */
  pedidoInicial?: string | null;
}) {
  // LO COPIADO, si hay (copiar flujo, 10/10/2026: «al momento de crear un nuevo flujo que te aparezca la
  // opción de pegar»). Leer el portapapeles puede pedir permiso: si no lo dan, la opción no aparece.
  const [copiado, setCopiado] = useState<{ texto: string; nombre: string } | null>(null);
  useEffect(() => {
    if (!p.onPegar || typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;
    let vivo = true;
    navigator.clipboard.readText().then((t) => {
      const c = leerCopia(t);
      if (vivo && c) setCopiado({ texto: t, nombre: c.nombre ?? (c.pasos.length === 1 ? 'una tarjeta' : `${c.pasos.length} tarjetas`) });
    }).catch(() => { /* sin permiso: no se ofrece */ });
    return () => { vivo = false; };
    // Una vez, al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Las etiquetas del negocio: las pide «Bienvenida al newsletter» (arranca con «Se le puso [una etiqueta]»).
  const etiquetas: EtiquetaParaPlantilla[] = useEtiquetasTodas() ?? [];
  const [texto, setTexto] = useState('');
  /** El filtro (`canal:…`, `objetivo:…`). Abre sin filtro. */
  const [filtros, setFiltros] = useState<string[]>([]);
  const [elegida, setElegida] = useState<PlantillaAutomatizacion | null>(null);
  const [valor, setValor] = useState('');
  const [creando, setCreando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enVuelo = useRef(false);

  // Las props de AHORA, sin cambiarle la identidad al `onCerrar` del Modal (ver la cabecera).
  const props = useRef(p);
  useEffect(() => { props.current = p; });
  const cerrar = useCallback(() => { if (!enVuelo.current) props.current.onCerrar(); }, []);

  const filtro = filtroDeValores(filtros);
  const visibles = useMemo(() => filtrarPlantillas(PLANTILLAS, { texto, canal: filtro.canal, objetivo: filtro.objetivo }), [texto, filtro.canal, filtro.objetivo]);

  const crear = async (pl: PlantillaAutomatizacion, disparador: string | null) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setCreando(pl.id); setError(null);
    try {
      const r = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TOPE_MS),
        body: JSON.stringify({ action: 'crear_desde_plantilla', plantilla: pl.id, ...(disparador ? { disparador } : {}) }),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string; secuenciaId?: unknown; nombre?: unknown; pide?: unknown; aviso?: unknown } | null;
      if (!r.ok || !j?.ok || !(Number(j.secuenciaId) > 0)) { setError(j?.error || 'No se pudo crear'); return; }
      enVuelo.current = false;
      props.current.onCreada({
        secuenciaId: Number(j.secuenciaId), nombre: String(j.nombre ?? pl.nombre),
        pide: j.pide === 'etapa_venta' || j.pide === 'etapa_entrega' || j.pide === 'etiqueta' ? j.pide : null,
        aviso: typeof j.aviso === 'string' && j.aviso ? j.aviso : null,
      });
    } catch {
      setError('Sin conexión — prueba de nuevo.');
    } finally {
      enVuelo.current = false;
      setCreando(null);
    }
  };

  const elegir = (pl: PlantillaAutomatizacion) => {
    if (enVuelo.current) return;
    setError(null);
    if (preguntaEtapa(pl, p.productos, etiquetas)) { setElegida(pl); setValor(''); return; }
    void crear(pl, null);
  };

  // ── 2. ¿En qué etapa (o con qué etiqueta) arranca? ── (sólo se elige una que arranca así: `preguntaEtapa`)
  const pideElegida = elegida?.cron.pide;
  if (elegida && pideElegida) {
    const secciones = pideElegida === 'etiqueta' ? seccionesDeEtiquetas(etiquetas) : seccionesParaCron(pideElegida, p.productos);
    const pregunta = pideElegida === 'etiqueta' ? PREGUNTA_ETIQUETA : PREGUNTA_ETAPA;
    const ocupado = creando != null;
    return (
      <Modal titulo={`${elegida.emoji} ${elegida.nombre}`} onCerrar={cerrar} ancho={560}
        pie={
          <>
            <Button variant="tertiary" disabled={ocupado} onClick={() => { setElegida(null); setError(null); }}>Volver</Button>
            <Button variant="secondary" disabled={ocupado} onClick={() => void crear(elegida, null)}>Elegir después</Button>
            <Button variant="primary" disabled={!valor} loading={ocupado} onClick={() => void crear(elegida, valor)}>Crear</Button>
          </>
        }>
        <div data-galeria-paso="etapa" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{pregunta}</div>
          <Dropdown value={valor} secciones={secciones} search width="100%" variante="principal"
            botonLabel={rotuloDeEleccion(pideElegida, secciones, valor)}
            onChange={setValor} ariaLabel={pregunta} disabled={ocupado} />
          <div style={LINEA}>{elegida.cron.ayuda}</div>
          {error && <div role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{error}</div>}
        </div>
      </Modal>
    );
  }

  // ── 1. La galería ──
  const ocupado = creando != null;
  /** La tarjeta de una plantilla: la MISMA para todas. */
  const tarjeta = (pl: PlantillaAutomatizacion) => (
    <button key={pl.id} type="button" className="gal-tarjeta" data-plantilla={pl.id}
      disabled={ocupado && creando !== pl.id} aria-busy={creando === pl.id || undefined}
      onClick={() => elegir(pl)}>
      <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>{pl.emoji}</span>
      <span style={NOMBRE}>{pl.nombre}</span>
      <span style={LINEA}>{pl.linea}</span>
      {creando === pl.id && <span className="mk-spin" style={{ width: 14, height: 14, marginTop: 'auto' }} aria-label="Creando" />}
    </button>
  );
  const nFiltros = filtros.length;
  const grupos = gruposDelFiltroGaleria().map((g) => ({ ...g, options: g.options.map((o) => ({ ...o, icono: ICONO_FILTRO[o.value] })) }));
  const rotuloFiltro = nFiltros ? grupos.flatMap((g) => g.options).filter((o) => filtros.includes(o.value)).map((o) => o.label).join(' · ') : 'Filtrar';
  return (
    <Modal titulo={TITULO_GALERIA} onCerrar={cerrar} ancho={980} sinFiletes>
      <style>{CSS}</style>
      <style>{CSS_NUEVO}</style>
      <div data-galeria-paso="lista" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 1. «Pídeselo a MaKo», a lo ancho: escribir o mandar una nota de voz (punto 6 de la décima). Desde la
            decimotercera (punto 2) la barra sólo PIDE: el modal se cierra y la fila nace YA, con su lienzo y el chat de
            MaKo trabajando adentro. Si MaKo necesita un dato, lo pregunta ahí, en el chat de esa fila. */}
        {p.onPedirAMako && (
          <div data-galeria-ia>
            <BarraPideselo onPedido={(t) => props.current.onPedirAMako?.(t)} deshabilitado={creando != null} inicial={p.pedidoInicial} />
          </div>
        )}

        {/* 2. El buscador y el filtro, en una fila (punto 5). */}
        <div data-galeria-busqueda style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="gal-buscar">
            <Icon name="search" size={16} />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={PLACEHOLDER_BUSCAR}
              aria-label={PLACEHOLDER_BUSCAR} disabled={ocupado} />
          </label>
          <span style={{ flex: 'none', display: 'inline-flex' }} data-galeria-filtro>
            <Dropdown value="" varios={filtros} onChange={(v) => setFiltros((f) => alternarFiltroGaleria(f, v))}
              columns={[grupos]} alContenido search={false} align="right" disabled={ocupado}
              ariaLabel={nFiltros ? `Filtrar (${nFiltros})` : 'Filtrar'}
              icono={<Icon name="funnel" size={16} />} botonLabel={rotuloFiltro}
              pie={nFiltros ? { label: 'Quitar filtros', onClick: () => setFiltros([]) } : undefined}
              buttonStyle={{ height: 38, borderRadius: 10, color: nFiltros ? 'var(--primary)' : 'var(--dim)', borderColor: nFiltros ? 'var(--primary-weak)' : 'var(--border-strong)' }} />
          </span>
        </div>

        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{error}</div>}

        {/* 3. La grilla: «Lienzo en blanco» PRIMERA SIEMPRE, lo copiado y las plantillas que pasan el filtro. */}
        <div className="gal-grilla" data-galeria-grilla>
          <button type="button" className="gal-tarjeta mk-nuevo" data-empezar="blanco" disabled={ocupado}
            onClick={() => props.current.onBlanco()}>
            <span className="gal-icono" aria-hidden><span className="mk-nuevo__mas" style={{ fontSize: 20, lineHeight: 1 }}>＋</span></span>
            <span style={NOMBRE}>{BLANCO.nombre}</span>
            <span style={LINEA}>{BLANCO.linea}</span>
          </button>
          {copiado && p.onPegar && (
            <button type="button" className="gal-tarjeta" data-pegar disabled={ocupado}
              onClick={() => props.current.onPegar?.(copiado.texto)}>
              <span className="gal-icono" aria-hidden><IconoMenu nombre="copiar" size={20} /></span>
              <span style={NOMBRE}>Pegar lo copiado</span>
              <span style={LINEA}>«{copiado.nombre}»</span>
            </button>
          )}
          {visibles.map(tarjeta)}
        </div>
        {!visibles.length && <div data-galeria-vacia style={LINEA}>{SIN_RESULTADOS}</div>}
      </div>
    </Modal>
  );
}
