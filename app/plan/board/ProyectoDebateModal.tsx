'use client';

// ProyectoDebateModal — cambiar la prioridad (1-10) de un PROYECTO pasa por el Perro
// Guardián (feedback: no editar la prioridad a mano). intro → target 1-10 → ¿por qué?
// → el perro decide (acepta/ajusta/rechaza) comparando contra los demás proyectos.

import { useState, type CSSProperties } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { GuardianIcon } from './GuardianIcon';
import { ScoreIcon, textareaStyle } from './guardian-form';
import { type Label } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

async function debate(body: Record<string, unknown>): Promise<{ ok: boolean; veredicto?: string; score?: number; razon?: string; respuesta?: string; usage?: unknown; error?: string }> {
  return fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'debatir-proyecto', ...body }) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

export function ProyectoDebateModal({ proj, otrosProyectos, onApply, onUsage, onClose }: {
  proj: Label; otrosProyectos: string;
  onApply: (score: number, razon: string) => void; onUsage?: (u: unknown) => void; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [newScore, setNewScore] = useState(proj.score);
  const [porque, setPorque] = useState('');
  const [fase, setFase] = useState<'form' | 'puntuando' | 'veredicto'>('form');
  const [ver, setVer] = useState<{ veredicto: string; score: number; razon: string; respuesta: string } | null>(null);
  const [err, setErr] = useState('');

  const enviar = async () => {
    setFase('puntuando'); setErr('');
    const proyecto = `${proj.emoji} ${proj.name}${proj.detalle ? `\n\n${proj.detalle}` : ''}`;
    const argumento = `El usuario quiere llevar la prioridad de ${proj.score} a ${newScore} (de 10). Motivo: ${porque.trim()}`;
    const j = await debate({ proyecto, scoreActual: proj.score, argumento, plan: otrosProyectos });
    if (j.usage) onUsage?.(j.usage);
    if (j.ok && typeof j.score === 'number') { setVer({ veredicto: String(j.veredicto ?? 'ajusta'), score: j.score, razon: j.razon ?? '', respuesta: j.respuesta ?? '' }); setFase('veredicto'); }
    else { setErr(j.error || 'MaKo no pudo responder ahora.'); setFase('form'); }
  };
  const aceptar = () => { if (ver) onApply(ver.score, ver.razon); onClose(); };

  if (fase !== 'form') {
    const vk = ver?.veredicto ?? '';
    const vMeta = vk === 'acepta' ? { txt: 'El Perro Guardián te dio la razón', c: 'var(--good)', bg: 'var(--good-bg)' }
      : vk === 'rechaza' ? { txt: 'El Perro Guardián RECHAZÓ tu pedido', c: 'var(--bad)', bg: 'var(--bad-bg)' }
        : { txt: 'El Perro Guardián lo ajustó', c: 'var(--warn)', bg: 'var(--surface-2)' };
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: '26px 26px 8px', textAlign: 'center' }}>
          {fase === 'puntuando'
            ? <div style={{ padding: '30px 0', color: 'var(--dim)', fontSize: 14 }}>El Perro Guardián está evaluando el proyecto…</div>
            : ver && <>
                <GuardianIcon size={56} />
                <div style={{ fontSize: 13, fontWeight: 800, color: vMeta.c, textTransform: 'uppercase', letterSpacing: '.04em', margin: '12px 0 10px' }}>{vMeta.txt}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontWeight: 700, fontSize: 13, color: proj.color }}><ScoreIcon size={13} color={proj.color} />{proj.score}</span>
                  <span style={{ color: 'var(--faint)' }}>→</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontWeight: 700, fontSize: 17, color: proj.color }}><ScoreIcon size={16} color={proj.color} />{ver.score}/10</span>
                  {ver.score === proj.score && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>(sin cambios)</span>}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, textAlign: 'left', background: vMeta.bg, border: `1px solid ${vMeta.c}55`, borderRadius: 12, padding: '13px 15px' }}>{ver.respuesta}</div>
              </>}
        </div>
        {fase === 'veredicto' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button type="button" onClick={() => { setVer(null); setFase('form'); setIdx(1); }} style={ghostBtn}>Volver a intentar</button>
            <button type="button" onClick={aceptar} style={primaryBtn}>Aceptar veredicto</button>
          </div>
        )}
      </Shell>
    );
  }

  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿Qué prioridad le pondrías?', '¿Por qué? Contame tu razón'];
  const subs: (string | undefined)[] = [undefined, `Hoy está en ${proj.score}/10. 10 = el Objetivo Principal (solo uno).`, 'Con datos, no "me gusta". Yo comparo contra los demás proyectos y decido.'];
  const puedeAvanzar = idx === 0 ? true : idx === 1 ? newScore !== proj.score : porque.trim() !== '';

  return (
    <WizardShell
      titulo={`Prioridad · ${proj.name.slice(0, 32)}`}
      total={3} idx={idx}
      pregunta={preguntas[idx]} sub={subs[idx]}
      puedeAvanzar={puedeAvanzar}
      enUltimo={idx === 2} confirmLabel="Que el Guardián decida →"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'} error={err}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={() => setIdx(idx + 1)}
      onConfirmar={enviar}
    >
      {idx === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <GuardianIcon size={64} />
          <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: 0, maxWidth: 430 }}>
            Mi trabajo es <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>cuidar cuál es el norte del negocio</strong>. Subir un proyecto significa que otro deja de serlo. Si tu argumento no se sostiene, te lo voy a decir.
          </p>
        </div>
      )}
      {idx === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 34, fontWeight: 800, color: proj.color }}><ScoreIcon size={30} color={proj.color} />{newScore}<span style={{ fontSize: 20, color: 'var(--faint)' }}>/10</span></span>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>{newScore === proj.score ? 'sin cambios' : newScore > proj.score ? 'más arriba' : 'más abajo'}{newScore === 10 ? ' · sería el Objetivo Principal' : ''}</div>
          </div>
          <input type="range" min={1} max={10} step={1} value={newScore} onChange={(e) => setNewScore(Number(e.target.value))} style={{ width: '100%', accentColor: proj.color }} />
        </div>
      )}
      {idx === 2 && <textarea value={porque} onChange={(e) => setPorque(e.target.value)} autoFocus placeholder="Ej: es de donde sale toda la facturación, sin esto no crece nada…" style={{ ...textareaStyle }} />}
    </WizardShell>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

const primaryBtn: CSSProperties = { padding: '11px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
