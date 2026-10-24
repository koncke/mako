// =============================================================================
// Con qué IA corre UN chat: las cuentas que la persona puede elegir, y lo que eligió, validado (8b, 23/10/2026)
// =============================================================================
// Martín: «En el Ops Center, el "+" de la caja deja elegir con qué corre ese chat: el modelo y la cuenta (Claude o GPT, y cuál).
// Por defecto decide el chat jefe, salvo que se elija otro». El selector (Ops Center: lib/chat-ia-reglas.ts, la caja) lee las
// cuentas de GET /api/mako/chat?suIA=1 y manda `ia` con el mensaje; acá se arman esas cuentas y se valida lo que llega:
//   · pc: la computadora de ESTA persona (`pcDe`), nunca la de otro (la cuenta de Claude es de una persona, §10);
//   · anthropic: SU clave de Claude por la puerta 2 (`permisoDeLaClaveDelNegocio`): con el crédito de MaKo, sólo Haiku;
//   · openai: SU clave de OpenAI (`provsDe`: las copias de la plataforma no cuentan).
// Nunca sale de D6b ni ofrece la IA de la plataforma, y en el workspace del super admin no se elige nada (contesta la suya).
// Lo que no está en la lista que se le mostraría a la persona AHORA es Automático (null): el navegador no elige por su cuenta.
// =============================================================================

import 'server-only';
import { pcDe } from '@/lib/ia-pc';
import { CLAVE_MODELO_PC, MODELOS_PC, cuentasDeLaIA, modeloPc } from '@/lib/ia-pc-reglas';
import { permisoDeLaClaveDelNegocio } from '@/lib/anthropic';
import { provsDe } from '@/lib/ai-cheap';
import { getSetting } from '@/lib/settings';
import { runWithWorkspace, wsSuperAdmin } from '@/lib/workspace';
import { MODELO_SU_CLAUDE } from '@/lib/veto-claude';
import {
  MODELOS_SU_CLAUDE, MODELOS_SU_OPENAI, MODELO_SU_OPENAI_DEFAULT, eleccionVigente, sanearIA, type CuentaDeIA, type EleccionIA,
} from '@/lib/chat-ia-reglas';

/** La feature del turno del chat (lib/mako-turno-app.ts → FEATURE): la puerta 2 decide con ella. */
const FEATURE_DEL_CHAT = 'mako-doer';

/** Las cuentas que ESTA persona puede elegir en ESTE negocio, en el orden en que se ofrecen. Lo que no se puede leer, no se ofrece. */
export async function cuentasDeIA(persona: { ws: number; actor: string; rol?: 'admin' | 'miembro' }): Promise<CuentaDeIA[]> {
  if (persona.ws === (await wsSuperAdmin())) return [];
  return runWithWorkspace(persona.ws, async () => {
    const out: CuentaDeIA[] = [];
    const pc = await pcDe(persona.ws, persona.actor).catch(() => null);
    if (pc) {
      const modeloDefault = modeloPc(await getSetting(CLAVE_MODELO_PC).catch(() => null));
      out.push({ cuenta: 'pc', nombre: `Tu computadora (${pc.nombre})`, modelos: MODELOS_PC, modeloDefault });
    }
    // Su ChatGPT en su computadora (la ola 3, Codex): sólo si una PC suya reporta una cuenta de ChatGPT. El programa hasta la
    // 0.4.2 reporta sólo las de Claude, así que hoy no aparece. Sin lista de modelos: Codex usa el suyo.
    const pcGpt = await pcDe(persona.ws, persona.actor, 'chatgpt').catch(() => null);
    if (pcGpt && cuentasDeLaIA(pcGpt.cuentas, 'chatgpt').length) {
      out.push({ cuenta: 'pc-chatgpt', nombre: `Tu computadora · ChatGPT (${pcGpt.nombre})`, modelos: [], modeloDefault: null });
    }
    const suClaude = await permisoDeLaClaveDelNegocio(FEATURE_DEL_CHAT).catch(() => null);
    if (suClaude && 'permiso' in suClaude) {
      // El crédito de Claude de MaKo (el ws10, el asignado al ws1) va con Haiku, se elija lo que se elija: lo paga Martín. Y el
      // modelo de la clave PAGA del negocio lo elige el ADMIN (revisión del selector, 23/10/2026: la ruta del modelo le contesta
      // 403 a un miembro, y el selector le abría la misma decisión por otra puerta): a un miembro, sin elegir (corre el del admin).
      const soloHaiku = !!suClaude.permiso.esCredito;
      out.push({
        cuenta: 'anthropic', nombre: 'Tu Claude', modelos: soloHaiku ? ['haiku'] : persona.rol === 'admin' ? MODELOS_SU_CLAUDE : [],
        modeloDefault: suClaude.permiso.model === MODELO_SU_CLAUDE.sonnet ? 'sonnet' : 'haiku', ...(soloHaiku ? { soloHaiku: true } : {}),
      });
    }
    // Su ChatGPT: el modelo lo elige el ADMIN, como el de su Claude, y un miembro corre el de por defecto, que es uno que sabe
    // orquestar herramientas (hasta el 23/10/2026 era siempre `gpt-4o-mini`; el porqué, en `MODELOS_SU_OPENAI`). A diferencia
    // de su Claude, no hay un modelo GUARDADO por negocio: el admin lo elige en cada chat, y en Automático corre `gpt-4o-mini`
    // hasta que se mida (docs/hallazgos-ia.md).
    const suOpenAI = await provsDe('openai').catch(() => []);
    if (suOpenAI.length) {
      out.push({
        cuenta: 'openai', nombre: 'Tu ChatGPT', modelos: persona.rol === 'admin' ? MODELOS_SU_OPENAI : [], modeloDefault: MODELO_SU_OPENAI_DEFAULT,
      });
    }
    return out;
  });
}

/**
 * Lo que eligió la persona para el mensaje, si se puede: saneado (`sanearIA`) y DENTRO de las cuentas que se le ofrecerían
 * ahora (`eleccionVigente`: una cuenta que ya no está es Automático, y un modelo que esa cuenta no acepta se cae). Sin nada
 * elegido, null sin leer nada.
 */
export async function eleccionDelPedido(persona: { ws: number; actor: string; rol?: 'admin' | 'miembro' }, crudo: unknown): Promise<EleccionIA> {
  const e = sanearIA(crudo);
  if (!e) return null;
  return eleccionVigente(e, await cuentasDeIA(persona).catch(() => []));
}
