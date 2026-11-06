// =============================================================================
// «Guardar en MaKo» desde la extensión — el lead de un perfil de Instagram o de LinkedIn, en el CRM (6/11/2026)
// =============================================================================
// Lo prometido a la agencia de Thiago (docs/promesas/2910-llamada-thiago.md). Corre adentro del `runWithWorkspace` del token del
// puente (app/api/crm/extension/route.ts). Dos pasos, los dos por el toque de la persona en el desplegable:
//   · `verPerfil`: qué se entendió del perfil y si ya está en el CRM. NO escribe nada: es la pantalla donde la persona mira el
//     nombre y lo corrige antes de guardar (un canal propone y una persona confirma, AGENTS.md);
//   · `guardarPerfil`: crea el lead, con el nombre que quedó en esa pantalla. Vuelve a leer la captura y a mirar los repetidos:
//     lo de la pantalla anterior no se cree.
//
// Lo que NO hace, a propósito:
//   · no le escribe a nadie: un lead de Instagram nace sin teléfono ni email, y uno de LinkedIn también (MaKo no escribe por
//     LinkedIn). Entra a la etapa de entrada de su CRM como cualquier carga a mano;
//   · no pisa un lead que ya está: con el mismo @ o el mismo perfil de LinkedIn contesta «ya está» y su link;
//   · no frena por un parecido de nombre sin decírselo a la persona: «Ya tienes un lead que se llama X», y ella elige.
// =============================================================================

import 'server-only';
import { createLead, duplicadosDeLead } from './leads';
import { porMotivo, type Coincidencia } from './leads-duplicados';
import { frenarAltaPorTope, TopeDelPlanError } from './topes-crm';
import { getTenantDb } from './workspace';
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
import { guardarFotoDeInstagram } from './foto-instagram';
import { linkApp } from './app-url';
import { RUTA_CAMBIAR_PLAN } from './topes-plan';
import { ORIGEN_LEAD } from '@/app/crm/origen-lead';
import { leerPerfil, linkedinComparable, nombreParaGuardar, patronDeLinkedin, rotuloDePerfil, type CapturaPerfil, type PerfilLeido } from './perfil-captura';

type LeadCorto = { id: number; nombre: string; link: string };

export type VistaPerfil = { red: PerfilLeido['red']; rotulo: string; nombre: string | null; foto: boolean };

export type RespuestaVer =
  | { ok: true; perfil: VistaPerfil; ya: LeadCorto | null; parecidos: LeadCorto[] }
  | { ok: false; motivo: 'no-es-perfil' | 'falla'; error: string };

export type RespuestaGuardar =
  | { ok: true; lead: LeadCorto }
  | { ok: false; motivo: 'ya'; error: string; lead: LeadCorto }
  | { ok: false; motivo: 'parecido'; error: string; parecidos: LeadCorto[] }
  /** `planes`: el link de «Pasar a Pro», con el cartel del tope del plan (lib/topes-crm.ts). */
  | { ok: false; motivo: 'tope'; error: string; planes: string }
  | { ok: false; motivo: 'sin-nombre' | 'no-es-perfil' | 'falla'; error: string };

const NO_ES_PERFIL = 'Esta pestaña no es el perfil de una persona. Abre su perfil de Instagram o de LinkedIn y vuelve a tocar el ícono de MaKo.';

const corto = (ws: number, l: { id: number; nombre: string | null }): LeadCorto => ({
  id: l.id, nombre: l.nombre?.trim() || 'Sin nombre', link: linkApp(`/crm/${l.id}`, ws),
});

/** El lead que ya tiene ESTE perfil (el mismo @ o el mismo LinkedIn). Una lectura que falla tira: «no pude mirar» no es «no está». */
async function yaGuardado(p: PerfilLeido): Promise<{ id: number; nombre: string | null } | null> {
  if (p.red === 'instagram') {
    const dup = porMotivo(await duplicadosDeLead({ nombre: '', instagram: p.id }), 'instagram');
    return dup[0]?.lead ?? null;
  }
  const db = await getTenantDb();
  // Superconjunto por substring escapado; decide la igualdad del perfil normalizado de los dos lados (lo guardado puede ser el
  // link con o sin «www.», con la barra o sin ella, o con la consulta de LinkedIn pegada).
  const filas = await leerTodo<{ id: number; nombre: string | null; linkedin: string | null }>(db, 'leads', 'id, nombre, linkedin', {
    orden: 'id',
    filtros: (q) => q.ilike('linkedin', patronDeLinkedin(p.id)) as unknown as ConsultaPaginada,
  });
  return filas.find((f) => linkedinComparable(f.linkedin) === p.id) ?? null;
}

/** Los leads que se llaman igual (sin el mismo perfil). Sólo avisan: la persona decide. */
async function parecidosDeNombre(nombre: string | null, p: PerfilLeido): Promise<Coincidencia[]> {
  if (!nombre) return [];
  return porMotivo(await duplicadosDeLead({ nombre, ...(p.red === 'instagram' ? { instagram: p.id } : {}) }), 'nombre');
}

/** Qué se entendió del perfil y si ya está en el CRM. No escribe nada. */
export async function verPerfil(ws: number, c: CapturaPerfil): Promise<RespuestaVer> {
  const p = leerPerfil(c);
  if (!p) return { ok: false, motivo: 'no-es-perfil', error: NO_ES_PERFIL };
  try {
    const ya = await yaGuardado(p);
    const parecidos = ya ? [] : (await parecidosDeNombre(p.nombre, p)).map((x) => corto(ws, x.lead));
    return { ok: true, perfil: { red: p.red, rotulo: rotuloDePerfil(p), nombre: p.nombre, foto: !!p.foto }, ya: ya ? corto(ws, ya) : null, parecidos };
  } catch (e) {
    console.error('[perfil-captura] no pude mirar el CRM:', e instanceof Error ? e.message : e);
    return { ok: false, motivo: 'falla', error: 'No pude mirar tu CRM. Vuelve a intentarlo.' };
  }
}

/**
 * Crea el lead del perfil. `nombre` es el que dejó la persona en el desplegable (o el leído); con `aunqueSeLlameIgual`, la persona
 * ya vio el aviso de un parecido de nombre y eligió guardarlo igual.
 */
export async function guardarPerfil(ws: number, c: CapturaPerfil, opts: { nombre?: unknown; aunqueSeLlameIgual?: boolean }): Promise<RespuestaGuardar> {
  const p = leerPerfil(c);
  if (!p) return { ok: false, motivo: 'no-es-perfil', error: NO_ES_PERFIL };
  const nombre = nombreParaGuardar(opts.nombre, p.nombre);
  if (!nombre) return { ok: false, motivo: 'sin-nombre', error: 'Escribe su nombre para guardarlo.' };
  try {
    const ya = await yaGuardado(p);
    if (ya) return { ok: false, motivo: 'ya', error: 'Ya está en tu CRM.', lead: corto(ws, ya) };
    if (!opts.aunqueSeLlameIgual) {
      const parecidos = await parecidosDeNombre(nombre, p);
      if (parecidos.length) {
        return { ok: false, motivo: 'parecido', error: `Ya tienes un lead que se llama ${parecidos[0].lead.nombre?.trim() || nombre}.`, parecidos: parecidos.map((x) => corto(ws, x.lead)) };
      }
    }
    await frenarAltaPorTope(ws, 'crm.leads');
    // Los repetidos ya se miraron arriba (por el perfil y por el nombre, con la decisión de la persona): `createLead` no los vuelve
    // a frenar. Nace en la etapa de entrada del CRM principal, como una carga a mano.
    const lead = await createLead({
      nombre,
      origen_lead: p.red === 'instagram' ? ORIGEN_LEAD.perfil_instagram.id : ORIGEN_LEAD.perfil_linkedin.id,
      ...(p.red === 'instagram' ? { instagram: p.id } : { linkedin: p.url }),
      permitirDuplicado: true,
    });
    // La foto de Instagram vence: se copia a nuestro bucket. Si no se puede, el lead queda con sus iniciales.
    if (p.foto) await guardarFotoDeInstagram(lead.id, p.foto).catch(() => false);
    return { ok: true, lead: corto(ws, lead) };
  } catch (e) {
    if (e instanceof TopeDelPlanError) return { ok: false, motivo: 'tope', error: e.message, planes: linkApp(RUTA_CAMBIAR_PLAN, ws) };
    console.error('[perfil-captura] no pude guardar el lead:', e instanceof Error ? e.message : e);
    return { ok: false, motivo: 'falla', error: 'No pude guardarlo. Vuelve a intentarlo.' };
  }
}
