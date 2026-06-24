// =============================================================================
// Validador de plantillas — estima si Meta va a aprobar o rechazar (vía Claude)
// =============================================================================
// MaKo (Claude) aplica la rúbrica de Meta (lib/meta-rules) al borrador y devuelve
// un veredicto estructurado: riesgo ALTO/MEDIO/BAJO + categoría sugerida + razones
// citables + correcciones accionables. Se usa en el editor de plantillas.
// =============================================================================

import 'server-only';
import { chatClaude } from '@/lib/anthropic';
import { META_RULES_TEXT, VALIDATOR_RUBRIC } from '@/lib/meta-rules';
import type { TemplateDraft } from '@/lib/meta-templates';

export type ValidacionResult = {
  riesgo: 'ALTO' | 'MEDIO' | 'BAJO';
  categoria_sugerida: 'utility' | 'marketing' | 'authentication';
  bloqueantes: string[];
  razones: string[];
  correcciones: string[];
};

const SYSTEM = `Sos un auditor de plantillas de mensaje de WhatsApp que PREDICE si Meta las va a APROBAR o RECHAZAR. No sos copywriter: evaluás contra las políticas antiabuso de Meta y nada más. Aplicá la rúbrica al pie de la letra.

${META_RULES_TEXT}

${VALIDATOR_RUBRIC}

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin bloques de código markdown) con esta forma EXACTA:
{
  "riesgo": "ALTO" | "MEDIO" | "BAJO",
  "categoria_sugerida": "utility" | "marketing" | "authentication",
  "bloqueantes": ["B1", "B4", ...],
  "razones": ["<en español, citando la regla concreta>", ...],
  "correcciones": ["<accionable, en español>", ...]
}
Si hay al menos un bloqueante, riesgo = "ALTO". Las razones deben citar la regla (ej. "empieza con la variable {{nombre}} (B1)"). Sé concreto y breve.`;

function parseResult(raw: string): ValidacionResult {
  // Extraer el primer objeto JSON aunque venga con texto alrededor.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(raw.slice(start, end + 1)) as Partial<ValidacionResult>;
      const riesgo = obj.riesgo === 'ALTO' || obj.riesgo === 'BAJO' ? obj.riesgo : 'MEDIO';
      const cat = obj.categoria_sugerida;
      return {
        riesgo,
        categoria_sugerida: cat === 'utility' || cat === 'authentication' ? cat : 'marketing',
        bloqueantes: Array.isArray(obj.bloqueantes) ? obj.bloqueantes.map(String) : [],
        razones: Array.isArray(obj.razones) ? obj.razones.map(String) : [],
        correcciones: Array.isArray(obj.correcciones) ? obj.correcciones.map(String) : [],
      };
    } catch { /* cae al fallback */ }
  }
  console.warn('[template-validator] respuesta no interpretable, fallback a MEDIO:', raw.slice(0, 200));
  return {
    riesgo: 'MEDIO',
    categoria_sugerida: 'marketing',
    bloqueantes: [],
    razones: ['No se pudo validar automáticamente (respuesta no interpretable). Revisá manualmente contra las reglas.'],
    correcciones: [],
  };
}

export async function validarPlantilla(draft: TemplateDraft): Promise<ValidacionResult> {
  const entrada = {
    name: draft.name,
    category: draft.category,
    language: draft.language,
    header: draft.header || null,
    body: draft.body,
    footer: draft.footer || null,
    buttons: draft.buttons,
    variables: draft.params.map((p) => ({ nombre: p.name, ejemplo: p.example })),
  };
  const raw = await chatClaude(
    SYSTEM,
    [{ role: 'user', content: `Evaluá esta plantilla y devolvé el JSON:\n${JSON.stringify(entrada, null, 2)}` }],
    { effort: 'high', maxTokens: 4000 },
  );
  return parseResult(raw);
}
