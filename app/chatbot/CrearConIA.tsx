'use client';
// =============================================================================
// CrearConIA — la caja «✦ ¿Qué quieres que haga?» de una automatización del Chatbot
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 11): «Quiero que implementes la
// funcionalidad de crear un secuencia con IA, mediante un "prompt", y que ahí se vayan
// creando...». Decisión 14 de docs/chatbot-flujo-ramas-diseno.md.
//
// Dos formas, el mismo componente:
//   · `modo: 'crear'`  — la caja centrada del lienzo VACÍO de una automatización recién creada
//     («＋ Nueva» → `crear_vacia`), con dos o tres ejemplos que manda quien la monta.
//   · `modo: 'editar'` — una barra de una línea, «Pídele un cambio», para agregarle tarjetas.
//
// Habla con POST /api/chat-agent/secuencias/ia (stream NDJSON) y al terminar llama a `onListo`
// con el flujo, el orden en que se encienden las tarjetas (`revelar` del Lienzo) y los avisos.
// NO decide qué hacer con el resultado: crear ya lo GUARDÓ pausado; editar es un borrador local
// que el padre aplica con UNA foto de deshacer.
//
// ⚠️ MIENTRAS TRABAJA SE VEN LAS FASES REALES, no un spinner eterno: `GRAMATICA.analizando`
// («Revisando») exige mostrar sobre qué está trabajando, y AGENTS.md exige que todo lo que pueda
// pasar los ~8 s diga cuánto puede tardar. El tope del cliente es el de la ruta (300 s) + margen.
//
// ⚠️ No lo montan SecuenciaPerfil ni SimuladorWhatsApp (son de la parte L): lo enchufa la
// integración.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/app/_ui';
import { GRAMATICA } from '@/lib/mako-gramatica';
import type { EventoIA, ListoIA } from '@/lib/flujo-ia';
import type { PasoGrafo } from '@/lib/flujo-grafo';

/** Lo que recibe `onListo`. */
export type ListoCrearIA = Pick<ListoIA, 'secuenciaId' | 'pasos' | 'nombre' | 'orden' | 'avisos' | 'etiquetasNuevas'> & { modo: 'crear' | 'editar' };

export type CrearConIAProps = {
  modo: 'crear' | 'editar';
  secuenciaId: number;
  /** Editar: el borrador LOCAL del lienzo (puede tener cambios sin publicar). */
  pasos?: readonly PasoGrafo[];
  /** Crear: dos o tres pedidos de ejemplo (un clic los copia a la caja). */
  ejemplos?: readonly string[];
  /** Un pedido ya escrito (el «Armar una» de una etapa sin automatización). */
  pedidoInicial?: string;
  onListo: (r: ListoCrearIA) => void;
  deshabilitado?: boolean;
};

/** El tope de la ruta (`maxDuration = 300`) + margen: el `fetch` no puede esperar para siempre. */
const TOPE_CLIENTE_MS = 310_000;

type Fase = 'contexto' | 'modelo' | 'revision';
type Estado =
  | { t: 'quieto'; error?: string }
  | { t: 'trabajando'; fase: Fase | null; leido: string | null; reparadas: number | null; desde: number };

/** Lo que se dice de cada fase (corto: AGENTS.md, el texto que se dibuja). */
const TEXTO_FASE: Record<Fase, string> = {
  contexto: 'Leyendo tu negocio',
  modelo: 'Escribiendo el flujo',
  revision: 'Revisando el flujo',
};
const ORDEN_FASES: Fase[] = ['contexto', 'modelo', 'revision'];

export function CrearConIA(p: CrearConIAProps) {
  const [pedido, setPedido] = useState(p.pedidoInicial ?? '');
  const [estado, setEstado] = useState<Estado>({ t: 'quieto' });
  const [ahora, setAhora] = useState(() => Date.now());
  const ctrl = useRef<AbortController | null>(null);

  // El reloj de lo que lleva (progreso real, no decorativo). Corre sólo mientras trabaja.
  const trabajando = estado.t === 'trabajando';
  useEffect(() => {
    if (!trabajando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [trabajando]);

  // Al desmontar (cambiar de automatización, cerrar) se corta el pedido: la ruta mira la señal y
  // no guarda nada si se canceló antes de terminar.
  useEffect(() => () => ctrl.current?.abort(), []);

  const cancelar = () => {
    ctrl.current?.abort();
    ctrl.current = null;
    setEstado({ t: 'quieto' });
  };

  const enviar = async () => {
    const texto = pedido.trim();
    if (!texto || trabajando || p.deshabilitado) return;
    const c = new AbortController();
    ctrl.current = c;
    const tope = setTimeout(() => c.abort(), TOPE_CLIENTE_MS);
    setEstado({ t: 'trabajando', fase: null, leido: null, reparadas: null, desde: Date.now() });
    setAhora(Date.now());
    try {
      const res = await fetch('/api/chat-agent/secuencias/ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido: texto, secuenciaId: p.secuenciaId, modo: p.modo, ...(p.modo === 'editar' && p.pasos ? { pasos: p.pasos } : {}) }),
        signal: c.signal,
      });
      // Los errores de antes del stream (403, 400, 409) llegan como JSON plano.
      if (!res.ok || (res.headers.get('content-type') ?? '').includes('application/json')) {
        const j = await res.json().catch(() => null) as { error?: string } | null;
        setEstado({ t: 'quieto', error: j?.error || `Error ${res.status}` });
        return;
      }
      if (!res.body) { setEstado({ t: 'quieto', error: 'Sin respuesta' }); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      // Una línea NDJSON; true = el stream terminó (listo o error).
      const procesar = (line: string): boolean => {
        if (!line) return false;
        let ev: EventoIA;
        try { ev = JSON.parse(line) as EventoIA; } catch { return false; }
        if (ev.t === 'listo') {
          setEstado({ t: 'quieto' });
          if (p.modo === 'editar') setPedido('');
          p.onListo({ modo: ev.modo, secuenciaId: ev.secuenciaId, pasos: ev.pasos, nombre: ev.nombre, orden: ev.orden, avisos: ev.avisos, etiquetasNuevas: ev.etiquetasNuevas });
          return true;
        }
        if (ev.t === 'error') { setEstado({ t: 'quieto', error: ev.error || 'No se pudo' }); return true; }
        if (ev.t === 'fase') {
          setEstado((s) => (s.t !== 'trabajando' ? s : {
            ...s, fase: ev.fase,
            leido: ev.fase === 'contexto' ? ev.texto : s.leido,
            reparadas: ev.fase === 'revision' ? ev.reparadas : s.reparadas,
          }));
        }
        return false;
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (procesar(line)) return;
        }
      }
      if (procesar(buf.trim())) return;
      // El stream se cerró sin decir cómo terminó (se cortó la conexión o la función).
      setEstado({ t: 'quieto', error: 'Se cortó. Prueba de nuevo.' });
    } catch (e) {
      // Cancelar no es un error: la caja vuelve con el pedido escrito.
      if (c.signal.aborted && ctrl.current !== c) return;
      setEstado({ t: 'quieto', error: c.signal.aborted ? 'Tardó demasiado. Prueba de nuevo.' : (e instanceof Error ? e.message : String(e)) });
    } finally {
      clearTimeout(tope);
      if (ctrl.current === c) ctrl.current = null;
    }
  };

  const segundos = trabajando ? Math.max(0, Math.round((ahora - estado.desde) / 1000)) : 0;

  // ── Trabajando: las fases reales ──
  if (estado.t === 'trabajando') {
    const actual = estado.fase ? ORDEN_FASES.indexOf(estado.fase) : -1;
    return (
      <div style={p.modo === 'crear' ? S.caja : S.barraTrabajando} role="status" aria-live="polite">
        <div style={S.cabeza}>
          <span style={S.rotulo}>✦ {GRAMATICA.analizando.rotulo}</span>
          {estado.leido && <span style={S.leido}>· {estado.leido}</span>}
        </div>
        {p.modo === 'crear' && (
          <ol style={S.fases}>
            {ORDEN_FASES.map((f, i) => (
              <li key={f} style={{ ...S.fase, color: i <= actual ? 'var(--ink)' : 'var(--faint)' }}>
                <span aria-hidden style={{ ...S.punto, background: i < actual ? 'var(--good)' : i === actual ? 'var(--mako)' : 'var(--border)' }} />
                {TEXTO_FASE[f]}
                {f === 'revision' && estado.reparadas ? <span style={S.dim}> · {estado.reparadas} {estado.reparadas === 1 ? 'arreglo' : 'arreglos'}</span> : null}
              </li>
            ))}
          </ol>
        )}
        <div style={S.pie}>
          <span style={S.dim}>{segundos} s · hasta 1 min</span>
          <Button variant="tertiary" size="sm" onClick={cancelar}>Cancelar</Button>
        </div>
      </div>
    );
  }

  // ── Editar: una línea ──
  if (p.modo === 'editar') {
    return (
      <div style={S.barraWrap}>
        <form
          style={S.barra}
          onSubmit={(e) => { e.preventDefault(); void enviar(); }}
        >
          <span aria-hidden style={S.chispa}>✦</span>
          <input
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            placeholder="Pídele un cambio"
            aria-label="Pídele un cambio a MaKo"
            maxLength={2000}
            disabled={p.deshabilitado}
            style={S.input}
          />
          <Button type="submit" variant="mako" size="sm" disabled={!pedido.trim() || p.deshabilitado}>Agregar</Button>
        </form>
        {estado.error && <p style={S.error} role="alert">{estado.error}</p>}
      </div>
    );
  }

  // ── Crear: la caja centrada ──
  return (
    <form style={S.caja} onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
      <label htmlFor={`crear-ia-${p.secuenciaId}`} style={S.titulo}>✦ ¿Qué quieres que haga?</label>
      <textarea
        id={`crear-ia-${p.secuenciaId}`}
        className="mk-textarea"
        value={pedido}
        onChange={(e) => setPedido(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void enviar(); } }}
        placeholder="Ej.: bienvenida por WhatsApp y, si no agenda, un email a los 2 días"
        rows={3}
        maxLength={2000}
        disabled={p.deshabilitado}
        style={S.textarea}
      />
      {!!p.ejemplos?.length && (
        <div style={S.ejemplos}>
          {p.ejemplos.slice(0, 3).map((ej) => (
            <button key={ej} type="button" style={S.ejemplo} onClick={() => setPedido(ej)} title="Usar este pedido">
              {ej}
            </button>
          ))}
        </div>
      )}
      {estado.error && <p style={S.error} role="alert">{estado.error}</p>}
      <div style={S.pie}>
        <span style={S.dim}>Nace pausada</span>
        <Button type="submit" variant="mako" disabled={!pedido.trim() || p.deshabilitado}>Crear</Button>
      </div>
    </form>
  );
}

// Sólo tokens que existen en claro y en oscuro (app/globals.css → [data-tema="oscuro"]).
const S: Record<string, CSSProperties> = {
  caja: {
    width: 'min(520px, 100%)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12,
    padding: 18, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--mako-border)',
    boxShadow: '0 6px 24px rgba(0,0,0,.08)',
  },
  titulo: { fontSize: 16, fontWeight: 600, color: 'var(--ink)' },
  textarea: { width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 72 },
  ejemplos: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  ejemplo: {
    font: 'inherit', fontSize: 12.5, lineHeight: 1.3, textAlign: 'left', cursor: 'pointer',
    padding: '6px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--dim)',
  },
  pie: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dim: { fontSize: 12.5, color: 'var(--faint)' },
  error: { margin: 0, fontSize: 13, color: 'var(--bad)' },
  cabeza: { display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', minWidth: 0 },
  rotulo: { fontSize: 14, fontWeight: 600, color: 'var(--mako-ink)' },
  leido: { fontSize: 13, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis' },
  fases: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  fase: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 },
  punto: { width: 8, height: 8, borderRadius: 999, flex: 'none' },
  barraWrap: { display: 'flex', flexDirection: 'column', gap: 4, width: 'min(460px, 100%)' },
  barra: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 12px', borderRadius: 999,
    background: 'var(--surface)', border: '1px solid var(--mako-border)', boxShadow: '0 4px 16px rgba(0,0,0,.08)',
  },
  barraTrabajando: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 6px 6px 14px',
    borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--mako-border)', width: 'min(460px, 100%)',
    boxSizing: 'border-box',
  },
  chispa: { color: 'var(--mako-ink)', fontSize: 14, flex: 'none' },
  input: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 14, padding: '6px 0' },
};
