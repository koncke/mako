'use client';

// MakoChecklistModal — el Perro Guardián optimiza una tarea, de a 1 pregunta
// (WizardShell): intro → preguntas (hay que responder o "Saltear por irrelevante") →
// CONFIRMACIÓN (vista de las respuestas) → genera → propone título + detalle +
// checklist (elegís qué aplicar). onApply recibe { titulo?, detalle?, items }.

import { useState, type CSSProperties } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { IntroBody, ChoiceBody } from './guardian-form';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const SKIP = '(salteada por irrelevante)';

type Sugerido = { texto: string; razon?: string };
type PreguntaMC = { pregunta: string; opciones: string[] };
export type CoachApply = { titulo?: string; detalle?: string; items: string[] };

async function coach(body: Record<string, unknown>): Promise<{ ok: boolean; preguntas?: PreguntaMC[]; titulo?: string; detalle?: string; items?: Sugerido[]; error?: string }> {
  return fetch('/api/checklist-coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

export function MakoChecklistModal({ title, detalle, yaOptimizada = false, onApply, onClose }: { title: string; detalle: string; yaOptimizada?: boolean; onApply: (r: CoachApply) => void; onClose: () => void }) {
  const tarea = (title + (detalle ? `\n\n${detalle}` : '')).trim();
  const [paso, setPaso] = useState(0);
  const [preguntas, setPreguntas] = useState<PreguntaMC[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [prop, setProp] = useState<{ titulo: string; detalle: string; items: Sugerido[] } | null>(null);
  const [useTit, setUseTit] = useState(false);
  const [useDet, setUseDet] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [err, setErr] = useState('');

  const N = preguntas.length;
  const enConfirm = N > 0 && paso === N + 1 && !prop;
  const enPropuesta = prop != null && paso === N + 2;

  const cargarPreguntas = async () => {
    setLoading(true); setErr('');
    const j = await coach({ action: 'ask', tarea });
    setPreguntas(j.ok && Array.isArray(j.preguntas) && j.preguntas.length ? j.preguntas : [{ pregunta: 'Cuéntame en una línea qué hace falta para dar esto por listo', opciones: [] }]);
    setLoading(false); setPaso(1);
  };
  const optimizar = async () => {
    setLoading(true); setErr('');
    const respuestas = preguntas.map((p, i) => `${p.pregunta}: ${answers[i]?.trim() || SKIP}`).join('\n');
    const j = await coach({ action: 'propose', tarea, respuestas });
    if (j.ok && (j.items?.length || j.titulo || j.detalle)) {
      const p = { titulo: j.titulo || '', detalle: j.detalle || '', items: j.items || [] };
      setProp(p); setSel(new Set(p.items.map((_, i) => i)));
      setUseTit(!!p.titulo && p.titulo.trim() !== title.trim());
      setUseDet(!!p.detalle && p.detalle.trim() !== detalle.trim());
      setPaso(N + 2);
    } else setErr(j.error || 'MaKo no devolvió nada. Prueba con más contexto.');
    setLoading(false);
  };
  const saltear = () => { setAnswers((a) => ({ ...a, [paso - 1]: SKIP })); setPaso(paso + 1); };
  const handleNext = () => {
    if (loading) return;
    if (paso === 0) void cargarPreguntas();
    else if (paso <= N) setPaso(paso + 1);   // última pregunta → confirmación (N+1)
  };
  const nApply = (useTit && prop?.titulo ? 1 : 0) + (useDet && prop?.detalle ? 1 : 0) + sel.size;
  const aplicar = () => {
    if (prop) onApply({ titulo: useTit ? prop.titulo : undefined, detalle: useDet ? prop.detalle : undefined, items: prop.items.filter((_, i) => sel.has(i)).map((x) => x.texto) });
    onClose();
  };

  const respondida = (i: number) => (answers[i]?.trim() ?? '') !== '';
  const pregunta = paso === 0 ? 'Hola, soy el Perro Guardián MaKo' : enConfirm ? '¿Mando esto a MaKo?' : enPropuesta ? 'Esto te propongo' : (preguntas[paso - 1]?.pregunta || '…');
  const total = N ? N + 3 : 3;
  const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', display: 'block', marginBottom: 5, textAlign: 'left' };
  const enUltimo = enConfirm || enPropuesta;

  return (
    <WizardShell
      titulo={`MaKo optimiza · ${title.slice(0, 36) || 'tarea'}`}
      total={total} idx={Math.min(paso, total - 1)}
      pregunta={loading ? 'MaKo está pensando…' : pregunta}
      sub={paso === 0 ? undefined : enConfirm ? 'Revisa tus respuestas antes de generar.' : enPropuesta ? 'Elige qué aplicar.' : 'Responde (o sáltala si no aplica).'}
      puedeAvanzar={enPropuesta ? nApply > 0 : enConfirm ? true : paso >= 1 && paso <= N ? respondida(paso - 1) : true}
      pending={loading}
      enUltimo={enUltimo} confirmLabel={enConfirm ? 'Generar con MaKo →' : `Aplicar ${nApply}`}
      atrasLabel={paso === 0 ? 'Cancelar' : 'Atrás'} error={err}
      onClose={onClose}
      onAtras={() => (paso === 0 ? onClose() : setPaso(Math.max(0, paso - 1)))}
      onSiguiente={handleNext}
      onConfirmar={enConfirm ? optimizar : aplicar}
    >
      {loading
        ? <div style={{ padding: '22px 0', color: 'var(--dim)', fontSize: 14 }}>{paso === 0 ? 'Leyendo la tarea…' : 'Armando la propuesta…'}</div>
        : paso === 0
          ? <><IntroBody que={`optimizar "${title.slice(0, 46) || 'esta tarea'}"`} mi="que tus tareas queden claras y ejecutables" />{yaOptimizada && <div style={{ fontSize: 12.5, color: 'var(--good)', marginTop: 12 }}>✓ Ya la optimizamos antes — puedes refinarla.</div>}</>
          : enConfirm
            ? <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {preguntas.map((p, i) => (
                  <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 3 }}>{p.pregunta}</div>
                    <div style={{ fontSize: 13.5, color: answers[i]?.trim() && answers[i] !== SKIP ? 'var(--ink)' : 'var(--faint)', fontWeight: 600, fontStyle: answers[i] === SKIP ? 'italic' : 'normal' }}>{answers[i]?.trim() || SKIP}</div>
                  </div>
                ))}
              </div>
            : enPropuesta && prop
              ? <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {prop.titulo && <button type="button" onClick={() => setUseTit((v) => !v)} style={propCard(useTit)}><Check on={useTit} /><span><span style={rowLabel}>Título mejorado</span><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{prop.titulo}</span></span></button>}
                  {prop.detalle && <button type="button" onClick={() => setUseDet((v) => !v)} style={propCard(useDet)}><Check on={useDet} /><span><span style={rowLabel}>Detalle mejorado</span><span style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>{prop.detalle}</span></span></button>}
                  {prop.items.length > 0 && <span style={{ ...rowLabel, marginTop: 8 }}>Checklist</span>}
                  {prop.items.map((it, i) => (
                    <button key={i} type="button" onClick={() => setSel((s) => { const c = new Set(s); if (c.has(i)) c.delete(i); else c.add(i); return c; })} style={propCard(sel.has(i))}>
                      <Check on={sel.has(i)} />
                      <span><span style={{ display: 'block', fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{it.texto}</span>{it.razon && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{it.razon}</span>}</span>
                    </button>
                  ))}
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ChoiceBody opciones={preguntas[paso - 1]?.opciones || []} value={answers[paso - 1] === SKIP ? '' : (answers[paso - 1] || '')} onChange={(v) => setAnswers((a) => ({ ...a, [paso - 1]: v }))} />
                  <button type="button" onClick={saltear} style={{ alignSelf: 'center', border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 12.5, cursor: 'pointer', fontFamily: SANS, textDecoration: 'underline' }}>Saltear por irrelevante →</button>
                </div>}
    </WizardShell>
  );
}

const propCard = (on: boolean): CSSProperties => ({ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', width: '100%', padding: '11px 13px', borderRadius: 11, border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', cursor: 'pointer', fontFamily: SANS });
function Check({ on }: { on: boolean }) {
  return <span style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>{on ? '✓' : ''}</span>;
}
