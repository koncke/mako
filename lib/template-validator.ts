// =============================================================================
// Validador de plantillas — estima si Meta va a aprobar o rechazar (vía Claude)
// =============================================================================
// MaKo (Claude) aplica la rúbrica de Meta (lib/meta-rules) al borrador y devuelve:
//  - riesgo ALTO/MEDIO/BAJO + categoría sugerida
//  - hallazgos: cada uno con su código de regla (para linkear a la doc de Meta),
//    el problema y la corrección concreta
//  - propuesta: una versión corregida lista para aplicar de un click
// =============================================================================

import 'server-only';
import { chatClaude } from '@/lib/anthropic';
import { META_RULES_TEXT, VALIDATOR_RUBRIC } from '@/lib/meta-rules';
import { VARIABLES_LEAD } from '@/lib/template-vars';
import type { TemplateDraft } from '@/lib/meta-templates';
import { getPromptText, renderPrompt } from '@/lib/prompt-render';

export type Hallazgo = { regla: string; problema: string; correccion: string };
export type Propuesta = {
  name?: string;
  category?: 'marketing' | 'utility' | 'authentication';
  header?: string;
  body?: string;
  footer?: string;
};
export type ValidacionResult = {
  riesgo: 'ALTO' | 'MEDIO' | 'BAJO';
  categoria_sugerida: 'utility' | 'marketing' | 'authentication';
  hallazgos: Hallazgo[];
  propuesta: Propuesta | null;
};

const VARS_DISPONIBLES = VARIABLES_LEAD.map((v) => `{{${v.key}}} (${v.descripcion})`).join(', ');

// Esqueleto editable del system. {{metaRules}} = reglas de Meta · {{rubric}} =
// rúbrica de riesgo · {{vars}} = variables del lead que la app sabe rellenar.
// (Esos tres bloques son a su vez editables como prompts propios; se inyectan acá.)
export const TEMPLATE_VALIDATOR_SYSTEM_TEMPLATE = `Eres un auditor de plantillas de mensaje de WhatsApp que PREDICE si Meta las va a APROBAR o RECHAZAR. No eres copywriter: evalúas contra las políticas antiabuso de Meta. Aplica la rúbrica al pie de la letra.

{{metaRules}}

{{rubric}}

Las únicas variables que la app sabe rellenar son: {{vars}}. Si la plantilla usa otra variable, marcalo como problema. Las variables son nombradas ({{nombre}}), nunca posicionales ({{1}}).

Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin markdown) con esta forma EXACTA:
{
  "riesgo": "ALTO" | "MEDIO" | "BAJO",
  "categoria_sugerida": "utility" | "marketing" | "authentication",
  "hallazgos": [
    { "regla": "<código de la rúbrica, ej. B1, S4, M3; o cadena vacía si es general>",
      "problema": "<qué está mal, en español, citando la regla>",
      "correccion": "<cómo arreglarlo, accionable, en español>" }
  ],
  "propuesta": {
    "name": "<nombre meta-safe sugerido o el mismo>",
    "category": "utility" | "marketing" | "authentication",
    "header": "<encabezado corregido o vacío>",
    "body": "<CUERPO corregido aplicando TODAS las correcciones, listo para usar>",
    "footer": "<pie corregido o vacío>"
  }
}
Reglas de salida:
- Si hay al menos un bloqueante, riesgo = "ALTO".
- "propuesta" es la plantilla YA corregida aplicando todas tus correcciones (mantén el sentido del mensaje y usa solo variables válidas). Si la plantilla ya está perfecta (riesgo BAJO y sin hallazgos), devuelve "propuesta": null.
- En "propuesta.body" no empieces ni termines con variable, y rodeá cada variable de texto fijo.
- Sé concreto y breve en cada problema/corrección.`;

function asStr(x: unknown): string { return typeof x === 'string' ? x : ''; }

function parseResult(raw: string): ValidacionResult {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const o = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      const riesgo = o.riesgo === 'ALTO' || o.riesgo === 'BAJO' ? o.riesgo : 'MEDIO';
      const cat = o.categoria_sugerida;
      const hallazgos: Hallazgo[] = Array.isArray(o.hallazgos)
        ? (o.hallazgos as Record<string, unknown>[]).map((h) => ({
            regla: asStr(h.regla),
            problema: asStr(h.problema),
            correccion: asStr(h.correccion),
          })).filter((h) => h.problema)
        : [];
      let propuesta: Propuesta | null = null;
      const p = o.propuesta as Record<string, unknown> | null | undefined;
      if (p && typeof p === 'object') {
        const pc = p.category;
        propuesta = {
          name: asStr(p.name) || undefined,
          category: pc === 'utility' || pc === 'authentication' || pc === 'marketing' ? pc : undefined,
          header: asStr(p.header),
          body: asStr(p.body),
          footer: asStr(p.footer),
        };
        if (!propuesta.body && !propuesta.header && !propuesta.footer) propuesta = null;
      }
      return {
        riesgo,
        categoria_sugerida: cat === 'utility' || cat === 'authentication' ? cat : 'marketing',
        hallazgos,
        propuesta,
      };
    } catch { /* fallback */ }
  }
  console.warn('[template-validator] respuesta no interpretable, fallback a MEDIO:', raw.slice(0, 200));
  return {
    riesgo: 'MEDIO',
    categoria_sugerida: 'marketing',
    hallazgos: [{ regla: '', problema: 'No se pudo validar automáticamente (respuesta no interpretable).', correccion: 'Revisa manualmente contra las reglas de Meta o reintenta.' }],
    propuesta: null,
  };
}

// {{entrada}} = el borrador de plantilla (JSON) a evaluar.
export const TEMPLATE_VALIDATOR_USER_TEMPLATE = `Evaluá esta plantilla y devolvé el JSON:\n{{entrada}}`;

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
  // Las reglas y la rúbrica también son prompts editables: se resuelven acá y se
  // inyectan en el system. La lista de variables válidas la fija el código.
  const [metaRules, rubric] = await Promise.all([
    getPromptText('meta.rules.text', META_RULES_TEXT),
    getPromptText('meta.rules.rubric', VALIDATOR_RUBRIC),
  ]);
  const system = await renderPrompt('template_validator.system', TEMPLATE_VALIDATOR_SYSTEM_TEMPLATE, {
    metaRules,
    rubric,
    vars: VARS_DISPONIBLES,
  });
  const user = await renderPrompt('template_validator.user', TEMPLATE_VALIDATOR_USER_TEMPLATE, {
    entrada: JSON.stringify(entrada, null, 2),
  });
  const raw = await chatClaude(system, [{ role: 'user', content: user }], { effort: 'high', maxTokens: 4000, feature: 'validador' });
  return parseResult(raw);
}
