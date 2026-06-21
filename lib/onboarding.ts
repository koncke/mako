// =============================================================================
// onboarding — perfil del negocio del cliente (campos editables + respuestas)
// =============================================================================
// El ESQUEMA del formulario (grupos y campos) se edita sin migrar la base, y las
// respuestas se guardan flexibles. Todo en app_settings como JSON. El perfil
// alimenta el contexto de MaKo (aditivo: campo vacío → no se inyecta).

import 'server-only';
import { getSetting, setSetting } from './settings';

export type FieldType = 'text' | 'number' | 'textarea';
export type Field = { key: string; label: string; type: FieldType; placeholder?: string };
export type Group = { key: string; label: string; fields: Field[] };

export const DEFAULT_SCHEMA: Group[] = [
  { key: 'oferta', label: 'Oferta', fields: [
    { key: 'oferta_nombre', label: 'Nombre de la oferta', type: 'text', placeholder: 'Negocio que Escala™' },
    { key: 'oferta_ticket', label: 'Precio / ticket (USD)', type: 'number', placeholder: '5000' },
    { key: 'oferta_promesa', label: 'Promesa principal', type: 'textarea', placeholder: 'De cuello de botella a dueño que escala' },
  ] },
  { key: 'funnel', label: 'Funnel', fields: [
    { key: 'funnel_etapas', label: 'Etapas', type: 'textarea', placeholder: 'Meta Lead Ads → VSL → Calendly → llamada de ventas' },
    { key: 'funnel_fuente', label: 'Fuente principal de tráfico', type: 'text', placeholder: 'Meta Lead Ads' },
  ] },
  { key: 'avatar', label: 'Avatar', fields: [
    { key: 'avatar_dolor', label: 'Dolor principal', type: 'textarea', placeholder: 'Factura pero sigue siendo el cuello de botella de todo' },
    { key: 'avatar_objecion', label: 'Objeción más común', type: 'text', placeholder: 'No tengo tiempo / ya probé otras cosas' },
  ] },
  { key: 'negocio', label: 'Negocio', fields: [
    { key: 'negocio_nicho', label: 'Nicho / industria', type: 'text', placeholder: 'Consultoría / coaching B2B' },
    { key: 'negocio_ticket_prom', label: 'Ticket promedio (USD)', type: 'number', placeholder: '5000' },
  ] },
];

const SCHEMA_KEY = 'mako.onboarding.schema';
const ANSWERS_KEY = 'mako.onboarding.answers';

export async function getSchema(): Promise<Group[]> {
  const raw = await getSetting(SCHEMA_KEY);
  if (!raw) return DEFAULT_SCHEMA;
  try { const p = JSON.parse(raw); return Array.isArray(p) ? (p as Group[]) : DEFAULT_SCHEMA; } catch { return DEFAULT_SCHEMA; }
}
export async function saveSchema(schema: Group[]): Promise<void> {
  await setSetting(SCHEMA_KEY, JSON.stringify(schema));
}
export async function getAnswers(): Promise<Record<string, string>> {
  const raw = await getSetting(ANSWERS_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
}
export async function saveAnswers(answers: Record<string, string>): Promise<void> {
  await setSetting(ANSWERS_KEY, JSON.stringify(answers));
}

/** Texto del perfil del negocio para inyectar en el contexto de MaKo. */
export async function perfilNegocioTexto(): Promise<string> {
  const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
  const lines: string[] = [];
  for (const g of schema) {
    const fs = g.fields
      .map((f) => { const v = (answers[f.key] ?? '').trim(); return v ? `${f.label}: ${v}` : ''; })
      .filter(Boolean);
    if (fs.length) lines.push(`${g.label} — ${fs.join(' · ')}`);
  }
  return lines.join('\n');
}
