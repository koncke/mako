'use client';

// =============================================================================
// GaleriaPlantillas — «＋ Nueva»: en blanco, con MaKo o desde una plantilla
// =============================================================================
// Pedido de Martín (10/10/2026), al preguntarle si quería las automatizaciones de los clientes como
// galería al crear o copiadas a su workspace: «Si, hagamos la galería de las más comunes...». La
// galería sale de lib/plantillas-automatizaciones.ts (el catálogo, puro y con test) y la crea el
// server (POST /api/chat-agent/secuencias `crear_desde_plantilla`, lib/plantilla-crear.ts): APAGADA,
// en este workspace y sin un envío.
//
// UNA PREGUNTA POR PANTALLA (la regla de la casa, «un paso por pantalla»):
//   1. ¿Cómo empiezas? Dos tarjetas grandes —«En blanco» y «Con MaKo», lo de «＋ Nueva»— y debajo
//      la galería: emoji, nombre y una línea. Elegir una la crea y la abre.
//   2. ¿En qué etapa arranca? Sólo si la plantilla arranca en una etapa del negocio Y el negocio tiene
//      etapas de ese kanban: el desplegable de la casa con LAS MISMAS opciones que el editor del CRON
//      (`seccionesParaCron` sale de `pasosDisparo`). «Elegir después» la crea con el CRON a elegir,
//      que es lo que dice la tarjeta CRON de una recién creada («Elige qué la dispara»).
//
// ⚠️ «EN BLANCO» Y «CON MaKo» SON DE QUIEN MONTA ESTO (`onEmpezar`): crean la automatización vacía
// de «＋ Nueva» (`crearNueva`, app/automations/ChatAgentApp.tsx), que es la que abre la caja de Crear
// con IA. Esta pantalla no tiene su propio camino para eso: sería la segunda copia de «Nueva».
//
// ⚠️ EL `onCerrar` DEL MODAL VA CON IDENTIDAD FIJA (AGENTS.md: el efecto de foco del Modal depende
// de él, y una flecha nueva por render le devuelve el foco atrás en cada cambio). Y mientras se crea
// no se cierra: lo único no interrumpible es una operación en curso.
//
// ⚠️ EL HOVER VA EN LA CLASE, NUNCA EN EL `style` (docs/hallazgos-chatbot.md, parte «horario»: un
// `border` en línea anula el `:hover` de la clase).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Dropdown } from '@/app/components/Dropdown';
import {
  PLANTILLAS, seccionesParaCron, rotuloDeEleccion, type PlantillaAutomatizacion, type PideCron,
} from '@/lib/plantillas-automatizaciones';
import type { ProductoParaDisparo } from '@/lib/flujo-conversacion';

/** Las dos formas de empezar sin plantilla (las de «＋ Nueva»). */
export type QueNueva = 'blanco' | 'mako';

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

/** Las dos tarjetas de arriba. El texto es corto a propósito: el nombre ya dice casi todo. */
export const EMPEZAR: ReadonlyArray<{ que: QueNueva; nombre: string; linea: string; icono: 'agregar' | 'mako' }> = [
  { que: 'blanco', nombre: 'En blanco', linea: 'Arma el flujo tarjeta por tarjeta.', icono: 'agregar' },
  { que: 'mako', nombre: 'Con MaKo', linea: 'Dile qué necesitas y MaKo la arma.', icono: 'mako' },
];

export const TITULO_GALERIA = 'Nueva automatización';
export const ROTULO_PLANTILLAS = 'Desde una plantilla';
export const PREGUNTA_ETAPA = '¿En qué etapa arranca?';

/** ¿Al elegirla hay que preguntar la etapa? Sólo si hay etapas para ofrecer: si no, nace con el CRON a elegir. */
export function preguntaEtapa(p: PlantillaAutomatizacion, productos: readonly ProductoParaDisparo[]): boolean {
  return seccionesParaCron(p.cron.pide, productos).length > 0;
}

const CSS = `
.gal-grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:12px}
.gal-grilla--empezar{grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))}
.gal-tarjeta{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;padding:16px;min-height:124px;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink);font-family:inherit;cursor:pointer;transition:border-color .14s ease,box-shadow .14s ease,transform .14s ease}
.gal-tarjeta:hover:not(:disabled),.gal-tarjeta:focus-visible{border-color:var(--primary);box-shadow:0 2px 12px rgba(18,21,27,.08);outline:none}
.gal-tarjeta:active:not(:disabled){transform:scale(.98)}
.gal-tarjeta:disabled{cursor:default;opacity:.55}
.gal-tarjeta[aria-busy="true"]{opacity:1;border-color:var(--primary)}
.gal-tarjeta--empezar{min-height:104px}
.gal-tarjeta--empezar .gal-icono{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--dim)}
.gal-tarjeta--empezar:hover:not(:disabled) .gal-icono,.gal-tarjeta--empezar:focus-visible .gal-icono{color:var(--primary);background:var(--primary-bg)}
@media (prefers-reduced-motion: reduce){.gal-tarjeta{transition:none}.gal-tarjeta:active:not(:disabled){transform:none}}
`;

const NOMBRE: CSSProperties = { fontSize: 15, fontWeight: 700, lineHeight: 1.25 };
const LINEA: CSSProperties = { fontSize: 13, color: 'var(--dim)', lineHeight: 1.4 };
const ROTULO: CSSProperties = {
  fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase',
  color: 'var(--faint)', margin: '22px 0 10px',
};

export function GaleriaPlantillas(p: {
  /** Los productos con sus etapas (los mismos que lee el editor del CRON). */
  productos: readonly ProductoParaDisparo[];
  onCerrar: () => void;
  /** «En blanco» o «Con MaKo»: quien monta crea la vacía de «＋ Nueva». */
  onEmpezar: (como: QueNueva) => void;
  /** La que se creó desde una plantilla: quien monta la abre. */
  onCreada: (r: CreadaGaleria) => void;
}) {
  const [elegida, setElegida] = useState<PlantillaAutomatizacion | null>(null);
  const [valor, setValor] = useState('');
  const [creando, setCreando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enVuelo = useRef(false);

  // Las props de AHORA, sin cambiarle la identidad al `onCerrar` del Modal (ver la cabecera).
  const props = useRef(p);
  useEffect(() => { props.current = p; });
  const cerrar = useCallback(() => { if (!enVuelo.current) props.current.onCerrar(); }, []);

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
        pide: j.pide === 'etapa_venta' || j.pide === 'etapa_entrega' ? j.pide : null,
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
    if (preguntaEtapa(pl, p.productos)) { setElegida(pl); setValor(''); return; }
    void crear(pl, null);
  };

  // ── 2. ¿En qué etapa arranca? ──
  if (elegida) {
    const secciones = seccionesParaCron(elegida.cron.pide, p.productos);
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
          <div style={{ fontSize: 17, fontWeight: 700 }}>{PREGUNTA_ETAPA}</div>
          <Dropdown value={valor} secciones={secciones} search width="100%" variante="principal"
            botonLabel={rotuloDeEleccion(elegida.cron.pide, secciones, valor)}
            onChange={setValor} ariaLabel={PREGUNTA_ETAPA} disabled={ocupado} />
          <div style={LINEA}>{elegida.cron.ayuda}</div>
          {error && <div role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{error}</div>}
        </div>
      </Modal>
    );
  }

  // ── 1. ¿Cómo empiezas? ──
  const ocupado = creando != null;
  return (
    <Modal titulo={TITULO_GALERIA} onCerrar={cerrar} ancho={760} sinFiletes>
      <style>{CSS}</style>
      <div data-galeria-paso="lista">
        <div className="gal-grilla gal-grilla--empezar">
          {EMPEZAR.map((e) => (
            <button key={e.que} type="button" className="gal-tarjeta gal-tarjeta--empezar" data-empezar={e.que} disabled={ocupado}
              onClick={() => props.current.onEmpezar(e.que)}>
              <span className="gal-icono" aria-hidden><IconoMenu nombre={e.icono} size={20} /></span>
              <span style={NOMBRE}>{e.nombre}</span>
              <span style={LINEA}>{e.linea}</span>
            </button>
          ))}
        </div>
        <div style={ROTULO}>{ROTULO_PLANTILLAS}</div>
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--bad)', marginBottom: 10 }}>{error}</div>}
        <div className="gal-grilla">
          {PLANTILLAS.map((pl) => (
            <button key={pl.id} type="button" className="gal-tarjeta" data-plantilla={pl.id}
              disabled={ocupado && creando !== pl.id} aria-busy={creando === pl.id || undefined}
              onClick={() => elegir(pl)}>
              <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>{pl.emoji}</span>
              <span style={NOMBRE}>{pl.nombre}</span>
              <span style={LINEA}>{pl.linea}</span>
              {creando === pl.id && <span className="mk-spin" style={{ width: 14, height: 14, marginTop: 'auto' }} aria-label="Creando" />}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
