'use client';

// =============================================================================
// NuevoEnCalendario — «＋ Nuevo» del Calendario: «¿Qué vas a crear hoy?», un evento en blanco, o una plantilla
// =============================================================================
// Martín: «que tenga IA que te ayude o "templates"». El molde es el de «Nueva automatización»
// (app/automations/GaleriaPlantillas.tsx), «Nueva hoja» del Dashboard y «Nueva vista» de General, sin rótulos de
// sección: la caja de siempre arriba (`CajaPedido`), el buscador, y la grilla con «Evento en blanco» primero.
//
// Lo que no se ve en la firma:
//   · TODO CAE EN LA SEMANA QUE SE ESTÁ MIRANDO (`lunes`): una plantilla son días de la semana y horas, y MaKo
//     propone sobre esas siete fechas. Para otra semana, se navega y se vuelve a abrir.
//   · MaKo PROPONE, LA PERSONA CONFIRMA (un canal propone, una persona confirma). Lo que vuelve de la IA se muestra
//     en una lista con casillas y recién «Agendar N» lo escribe. Y la IA no vio la agenda (lib/calendario-ia.ts).
//   · Una plantilla SÍ se agenda en el acto: la eligió la persona, viendo qué trae; quien monta ofrece «Deshacer».
//   · `onCerrar` con identidad fija, y mientras MaKo piensa o se guarda no se cierra.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { Checkbox } from '@/app/_ui/Toggle';
import { MakoStar } from '@/app/_components/MakoBrand';
import { CSS_NUEVO } from '@/app/automations/NuevoPlaceholder';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import { CajaPedido, CSS_CAJA_PEDIDO, CSS_TOKENS_CASA, TITULO_CAJA } from '@/app/landing-generator/CajaPedido';
import { GRAMATICA } from '@/lib/mako-gramatica';
import {
  PLANTILLAS_CALENDARIO, EVENTO_EN_BLANCO, filtrarPlantillasCalendario, entradasDePlantilla, rotuloDeRango,
  diaDeLaSemana, DIAS_CORTOS, ROTULO_TIPO, ROTULO_FORMATO, type EntradaEvento, type PlantillaCalendario,
} from '@/lib/calendario-modelo';

const TOPE_CLIENTE_MS = 65_000;
const TOPE_PEDIDO = 1_500;

/** Genéricos a propósito (un ejemplo de UI es ficticio por regla). */
const EJEMPLOS_CALENDARIO = [
  'Tres Reels y dos Stories para esta semana',
  'Un bloque cada mañana para escribir guiones',
  'La semana de lanzamiento de mi oferta',
  'Revisar los anuncios el lunes y el jueves',
  'Una hora el viernes para planear la semana',
] as const;

const CSS = `
.nc-grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:12px}
.nc-tarjeta{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;padding:16px;min-height:124px;box-sizing:border-box;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink);font-family:inherit;cursor:pointer;transition:border-color .14s ease,box-shadow .14s ease,transform .14s ease}
.nc-tarjeta:hover:not(:disabled),.nc-tarjeta:focus-visible{border-color:var(--primary);box-shadow:0 2px 12px color-mix(in srgb,var(--ink) 10%,transparent);outline:none}
.nc-tarjeta:active:not(:disabled){transform:scale(.98)}
.nc-tarjeta:disabled{cursor:default;opacity:.55}
.nc-blanco{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:124px;box-sizing:border-box;padding:16px;border-radius:14px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer}
.nc-buscar{display:flex;align-items:center;gap:8px;padding:0 12px;height:40px;box-sizing:border-box;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface);color:var(--dim)}
.nc-buscar:focus-within{border-color:var(--primary)}
.nc-buscar input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--ink);font:inherit;font-size:14px}
@media (prefers-reduced-motion: reduce){.nc-tarjeta{transition:none}.nc-tarjeta:active:not(:disabled){transform:none}}
`;

type Estado = { t: 'quieto'; error?: string } | { t: 'pensando'; desde: number };

/** Un renglón de lo que propone MaKo: el día, la hora y qué es. */
function describir(e: EntradaEvento): string {
  const dia = DIAS_CORTOS[diaDeLaSemana(e.fecha)] ?? '';
  const que = e.tipo === 'publicacion' && e.formato ? ROTULO_FORMATO[e.formato] : ROTULO_TIPO[e.tipo];
  return `${dia} ${e.fecha.slice(8, 10)}/${e.fecha.slice(5, 7)}${e.hora ? ` · ${e.hora}` : ''} · ${que}`;
}

export function NuevoEnCalendario({ lunes, guardando, onCerrar, onBlanco, onPlantilla, onConfirmarIA }: {
  /** El lunes de la semana que se está mirando: ahí cae todo. */
  lunes: string;
  guardando: boolean;
  onCerrar: () => void;
  onBlanco: () => void;
  onPlantilla: (p: PlantillaCalendario, entradas: EntradaEvento[]) => void;
  /** Lo que propuso MaKo y la persona dejó tildado. */
  onConfirmarIA: (entradas: EntradaEvento[], aviso?: string) => void;
}) {
  const [pedido, setPedido] = useState('');
  const [estado, setEstado] = useState<Estado>({ t: 'quieto' });
  const [ahora, setAhora] = useState(() => Date.now());
  const [busca, setBusca] = useState('');
  /** Lo que propuso MaKo: se revisa antes de agendarlo. */
  const [propuesta, setPropuesta] = useState<{ entradas: EntradaEvento[]; elegidas: boolean[]; aviso?: string } | null>(null);
  const pensando = estado.t === 'pensando';
  const ctrl = useRef<AbortController | null>(null);
  const cerrar = useCerrarEstable(onCerrar, pensando || guardando);

  useEffect(() => {
    if (!pensando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pensando]);
  useEffect(() => () => ctrl.current?.abort(), []);

  const enviar = async () => {
    const texto = pedido.trim();
    if (!texto || pensando) return;
    const c = new AbortController();
    ctrl.current = c;
    const tope = setTimeout(() => c.abort(), TOPE_CLIENTE_MS);
    setEstado({ t: 'pensando', desde: Date.now() });
    setAhora(Date.now());
    try {
      const res = await fetch('/api/calendario/ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido: texto, lunes }), signal: c.signal,
      });
      const j = await res.json().catch(() => null) as { ok?: boolean; entradas?: EntradaEvento[]; avisos?: unknown; error?: string } | null;
      if (ctrl.current !== c) return;
      if (!res.ok || !j?.ok || !Array.isArray(j.entradas) || !j.entradas.length) {
        setEstado({ t: 'quieto', error: j?.error || 'MaKo no propuso nada. Prueba con otras palabras.' });
        return;
      }
      const avisos = Array.isArray(j.avisos) ? j.avisos.filter((x): x is string => typeof x === 'string') : [];
      setEstado({ t: 'quieto' });
      setPropuesta({ entradas: j.entradas, elegidas: j.entradas.map(() => true), aviso: avisos[0] });
    } catch {
      if (ctrl.current !== c) return;
      setEstado({ t: 'quieto', error: c.signal.aborted ? 'Tardó demasiado. Prueba de nuevo.' : 'Sin conexión. Prueba de nuevo.' });
    } finally {
      clearTimeout(tope);
      if (ctrl.current === c) ctrl.current = null;
    }
  };

  const plantillas = useMemo(() => filtrarPlantillasCalendario(PLANTILLAS_CALENDARIO, busca), [busca]);
  const segundos = estado.t === 'pensando' ? Math.max(0, Math.round((ahora - estado.desde) / 1000)) : 0;
  const semana = rotuloDeRango('semana', lunes);

  // ── 2. Revisar lo que propuso MaKo ──
  if (propuesta) {
    const n = propuesta.elegidas.filter(Boolean).length;
    return (
      <Modal titulo="Lo que propone MaKo" ancho={620} onCerrar={cerrar}
        pie={
          <>
            <Button variant="tertiary" disabled={guardando} onClick={() => setPropuesta(null)}>Volver</Button>
            <Button variant="primary" loading={guardando} disabled={!n}
              onClick={() => onConfirmarIA(propuesta.entradas.filter((_, i) => propuesta.elegidas[i]), propuesta.aviso)}>
              {n === 1 ? 'Agendar 1 evento' : `Agendar ${n} eventos`}
            </Button>
          </>
        }>
        <div data-propuesta-ia="" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 6 }}>{semana}</span>
          {propuesta.entradas.map((e, i) => (
            <div key={i} style={{ padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <Checkbox checked={propuesta.elegidas[i]} disabled={guardando}
                onChange={(v) => setPropuesta((p) => (p ? { ...p, elegidas: p.elegidas.map((x, j) => (j === i ? v : x)) } : p))}
                label={<span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 600 }}>{e.titulo}</span>
                  <span style={{ fontSize: 13, color: 'var(--dim)' }}>{describir(e)}</span>
                </span>} />
            </div>
          ))}
        </div>
      </Modal>
    );
  }

  // ── 1. La galería ──
  return (
    <Modal titulo="Nuevo en el calendario" ancho={980} sinFiletes onCerrar={cerrar}>
      <style>{CSS_NUEVO}</style>
      <style>{CSS}</style>
      <div data-nuevo-calendario="" style={S.todo}>
        <div className="gp cp-casa" data-calendario-ia="">
          <style>{CSS_TOKENS_CASA + CSS_CAJA_PEDIDO}</style>
          <CajaPedido titulo={{ texto: TITULO_CAJA, nivel: 2 }} valor={pedido} onValor={setPedido} onEnviar={() => { void enviar(); }}
            ejemplos={EJEMPLOS_CALENDARIO} animar placeholderQuieto="Escribe o dicta qué quieres agendar"
            etiqueta="Qué quieres agendar esta semana" tope={TOPE_PEDIDO} deshabilitado={pensando || guardando}
            onError={(m) => setEstado({ t: 'quieto', error: m ?? undefined })} />
          {pensando && (
            <div role="status" aria-live="polite" style={S.pensando}>
              <MakoStar size={16} animate />
              <span style={S.rotulo}>{GRAMATICA.analizando.rotulo}</span>
              <span style={S.dim}>· {segundos} s · hasta 1 min</span>
              <Button variant="tertiary" size="sm" onClick={() => { ctrl.current?.abort(); ctrl.current = null; setEstado({ t: 'quieto' }); }}>Cancelar</Button>
            </div>
          )}
          {estado.t === 'quieto' && estado.error && <p role="alert" style={S.error}>{estado.error}</p>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label className="nc-buscar" style={{ flex: '1 1 260px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" />
            </svg>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar plantilla" aria-label="Buscar plantilla" disabled={pensando} />
          </label>
          <span style={S.dim}>{semana}</span>
        </div>

        <div className="nc-grilla">
          <button type="button" className="mk-nuevo nc-blanco" data-empezar="blanco" disabled={pensando || guardando} onClick={onBlanco}>
            <span aria-hidden className="mk-nuevo__mas" style={{ fontSize: 22, lineHeight: 1 }}>＋</span>
            {EVENTO_EN_BLANCO.nombre}
          </button>
          {plantillas.map((p) => (
            <button key={p.id} type="button" className="nc-tarjeta" data-plantilla={p.id} disabled={pensando || guardando}
              onClick={() => onPlantilla(p, entradasDePlantilla(p, lunes))}>
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
