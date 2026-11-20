import 'server-only';
// =============================================================================
// Manda el correo que promete «Sigamos en tu computadora» (20/11/2026; los textos en lib/onboarding-v2/correo-pc.ts)
// =============================================================================
// ⚠️ APARTE de lib/seguir-en-pc.ts: ése lo importa el layout raíz (es el módulo CHICO), y el envío arrastra el correo de la plataforma.
//
// Una vez por persona: lo marca `CLAVE_CORREO_PC` (y Resend deduplica por `idempotencyKey`). Sólo a la persona en SU cuenta: mirando un
// negocio como administrador, nunca (le llegaría al cliente lo que hizo otro). Sólo con el V2. Nunca tira: un correo que no salió deja
// la pantalla igual (la persona entra con su cuenta en la computadora).
// =============================================================================

import { personaDelOnboarding } from './seguir-en-pc';
import { veOnboardingV2 } from './onboarding-v2/revision';
import { getSettingEstricto, setSetting } from './settings';
import { linkApp } from './app-url';
import { avisarDePlataforma } from './invitaciones';
import { primerNombre } from './onboarding-arranque';
import { leerEstadoArranque } from './onboarding-arranque-server';
import { CLAVE_CORREO_PC, RUTA_DEL_CORREO_PC, correoSeguirEnPc } from './onboarding-v2/correo-pc';

export async function mandarCorreoSeguirEnPc(): Promise<{ enviado: boolean; motivo?: string }> {
  try {
    const p = await personaDelOnboarding();
    if (!p || p.ws == null) return { enviado: false, motivo: 'sin persona' };
    if (p.mirando) return { enviado: false, motivo: 'mirando como administrador' };
    if (!veOnboardingV2({ email: p.email, ws: p.ws })) return { enviado: false, motivo: 'sin el V2' };
    // «No pude leer» no es «no lo mandé»: sin saberlo, no se manda (un correo de más a un cliente es peor que uno de menos).
    let ya: string | null;
    try { ya = await getSettingEstricto(CLAVE_CORREO_PC); } catch { return { enviado: false, motivo: 'no pude leer si ya se mandó' }; }
    if (ya && (JSON.parse(ya) as { a?: string }).a === p.email) return { enviado: false, motivo: 'ya se mandó' };
    const nombre = primerNombre((await leerEstadoArranque().catch(() => null))?.nombre ?? '');
    const c = correoSeguirEnPc(nombre, linkApp(RUTA_DEL_CORREO_PC, p.ws));
    const r = await avisarDePlataforma({
      to: p.email, tag: 'onboarding-seguir-en-pc', asunto: c.asunto, preheader: c.preheader, cuerpo: c.cuerpo,
      idempotencyKey: `seguir-en-pc-${p.ws}-${p.email}`,
    });
    if (!r.enviado) {
      console.warn(`[onboarding] no salió el correo de «Sigamos en tu computadora» (ws ${p.ws}): ${r.error ?? 'sin detalle'}`);
      return { enviado: false, motivo: r.error ?? 'no salió' };
    }
    await setSetting(CLAVE_CORREO_PC, JSON.stringify({ a: p.email, at: new Date().toISOString() })).catch(() => {});
    return { enviado: true };
  } catch (e) {
    console.warn('[onboarding] el correo de «Sigamos en tu computadora»:', e instanceof Error ? e.message : e);
    return { enviado: false, motivo: 'error' };
  }
}
