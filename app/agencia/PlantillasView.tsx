'use client';

// =============================================================================
// PlantillasView — las plantillas de MaKo, mostradas COMO UN CHAT
// =============================================================================
// A la izquierda, en vez de contactos, los títulos de cada plantilla (filtrables
// por categoría). A la derecha, el ejemplo renderizado como una burbuja de MaKo
// (mismo hilo que el chat real, read-only). Los ejemplos traen datos de muestra:
// el mensaje real se personaliza por caso.

import { useMemo, useState } from 'react';
import { MakoStar } from '../_components/MakoBrand';
import { ChatHilo } from '../whatsapp/_shared/ChatHilo';
import { CATALOGO_AVISOS, EMOJI_CATEGORIA, type CategoriaAviso, type AvisoCatalogo } from '@/lib/avisos-catalogo';

const ORDEN: CategoriaAviso[] = ['reporte', 'aviso', 'accion', 'pregunta'];
const LABEL: Record<CategoriaAviso, string> = { reporte: 'Reportes', aviso: 'Avisos', accion: 'Acciones', pregunta: 'Preguntas' };
const SEM_COLOR: Record<string, string> = { rojo: 'var(--bad)', amarillo: 'var(--warn)', verde: 'var(--good)', na: 'transparent' };
const IMPL: Record<string, { t: string; c: string }> = {
  si: { t: 'activo', c: 'var(--good)' }, parcial: { t: 'parcial', c: 'var(--warn)' }, no: { t: 'por venir', c: 'var(--faint)' },
};

export function PlantillasView() {
  const [filtro, setFiltro] = useState<CategoriaAviso | 'todas'>('todas');
  const lista = useMemo(() => (filtro === 'todas' ? CATALOGO_AVISOS : CATALOGO_AVISOS.filter((a) => a.categoria === filtro)), [filtro]);
  const [selId, setSelId] = useState<string>(CATALOGO_AVISOS[0]?.id ?? '');
  const sel: AvisoCatalogo | undefined = CATALOGO_AVISOS.find((a) => a.id === selId) ?? lista[0];
  const conteo = (k: CategoriaAviso | 'todas') => (k === 'todas' ? CATALOGO_AVISOS.length : CATALOGO_AVISOS.filter((a) => a.categoria === k).length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ color: 'var(--dim)', fontSize: 14, lineHeight: 1.5, margin: 0, maxWidth: 640 }}>
        Todos los mensajes que MaKo le puede mandar al dueño ({CATALOGO_AVISOS.length}). Son <b>ejemplos con datos de muestra</b> —
        el mensaje real se personaliza en cada caso. Elegí uno para ver la preview.
      </p>

      {/* Filtro por categoría */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['todas', ...ORDEN] as const).map((k) => {
          const on = filtro === k;
          return (
            <button key={k} type="button" onClick={() => setFiltro(k)}
              style={{ padding: '6px 13px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {k === 'todas' ? 'Todas' : `${EMOJI_CATEGORIA[k]} ${LABEL[k]}`} · {conteo(k)}
            </button>
          );
        })}
      </div>

      {/* "Chat": títulos a la izquierda, preview del ejemplo a la derecha */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12, height: 600 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflowY: 'auto', padding: 8 }}>
          {lista.map((a) => {
            const on = a.id === sel?.id;
            const impl = IMPL[a.yaImplementado] ?? IMPL.no;
            return (
              <button key={a.id} type="button" onClick={() => setSelId(a.id)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid ' + (on ? 'var(--border-strong)' : 'transparent'), background: on ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', marginBottom: 2 }}>
                <span style={{ fontSize: 17, flex: 'none' }}>{EMOJI_CATEGORIA[a.categoria]}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.ejemplo.replace(/[*_\n]/g, ' ').slice(0, 46)}</div>
                </div>
                {a.semaforo !== 'na' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEM_COLOR[a.semaforo], flex: 'none' }} />}
                <span style={{ flex: 'none', fontFamily: "'Geist Mono', monospace", fontSize: 8.5, letterSpacing: '.04em', textTransform: 'uppercase', color: impl.c, border: `1px solid ${impl.c}`, borderRadius: 5, padding: '1px 4px', opacity: 0.85 }}>{impl.t}</span>
              </button>
            );
          })}
        </div>

        {sel ? (
          <ChatHilo
            readOnly
            accent="var(--accent-soft)"
            accentBubble="var(--wa-noof-bubble)"
            mensajes={[{ id: sel.id, fromMe: true, texto: sel.ejemplo, fecha: null }]}
            header={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, flex: 'none', background: '#171511', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MakoStar size={16} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{sel.titulo}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{EMOJI_CATEGORIA[sel.categoria]} {LABEL[sel.categoria]}{sel.requiereRespuesta ? ' · espera respuesta' : ''} · {IMPL[sel.yaImplementado]?.t}</div>
                </div>
              </div>
            )}
          />
        ) : null}
      </div>
    </div>
  );
}
