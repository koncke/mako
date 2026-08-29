'use client';

// =============================================================================
// ModelosIA — SuperAdmin: qué modelo/IA usa cada tarea (config-driven, editable)
// =============================================================================
// Lista las tareas de IA de la app con su modelo actual + la recomendación del
// audit, y deja cambiar el modelo/IA de cada una. El cambio re-rutea las llamadas
// de verdad (lo lee chatClaude/chatCheap en runtime). Groq = barato y no entrena.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Dropdown, type DropdownOption } from '../components/Dropdown';

type Ref = { provider: 'anthropic' | 'groq' | 'openai' | 'gemini'; model: string };
type Item = { feature: string; label: string; grupo: string; def: Ref; recomendado?: Ref; pii?: boolean; nota?: string; actual: Ref; overrideado: boolean };

const MONO = "'Geist Mono', monospace";
const PROV_LABEL: Record<string, string> = { anthropic: 'Claude', groq: 'Groq', openai: 'OpenAI', gemini: 'Gemini' };
const refKey = (r: Ref) => `${r.provider}|${r.model}`;
const nombreCorto = (r: Ref) => `${PROV_LABEL[r.provider] ?? r.provider} · ${r.model.replace(/^openai\//, '').replace('claude-', '').replace('gemini-', '').replace('-versatile', '')}`;

const CHAT_OPTS: DropdownOption[] = [
  { value: 'anthropic|claude-opus-4-8', label: 'Claude Opus 4.8', sub: 'máximo razonamiento / voz de marca' },
  { value: 'anthropic|claude-sonnet-5', label: 'Claude Sonnet 5', sub: 'intermedio: casi Opus, bastante más barato' },
  { value: 'anthropic|claude-sonnet-4-6', label: 'Claude Sonnet 4.6', sub: 'Claude intermedio (previo)' },
  { value: 'anthropic|claude-haiku-4-5', label: 'Claude Haiku 4.5', sub: 'Claude, el más barato' },
  { value: 'groq|openai/gpt-oss-20b', label: 'Groq · gpt-oss-20b', sub: 'barato, rápido, no entrena' },
  { value: 'groq|openai/gpt-oss-120b', label: 'Groq · gpt-oss-120b', sub: 'barato con más cabeza' },
  { value: 'groq|llama-3.3-70b-versatile', label: 'Groq · Llama 3.3 70B', sub: 'barato' },
  { value: 'openai|gpt-4o-mini', label: 'OpenAI · gpt-4o-mini', sub: 'barato' },
  { value: 'openai|gpt-5-mini', label: 'OpenAI · gpt-5-mini', sub: 'OpenAI intermedio, barato' },
  { value: 'openai|gpt-4o', label: 'OpenAI · gpt-4o', sub: 'OpenAI, con visión' },
  { value: 'gemini|gemini-flash-latest', label: 'Gemini · Flash', sub: '1M contexto · gratis con tu key (el free entrena)' },
  { value: 'gemini|gemini-flash-lite-latest', label: 'Gemini · Flash-Lite', sub: 'el más barato/rápido de Google' },
];
const STT_OPTS: DropdownOption[] = [
  { value: 'groq|whisper-large-v3-turbo', label: 'Groq · Whisper v3 turbo', sub: 'STT barato' },
  { value: 'groq|whisper-large-v3', label: 'Groq · Whisper v3', sub: 'STT, más preciso' },
  { value: 'openai|whisper-1', label: 'OpenAI · Whisper-1', sub: 'STT' },
];

export function ModelosIA() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const j = await fetch('/api/admin/modelos').then((r) => r.json()).catch(() => null);
    if (j?.ok) setItems(j.modelos as Item[]);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (feature: string, ref: Ref | null) => {
    setBusy(feature);
    try {
      const body = ref ? { feature, provider: ref.provider, model: ref.model } : { feature, reset: true };
      const j = await fetch('/api/admin/modelos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
      if (j?.ok) setItems(j.modelos as Item[]);
    } finally { setBusy(null); }
  };

  const grupos = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of items ?? []) { const a = m.get(it.grupo) ?? []; a.push(it); m.set(it.grupo, a); }
    return [...m.entries()];
  }, [items]);

  const ahorro = (items ?? []).filter((i) => i.recomendado && i.recomendado.provider !== 'anthropic' && i.actual.provider === 'anthropic').length;

  const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 60px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Modelos de IA por tarea</h1>
        <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '6px 0 0', lineHeight: 1.5 }}>
          Elige qué modelo/IA usa cada tarea. Cambiarlo aquí re-rutea las llamadas de verdad. <b>Groq</b> es barato y no entrena con tus datos; deja <b>Claude</b> para razonamiento fino, copywriting con voz de marca y datos de clientes (PII).
          {ahorro > 0 && <> Hay <b style={{ color: 'var(--good)' }}>{ahorro} tarea{ahorro > 1 ? 's' : ''}</b> que el audit sugiere mover a Groq.</>}
        </p>
      </div>

      {items === null && <div style={{ color: 'var(--faint)', fontSize: 13 }}>Cargando…</div>}

      {grupos.map(([grupo, its]) => (
        <div key={grupo} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>{grupo}</span>
          {its.map((it) => {
            const opts = it.grupo === 'STT' ? STT_OPTS : CHAT_OPTS;
            const rec = it.recomendado && it.recomendado.provider !== 'anthropic' && it.actual.provider === 'anthropic';
            return (
              <div key={it.feature} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{it.label}</span>
                    {it.pii && <span title="Lleva datos de clientes (PII)" style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--warn)', border: '1px solid var(--warn)', borderRadius: 5, padding: '0 5px' }}>PII</span>}
                    {it.overrideado && <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--primary)' }}>editado</span>}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{it.feature}{it.nota ? ` · ${it.nota}` : ''}</div>
                  {rec && <div style={{ fontSize: 11.5, color: 'var(--good)', marginTop: 4 }}>💡 el audit sugiere <b>{nombreCorto(it.recomendado!)}</b> · <button onClick={() => guardar(it.feature, it.recomendado!)} disabled={busy === it.feature} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>aplicar</button></div>}
                </div>
                <div style={{ minWidth: 220, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, opacity: busy === it.feature ? 0.5 : 1 }}>
                    <Dropdown value={refKey(it.actual)} options={opts} onChange={(v) => { const [provider, ...rest] = v.split('|'); guardar(it.feature, { provider: provider as Ref['provider'], model: rest.join('|') }); }} placeholder="Elegir modelo…" />
                  </div>
                  {it.overrideado && <button onClick={() => guardar(it.feature, null)} disabled={busy === it.feature} title="Volver al default" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--faint)', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>↺ default</button>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
