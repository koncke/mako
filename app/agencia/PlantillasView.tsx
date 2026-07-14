'use client';

// =============================================================================
// PlantillasView — las plantillas de MaKo, mostradas COMO EL CHAT (interactivo)
// =============================================================================
// Mismo layout/ancho que el chat: a la izquierda buscador + filtro (desplegable)
// + los títulos (con avatar del emoji, como contactos); a la derecha, el ejemplo
// se "escribe" solo. Si el aviso pide respuesta, simula la respuesta del dueño y
// la réplica de MaKo. La topbar (o el botón editar) abre el detalle editable.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown } from '../components/Dropdown';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { TemplateDetalleModal } from './TemplateDetalleModal';
import { CATALOGO_AVISOS, EMOJI_CATEGORIA, type CategoriaAviso, type AvisoCatalogo } from '@/lib/avisos-catalogo';

const ORDEN: CategoriaAviso[] = ['reporte', 'aviso', 'accion', 'pregunta'];
const LABEL: Record<CategoriaAviso, string> = { reporte: 'Reportes', aviso: 'Avisos', accion: 'Acciones', pregunta: 'Preguntas' };
const SEM_COLOR: Record<string, string> = { rojo: 'var(--bad)', amarillo: 'var(--warn)', verde: 'var(--good)', na: 'transparent' };
const IMPL: Record<string, { t: string; c: string }> = { si: { t: 'activo', c: 'var(--good)' }, parcial: { t: 'parcial', c: 'var(--warn)' }, no: { t: 'por venir', c: 'var(--faint)' } };

const respuestaDueno = (a: AvisoCatalogo) => (a.categoria === 'accion' ? 'Sí, dale 👍' : a.categoria === 'pregunta' ? 'Dale, pasámelo' : '👍');
const replicaMaKo = (a: AvisoCatalogo) => (a.categoria === 'accion' ? '✅ Listo, lo hago ahora y te confirmo cuando esté. — MaKo' : 'Genial, te lo preparo y te lo paso en un rato. 🙌 — MaKo');

type Paso = { t: 'typing'; lado: 'left' | 'right'; autor?: string } | { t: 'msg'; msg: HiloMsg };
function guion(a: AvisoCatalogo): Paso[] {
  const g: Paso[] = [
    { t: 'typing', lado: 'left', autor: 'MaKo' },
    { t: 'msg', msg: { id: `${a.id}-1`, fromMe: false, autor: 'MaKo', texto: a.ejemplo, fecha: new Date().toISOString() } },
  ];
  if (a.requiereRespuesta) {
    g.push({ t: 'typing', lado: 'right' });
    g.push({ t: 'msg', msg: { id: `${a.id}-2`, fromMe: true, texto: respuestaDueno(a), fecha: new Date().toISOString() } });
    g.push({ t: 'typing', lado: 'left', autor: 'MaKo' });
    g.push({ t: 'msg', msg: { id: `${a.id}-3`, fromMe: false, autor: 'MaKo', texto: replicaMaKo(a), fecha: new Date().toISOString() } });
  }
  return g;
}

export function PlantillasView() {
  const [filtro, setFiltro] = useState<CategoriaAviso | 'todas'>('todas');
  const [busq, setBusq] = useState('');
  const [selId, setSelId] = useState<string>(CATALOGO_AVISOS[0]?.id ?? '');
  const [mensajes, setMensajes] = useState<HiloMsg[]>([]);
  const [typing, setTyping] = useState<{ lado: 'left' | 'right'; autor?: string } | null>(null);
  const [detalle, setDetalle] = useState<AvisoCatalogo | null>(null);

  const lista = useMemo(() => {
    const q = busq.trim().toLowerCase();
    return CATALOGO_AVISOS.filter((a) => {
      if (filtro !== 'todas' && a.categoria !== filtro) return false;
      if (q && !(a.titulo.toLowerCase().includes(q) || a.ejemplo.toLowerCase().includes(q) || a.disparador.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [filtro, busq]);
  const sel: AvisoCatalogo | undefined = CATALOGO_AVISOS.find((a) => a.id === selId);
  const conteo = (k: CategoriaAviso | 'todas') => (k === 'todas' ? CATALOGO_AVISOS.length : CATALOGO_AVISOS.filter((a) => a.categoria === k).length);

  // Animación del ejemplo: "escribiendo…" (corto) → mensaje (y respuesta si aplica).
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setMensajes([]); setTyping(null);
    if (!sel) return;
    const pasos = guion(sel);
    const acumulados: HiloMsg[] = [];
    let acc = 150;
    for (const p of pasos) {
      if (p.t === 'typing') { timers.current.push(setTimeout(() => setTyping({ lado: p.lado, autor: p.autor }), acc)); acc += 500; }
      else { acumulados.push(p.msg); const snap = [...acumulados]; timers.current.push(setTimeout(() => { setTyping(null); setMensajes(snap); }, acc)); acc += 250; }
    }
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [selId, sel]);

  // Detalle/edición del template: cubre TODO (inline), con botón para volver.
  if (detalle) return <TemplateDetalleModal aviso={detalle} onClose={() => setDetalle(null)} />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12, height: 620 }}>
      {/* Columna de "contactos" = títulos, con buscador + filtro arriba */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar por título o texto…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13.5, outline: 'none' }} />
          <div style={{ marginTop: 10 }}>
            <Dropdown value={filtro} onChange={(v) => setFiltro(v as CategoriaAviso | 'todas')} width={172} ariaLabel="Filtrar por categoría"
              buttonStyle={{ padding: '8px 11px', fontSize: 13 }}
              options={[{ value: 'todas', label: `Todas · ${conteo('todas')}` }, ...ORDEN.map((k) => ({ value: k, label: `${EMOJI_CATEGORIA[k]} ${LABEL[k]} · ${conteo(k)}` }))]} />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
          {lista.length === 0 && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13 }}>Ninguna plantilla coincide.</div>}
          {lista.map((a) => {
            const on = a.id === selId;
            const impl = IMPL[a.yaImplementado] ?? IMPL.no;
            return (
              <button key={a.id} type="button" onClick={() => setSelId(a.id)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid ' + (on ? 'var(--border-strong)' : 'transparent'), background: on ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', marginBottom: 2 }}>
                <span style={{ width: 40, height: 40, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{EMOJI_CATEGORIA[a.categoria]}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.ejemplo.replace(/[*_\n]/g, ' ').slice(0, 40)}</div>
                </div>
                {a.semaforo !== 'na' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEM_COLOR[a.semaforo], flex: 'none' }} />}
                <span style={{ flex: 'none', fontFamily: "'Geist Mono', monospace", fontSize: 8.5, letterSpacing: '.04em', textTransform: 'uppercase', color: impl.c, border: `1px solid ${impl.c}`, borderRadius: 5, padding: '1px 4px', opacity: 0.85 }}>{impl.t}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview interactiva (topbar abre el detalle editable) */}
      {sel ? (
        <ChatHilo
          readOnly
          accent="var(--accent-soft)"
          accentBubble="var(--wa-noof-bubble)"
          mensajes={mensajes}
          typing={typing}
          header={(
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <button type="button" onClick={() => setDetalle(sel)} title="Ver detalle / editar" style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{EMOJI_CATEGORIA[sel.categoria]}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.titulo}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{EMOJI_CATEGORIA[sel.categoria]} {LABEL[sel.categoria]}{sel.requiereRespuesta ? ' · espera respuesta' : ''} · toca para ver/editar</div>
                </div>
              </button>
              <button type="button" onClick={() => setDetalle(sel)} title="Editar plantilla"
                style={{ flex: 'none', padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Editar</button>
            </div>
          )}
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 14 }}>Elegí una plantilla.</div>
      )}
    </div>
  );
}
