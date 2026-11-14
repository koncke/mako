import 'server-only';
// =============================================================================
// El aviso AL SETTER de un lead: un push a SU teléfono y un WhatsApp a SU número (14/11/2026)
// =============================================================================
// Las reglas (quién es el setter, el texto) están en lib/aviso-al-setter-reglas.ts, con test. Lo llaman el aviso de una
// automatización sobre un lead (`avisar_al_equipo` desde un flujo: «Sólo te avisa» y el hand-off de «Otra cosa» del AI Step)
// y el aviso de respaldo del AI Step (lib/nutricion.ts). Va DESPUÉS del aviso al grupo, que no cambia.
//
//   · El push, por `enviarPushAMiembros` con el tag del grupo del negocio (`grupo:<ws>`): si al setter también le sonó el
//     del grupo (es del equipo, lib/grupo-app.ts `avisarMiembros`), éste lo REEMPLAZA en su teléfono en vez de apilarse, y
//     al tocarlo abre la ficha del lead.
//   · El WhatsApp, SÓLO por la puerta de MaKo (`enviarAlChat`, lib/mako-salida.ts): la regla de la casa es que nada nuevo
//     le escribe a una persona por fuera de ahí (el …2605 ya fue baneado). La puerta lo deja salir si el bot está prendido
//     y el setter le escribió a MaKo en las últimas 24 horas; si no, no sale y queda dicho por qué (`whatsapp.error`).
//
// NUNCA TIRA: el aviso al grupo ya salió, y esto es un extra.
// =============================================================================

import { getSupabaseServer } from './supabase';
import { linkApp } from './app-url';
import { jidDelTelefono, setterDelNegocio, tituloParaElSetter, whatsappParaElSetter, type PersonaDelNegocio } from './aviso-al-setter-reglas';

export type AvisoAlSetter = {
  /** El setter del lead, resuelto a una persona del negocio; null = no hay a quién (sin setter, MaKo, nadie o dos con ese nombre). */
  setter: { id: number; nombre: string } | null;
  push: { enviados: number; motivo?: string } | null;
  whatsapp: { ok: boolean; error?: string } | null;
  /** Con `freno`: ya se le había avisado de esto dentro del plazo, y no se repite. */
  frenado?: true;
};

const NADIE: AvisoAlSetter = { setter: null, push: null, whatsapp: null };

/** El tipo del freno del aviso al setter (`reclamarEspaciado`, lib/espaciado.ts): propio, no el del aviso al grupo. */
export const TIPO_FRENO_SETTER = 'aviso-setter';

/**
 * Le avisa al setter del lead `leadId` del negocio `ws`. `que` es lo que pasó, en texto (lo mismo que va al grupo).
 * `freno`: una vez por `clave` cada `minutos` (el «Contéstale tú» de la charla cerrada, como el del grupo: 12 h por lead). Se
 * reclama recién con el setter resuelto (sin setter no se escribe nada) y es atómico: dos mensajes juntos no avisan dos veces.
 */
export async function avisarAlSetterDelLead(ws: number, leadId: number, que: string, o: { freno?: { clave: string; minutos: number } } = {}): Promise<AvisoAlSetter> {
  try {
    const db = getSupabaseServer();
    const { data: l, error: eL } = await db.from('leads').select('id, nombre, setter').eq('workspace_id', ws).eq('id', leadId).maybeSingle();
    if (eL) { console.error(`[aviso-al-setter] ws${ws} lead ${leadId}: ${eL.message}`); return NADIE; }
    const lead = l as { id: number; nombre: string | null; setter: string | null } | null;
    if (!lead?.setter?.trim()) return NADIE;
    const { data: filas, error: eU } = await db.from('usuarios').select('id, nombre, estado, rol, perfil').eq('workspace_id', ws);
    if (eU) { console.error(`[aviso-al-setter] ws${ws}: no pude leer el equipo: ${eU.message}`); return NADIE; }
    const p: PersonaDelNegocio | null = setterDelNegocio(lead.setter, (filas ?? []) as PersonaDelNegocio[]);
    if (!p) return NADIE;
    if (o.freno) {
      const { reclamarEspaciado } = await import('./espaciado');
      if (!(await reclamarEspaciado(ws, TIPO_FRENO_SETTER, o.freno.minutos, o.freno.clave))) {
        return { setter: { id: Number(p.id), nombre: String(p.nombre ?? '').trim() }, push: null, whatsapp: null, frenado: true };
      }
    }
    const quien = lead.nombre?.trim() || `El lead #${leadId}`;
    const ruta = `/crm/${leadId}`;
    const { enviarPushAMiembros } = await import('./push');
    const r = await enviarPushAMiembros([Number(p.id)], {
      tipo: 'setter-lead', titulo: tituloParaElSetter(quien), cuerpo: que, ruta, tag: `grupo:${ws}`, ttl: 6 * 3600, urgencia: 'high',
    });
    const jid = jidDelTelefono(p.perfil?.telefono);
    let whatsapp: AvisoAlSetter['whatsapp'] = { ok: false, error: 'no tiene su teléfono en su perfil' };
    if (jid) {
      const { enviarAlChat } = await import('./mako-salida');
      const env = await enviarAlChat(jid, whatsappParaElSetter(quien, que, linkApp(ruta, ws)));
      whatsapp = env.ok ? { ok: true } : { ok: false, error: env.error ?? 'no salió' };
    }
    return { setter: { id: Number(p.id), nombre: String(p.nombre ?? '').trim() }, push: { enviados: r.enviados, ...(r.motivo ? { motivo: r.motivo } : {}) }, whatsapp };
  } catch (e) {
    console.error(`[aviso-al-setter] ws${ws} lead ${leadId}: ${e instanceof Error ? e.message : String(e)}`);
    return NADIE;
  }
}
