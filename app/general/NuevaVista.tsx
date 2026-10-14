'use client';

// =============================================================================
// NuevaVista — «＋ Nueva vista» de /general: «¿Qué vas a crear hoy?», en blanco, o una plantilla
// =============================================================================
// Martín (13/10/2026): «Copia lo que ya tenemos en muchos lugares con "TEMPLATES" y la opción de IA de "¿Qué vas a
// crear hoy?"... Que hayan templates de tab general.» El molde es el de «Nueva automatización»
// (app/automations/GaleriaPlantillas.tsx) y «Nueva hoja» del Dashboard (app/dashboard/NuevaHoja.tsx), de arriba
// abajo y sin rótulos de sección:
//   1. La caja de «¿Qué vas a crear hoy?» — la MISMA del Landing Generator y de Automations (`CajaPedido`,
//      app/landing-generator/CajaPedido.tsx), con su ejemplo que se escribe solo y su micrófono.
//   2. El buscador de plantillas.
//   3. La grilla: «Vista en blanco» PRIMERA SIEMPRE (ningún texto del buscador la saca) y las plantillas.
//
// Lo que no se ve en la firma:
//   · ESTE MODAL NO GUARDA: devuelve la vista a quien lo monta (`onCrear`), que la guarda con el mismo camino que
//     cualquier cambio (app/general/BarraVistas.tsx). Así una vista de MaKo y una de plantilla son la misma cosa.
//   · MaKo NO ESCRIBE NADA: la ruta (app/api/general/ia/route.ts) devuelve la vista y acá se le pone el id. Cerrar
//     el modal corta el pedido y no queda nada a medias.
//   · `onCerrar` CON IDENTIDAD FIJA (`useCerrarEstable`): con una flecha nueva por render, el campo pierde el foco con
//     cada letra (AGENTS.md, «`<Modal>` guarda su `onCerrar` en un ref»). Mientras MaKo piensa no se cierra.
// =============================================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { MakoStar } from '@/app/_components/MakoBrand';
import { CSS_NUEVO } from '@/app/automations/NuevoPlaceholder';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import { CajaPedido, CSS_CAJA_PEDIDO, CSS_TOKENS_CASA, TITULO_CAJA } from '@/app/landing-generator/CajaPedido';
import { GRAMATICA } from '@/lib/mako-gramatica';
import {
  PLANTILLAS_GENERAL, VISTA_EN_BLANCO, filtrarPlantillasGeneral, vistaDePlantilla, vistaEnBlanco, nuevoIdVista,
  sanearVista, type VistaGeneral,
} from '@/lib/general-vistas-modelo';

/** El tope de la ruta (`maxDuration = 60`) + margen. */
const TOPE_CLIENTE_MS = 65_000;
const TOPE_PEDIDO = 1_500;

/** Genéricos a propósito: lo que mira un negocio cualquiera, sin un nombre propio (un ejemplo de UI es ficticio). */
const EJEMPLOS_VISTA = [
  'Lo que tengo que cobrar y mis prioridades del día',
  'Cómo va mi objetivo del trimestre',
  'Mi funnel de ventas y los leads sin marcar',
  'Una vista sólo para mi oferta principal',
  'El semáforo y cómo viene el mes',
] as const;

const CSS = `
.nv-grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:12px}
.nv-tarjeta{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;padding:16px;min-height:124px;box-sizing:border-box;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink);font-family:inherit;cursor:pointer;transition:border-color .14s ease,box-shadow .14s ease,transform .14s ease}
.nv-tarjeta:hover:not(:disabled),.nv-tarjeta:focus-visible{border-color:var(--primary);box-shadow:0 2px 12px color-mix(in srgb,var(--ink) 10%,transparent);outline:none}
.nv-tarjeta:active:not(:disabled){transform:scale(.98)}
.nv-tarjeta:disabled{cursor:default;opacity:.55}
.nv-blanco{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:124px;box-sizing:border-box;padding:16px;border-radius:14px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer}
.nv-buscar{display:flex;align-items:center;gap:8px;padding:0 12px;height:40px;box-sizing:border-box;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface);color:var(--dim)}
.nv-buscar:focus-within{border-color:var(--primary)}
.nv-buscar input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--ink);font:inherit;font-size:14px}
@media (prefers-reduced-motion: reduce){.nv-tarjeta{transition:none}.nv-tarjeta:active:not(:disabled){transform:none}}
`;

type Estado = { t: 'quieto'; error?: string } | { t: 'pensando'; desde: number };

export function NuevaVista({ existentes, onCerrar, onCrear }: {
  /** Los ids que ya hay: el nuevo no puede chocar. */
  existentes: readonly string[];
  onCerrar: () => void;
  /** La vista nueva (con id). `aviso`: lo primero que MaKo ajustó, para el toast. */
  onCrear: (v: VistaGeneral, aviso?: string) => void;
}) {
  const [pedido, setPedido] = useState('');
  const [estado, setEstado] = useState<Estado>({ t: 'quieto' });
  const [ahora, setAhora] = useState(() => Date.now());
  const [busca, setBusca] = useState('');
  const pensando = estado.t === 'pensando';
  const ctrl = useRef<AbortController | null>(null);
  const props = useRef({ onCrear, existentes });
  useEffect(() => { props.current = { onCrear, existentes }; });
  const cerrar = useCerrarEstable(onCerrar, pensando);

  useEffect(() => {
    if (!pensando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pensando]);
  useEffect(() => () => ctrl.current?.abort(), []);

  const crear = (v: VistaGeneral, aviso?: string) => {
    ctrl.current?.abort();
    ctrl.current = null;
    props.current.onCrear(v, aviso);
  };

  const enviar = async () => {
    const texto = pedido.trim();
    if (!texto || pensando) return;
    const c = new AbortController();
    ctrl.current = c;
    const tope = setTimeout(() => c.abort(), TOPE_CLIENTE_MS);
    setEstado({ t: 'pensando', desde: Date.now() });
    setAhora(Date.now());
    try {
      const res = await fetch('/api/general/ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido: texto }), signal: c.signal,
      });
      const j = await res.json().catch(() => null) as { ok?: boolean; vista?: unknown; avisos?: unknown; error?: string } | null;
      if (ctrl.current !== c) return;
      if (!res.ok || !j?.ok) { setEstado({ t: 'quieto', error: j?.error || `Error ${res.status}` }); return; }
      // Lo que llega por la red se vuelve a sanear: vale por lo que dice el catálogo de acá.
      const id = nuevoIdVista(props.current.existentes);
      const v = sanearVista({ ...(j.vista && typeof j.vista === 'object' ? j.vista : {}), id });
      if (!v || !v.bloques.length) { setEstado({ t: 'quieto', error: 'MaKo no eligió ningún bloque. Prueba de nuevo.' }); return; }
      const avisos = Array.isArray(j.avisos) ? j.avisos.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
      setEstado({ t: 'quieto' });
      crear(v, avisos[0]);
    } catch {
      if (ctrl.current !== c) return;
      setEstado({ t: 'quieto', error: c.signal.aborted ? 'Tardó demasiado. Prueba de nuevo.' : 'Sin conexión. Prueba de nuevo.' });
    } finally {
      clearTimeout(tope);
      if (ctrl.current === c) ctrl.current = null;
    }
  };

  const cancelar = () => { ctrl.current?.abort(); ctrl.current = null; setEstado({ t: 'quieto' }); };
  const plantillas = useMemo(() => filtrarPlantillasGeneral(PLANTILLAS_GENERAL, busca), [busca]);
  const segundos = estado.t === 'pensando' ? Math.max(0, Math.round((ahora - estado.desde) / 1000)) : 0;

  return (
    <Modal titulo="Nueva vista" ancho={980} sinFiletes onCerrar={cerrar}>
      <style>{CSS_NUEVO}</style>
      <style>{CSS}</style>
      <div data-nueva-vista="" style={S.todo}>
        {/* 1 · ¿Qué vas a crear hoy? — la caja de siempre. */}
        <div className="gp cp-casa" data-vista-ia="">
          <style>{CSS_TOKENS_CASA + CSS_CAJA_PEDIDO}</style>
          <CajaPedido titulo={{ texto: TITULO_CAJA, nivel: 2 }} valor={pedido} onValor={setPedido} onEnviar={() => { void enviar(); }}
            ejemplos={EJEMPLOS_VISTA} animar placeholderQuieto="Escribe o dicta qué quieres ver"
            etiqueta="Qué quieres ver en esta vista" tope={TOPE_PEDIDO} deshabilitado={pensando}
            onError={(m) => setEstado({ t: 'quieto', error: m ?? undefined })} />
          {pensando && (
            <div role="status" aria-live="polite" style={S.pensando}>
              <MakoStar size={16} animate />
              <span style={S.rotulo}>{GRAMATICA.analizando.rotulo}</span>
              <span style={S.dim}>· {segundos} s · hasta 1 min</span>
              <Button variant="tertiary" size="sm" onClick={cancelar}>Cancelar</Button>
            </div>
          )}
          {estado.t === 'quieto' && estado.error && <p role="alert" style={S.error}>{estado.error}</p>}
        </div>

        {/* 2 · El buscador */}
        <label className="nv-buscar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" />
          </svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar plantilla" aria-label="Buscar plantilla" disabled={pensando} />
        </label>

        {/* 3 · La grilla: «Vista en blanco» primera SIEMPRE */}
        <div className="nv-grilla">
          <button type="button" className="mk-nuevo nv-blanco" data-empezar="blanco" disabled={pensando}
            onClick={() => crear(vistaEnBlanco(props.current.existentes))}>
            <span aria-hidden className="mk-nuevo__mas" style={{ fontSize: 22, lineHeight: 1 }}>＋</span>
            {VISTA_EN_BLANCO.nombre}
          </button>
          {plantillas.map((p) => (
            <button key={p.id} type="button" className="nv-tarjeta" data-plantilla={p.id} disabled={pensando}
              onClick={() => crear(vistaDePlantilla(p, props.current.existentes))}>
              <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>{p.emoji}</span>
              <span style={S.nombre}>{p.nombre}</span>
              <span style={S.linea}>{p.linea}</span>
            </button>
          ))}
        </div>
        {!plantillas.length && <div style={S.linea}>Ninguna plantilla con eso</div>}
      </div>
    </Modal>
  );
}

const S: Record<string, CSSProperties> = {
  todo: { display: 'flex', flexDirection: 'column', gap: 16 },
  pensando: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  rotulo: { fontSize: 14, fontWeight: 600, color: 'var(--mako-ink)' },
  dim: { fontSize: 13, color: 'var(--dim)' },
  error: { margin: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--bad)', textAlign: 'center' },
  nombre: { fontSize: 15, fontWeight: 700, lineHeight: 1.25 },
  linea: { fontSize: 13, color: 'var(--dim)', lineHeight: 1.4 },
};
