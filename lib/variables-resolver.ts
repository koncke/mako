// =============================================================================
// Los valores de las variables, en el momento de mandar — para TODO mensaje con «{ }»
// =============================================================================
// El catálogo (qué se ofrece) vive en `lib/variables-aviso.ts`, SIN `server-only`,
// para que lo importe la pantalla. Acá viven los VALORES, que necesitan el workspace
// y la base — o sea el server. Lo que se decide sin base (qué columna da qué token, cómo
// se escribe) vive en `lib/variables-del-lead.ts`, con test.
//
// Desde la sexta tanda (09/10/2026) lo usan los DOS destinos del «{ }»:
//   · los avisos de MaKo al equipo (MaKo en WhatsApp, Notificaciones): `conVariables`;
//   · los mensajes al LEAD de las automatizaciones (el motor, lib/nutricion.ts): `datosParaElLead`.
// Antes el motor resolvía sólo cinco datos (lib/template-vars.ts) y el selector de WhatsApp no podía
// ofrecer más: «La previsualización de un editor no puede resolver un token que el motor NO resuelve».
//
// ⚠️ LA SUSTITUCIÓN VA EN EL CALL SITE, NO ADENTRO DEL GENERADOR DE TEXTO. Hay tres
// retornos que se saltean el modelo (`out.trim() || ref`, el `catch → ref`, y el
// fallback de los pasos de un flujo): con la sustitución adentro, la variable falla
// exactamente cuando falla la IA, que es cuando menos se la mira.
//
// ⚠️ UNA LECTURA POR ENTIDAD QUE EL TEXTO NOMBRA, Y SÓLO SI LA NOMBRA (la regla de admisión del
// catálogo). `fuentesQueNombra` mira los tokens que el mensaje trae de verdad, así que el 99% de
// los mensajes (los que no nombran ningún dato) no leen nada. Cero proveedores: todo sale de la base.
//
// ⚠️ LO QUE NO SE PUEDE LEER NO TUMBA EL MENSAJE: cada entidad va en su `try`, y sus tokens salen
// CRUDOS (se nota) mientras el resto del mensaje sale igual. Es la regla de la zona horaria.

import 'server-only';

import { linkApp } from './app-url';
import { RUTA_DE_LINK, RE_VARIABLE, resolverVariables, fuentesQueNombra, type DestinoMensaje, type FuenteDato } from './variables-aviso';
import { tzDeWorkspace, KEY_TIMEZONE } from './timezone';
import { getWorkspace, runWithWorkspace, getTenantDb } from './workspace';
import { getSetting } from './settings';
import { zonaDelMotor } from './nutricion-grafo-motor';
import { etapaVigenteDe } from './funnel-etapas';
import { nombreVisible } from './lead-funnel-reglas';
import {
  valoresDelLead, valoresDelNombre, valoresConZona, valoresDelProducto, valoresDeEtiquetas, valoresDePagos,
  valoresDelCurso, valoresDelPerfil, valoresDelLeadMagnet, valoresDelMomento,
} from './variables-del-lead';
import type { Lead } from './leads';

export type CtxVariables = {
  ws: number;
  leadId?: number | null;
  leadNombre?: string | null;
  /** A quién le llega. Sin esto, al equipo (los avisos de siempre). Ver `soloPara` en el catálogo. */
  destino?: DestinoMensaje;
};

/** Corre una lectura y, si falla, la anota y sigue: sus tokens salen crudos. */
async function intentar(que: string, fn: () => Promise<Record<string, string>>): Promise<Record<string, string>> {
  try { return await fn(); } catch (e) {
    console.error(`[variables] no pude leer ${que}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

/**
 * La zona con la que se dicen la fecha y las horas. Al EQUIPO, la de `tzDeWorkspace` (lo de siempre
 * de los avisos); al LEAD —el camino del motor— la que usa el motor, sin salir a la red
 * (`zonaDelMotor`): un envío no puede esperar a que se averigüe una zona.
 */
async function zonaPara(ws: number, destino: DestinoMensaje): Promise<string> {
  if (destino === 'equipo') return tzDeWorkspace(ws);
  return zonaDelMotor(await runWithWorkspace(ws, () => getSetting(KEY_TIMEZONE)).catch(() => null));
}

/**
 * Su producto (la CASA: `leads.funnel_id`, null = el del negocio): la etapa con `etapaVigenteDe`
 * contra SUS etapas y el nombre que ve la persona. Un lead que además está en otros productos dice
 * la de su casa: es la que dibuja su tarjeta en el tablero del negocio.
 */
async function valoresDeSuProducto(l: Lead): Promise<Record<string, string>> {
  const { idDelFunnelDefault, listarFunnels } = await import('./funnels');
  const { etapasDeProducto } = await import('./lead-funnel');
  const funnelId = l.funnel_id != null ? Number(l.funnel_id) : await idDelFunnelDefault();
  if (funnelId == null) return {};
  const [etapas, funnels] = await Promise.all([etapasDeProducto(funnelId), listarFunnels()]);
  const f = funnels.find((x) => x.id === funnelId);
  // `etapaVigenteDe` sólo mira las claves (y el `kind` de una reunión, que acá no decide nada).
  const claves = etapas.map((e) => ({ key: e.key, kind: e.kind ?? undefined }));
  return valoresDelProducto({ etapaClave: etapaVigenteDe(l, claves), etapas, producto: f ? nombreVisible(f) : null });
}

/**
 * Su CURSO. Los productos del curso son los que su acceso abre si los nombra (mig 0232); si no,
 * los de su entrega (`cliente_entrega`) y el del embudo de su casa (`v_funnel_productos`), más
 * cualquiera en el que ya tenga avance. El link es el de su portal, sólo si ya se le dio.
 *
 * ⚠️ Es una aproximación de «¿de qué producto es este cliente?» para UN lead: la regla completa
 * (`universoDeLaEntrega`, app/customer-success/entrega.ts) lee la cartera entera, y eso por cada
 * mensaje de una cohorte de alumnos no es una lectura por entidad. Con varios productos con curso,
 * el avance suma las clases de todos.
 */
async function valoresDeSuCurso(l: Lead, ws: number, destino: DestinoMensaje): Promise<Record<string, string>> {
  const { avanceDelCliente, accesoDe, clasesDelProducto, linkDeAccesoExistente } = await import('./curso-datos');
  const db = await getTenantDb();
  const [avance, acceso] = await Promise.all([avanceDelCliente(l.id), accesoDe(l.id)]);
  const productos = new Set<number>();
  if (acceso?.productos?.length) for (const p of acceso.productos) productos.add(Number(p));
  else {
    const { data: filas, error } = await db.from('cliente_entrega').select('producto_id').eq('lead_id', l.id);
    if (error) throw new Error(error.message);
    for (const f of (filas ?? []) as Array<{ producto_id: number }>) productos.add(Number(f.producto_id));
    const { idDelFunnelDefault } = await import('./funnels');
    const casa = l.funnel_id != null ? Number(l.funnel_id) : await idDelFunnelDefault();
    if (casa != null) {
      const { data: vp, error: e2 } = await db.from('v_funnel_productos').select('producto_id').eq('funnel_id', casa);
      if (e2) throw new Error(e2.message);
      for (const f of (vp ?? []) as Array<{ producto_id: number }>) productos.add(Number(f.producto_id));
    }
    const conAvance = [...avance.progreso.keys()];
    if (conAvance.length) {
      // Sin las de la papelera (mig 0223): una clase borrada no existe para nadie (tests/curso-papelera).
      const { data: cs, error: e3 } = await db.from('curso_clases').select('producto_id').in('id', conAvance).is('borrada_at', null);
      if (e3) throw new Error(e3.message);
      for (const c of (cs ?? []) as Array<{ producto_id: number }>) productos.add(Number(c.producto_id));
    }
  }
  const clases = (await Promise.all([...productos].sort((a, b) => a - b).map((p) => clasesDelProducto(p)))).flat();
  // El link, SÓLO para el lead (es la llave de su portal) y sólo si ya lo tiene.
  const link = destino === 'lead' ? await linkDeAccesoExistente(l.id, ws).catch(() => null) : null;
  return valoresDelCurso({ clases, progreso: avance.progreso, link });
}

/**
 * Los valores que este mensaje puede resolver AHORA.
 *
 * Lo que no se puede resolver NO entra al mapa, y `resolverVariables` deja su token
 * intacto: un `{{lead_nombre}}` en un aviso que no habla de ningún lead sale crudo.
 * Es a propósito — se ve raro y se nota, mientras que borrarlo dejaría el mensaje
 * cojo sin que nadie se entere. Lo que evita que llegue ahí es que el selector no lo
 * OFRECE (`variablesPara`), y eso se decide en la pantalla.
 *
 * `texto` es lo que decide qué se lee. Sin él se calculan sólo los de siempre (los links, la fecha
 * y el negocio): quien no pasa el texto no puede estar pidiendo un dato del CRM.
 */
export async function valoresDeVariables(ctx: CtxVariables, texto?: string, datos?: Record<string, string>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const destino = ctx.destino ?? 'equipo';
  const f: Set<FuenteDato> | null = typeof texto === 'string' ? fuentesQueNombra(texto) : null;
  const pide = (x: FuenteDato) => f == null || f.has(x);
  // ⚠️ EL WORKSPACE SALE DE `ctx.ws`, NO DE `wsEnContexto()`. Es la misma pregunta
  // contestada dos veces en dos líneas, y por eso una salía bien y la otra no: el
  // barrido del 05/10 arregló el `link_lead` de abajo y no vio este `for`, porque el
  // guard sólo reconoce la ruta cuando es un LITERAL pegado a `${APP_BASE_URL}` y acá
  // viene de una variable. Y `ctx.ws` es `number`, así que no puede quedar en null:
  // `wsEnContexto()` devuelve null fuera de un `runWithWorkspace`, que es exactamente
  // el caso del drenador de agendados (lib/avisos-programados.ts, que resuelve con
  // `getWorkspaceActual()` y no envuelve nada) — ahí el link salía pelado igual.
  // Los links son del EQUIPO: un lead no entra al CRM del negocio.
  if (destino === 'equipo') {
    for (const [k, ruta] of Object.entries(RUTA_DE_LINK)) out[k] = linkApp(ruta, ctx.ws);
    if (ctx.leadId) out.link_lead = linkApp(`/crm/${ctx.leadId}/resumen`, ctx.ws);
  }
  const zona = pide('momento') || pide('zona') ? await zonaPara(ctx.ws, destino).catch(() => null) : null;
  // Sin zona no se inventa una hora: los tokens del momento quedan crudos.
  if (zona && pide('momento')) Object.assign(out, valoresDelMomento(Date.now(), zona));
  if (pide('negocio')) {
    try {
      const w = await getWorkspace(ctx.ws);
      if (w?.nombre) out.negocio = w.nombre;
    } catch { /* idem */ }
  }

  // Las lecturas por ENTIDAD, todas en el workspace del mensaje (`ctx.ws`) y sólo las nombradas.
  if (f && f.size) {
    await runWithWorkspace(ctx.ws, async () => {
      const lecturas: Array<Promise<Record<string, string>>> = [];
      if (ctx.leadId && (f.has('ficha') || f.has('zona') || f.has('producto') || f.has('curso'))) {
        lecturas.push(intentar('la ficha del lead', async () => {
          const { getLead } = await import('./leads');
          const l = await getLead(ctx.leadId!);
          if (!l) return {};
          const r: Record<string, string> = { ...valoresDelLead(l) };
          if (zona && f.has('zona')) Object.assign(r, valoresConZona(l, zona));
          if (f.has('producto')) Object.assign(r, await intentar('el producto del lead', () => valoresDeSuProducto(l)));
          if (f.has('curso')) Object.assign(r, await intentar('el curso del lead', () => valoresDeSuCurso(l, ctx.ws, destino)));
          return r;
        }));
      }
      if (ctx.leadId && f.has('etiquetas')) {
        lecturas.push(intentar('las etiquetas del lead', async () => {
          const { etiquetasDeLead } = await import('./etiquetas');
          return valoresDeEtiquetas((await etiquetasDeLead(ctx.leadId!)).map((e) => e.nombre));
        }));
      }
      if (ctx.leadId && f.has('pagos')) {
        lecturas.push(intentar('las cuotas del lead', async () => {
          const { getPagosByLead } = await import('./pagos');
          return valoresDePagos(await getPagosByLead(ctx.leadId!));
        }));
      }
      if (f.has('perfil')) {
        lecturas.push(intentar('el perfil del negocio', async () => {
          const { getAnswers } = await import('./onboarding');
          return valoresDelPerfil(await getAnswers());
        }));
      }
      if (f.has('lead_magnet')) {
        lecturas.push(intentar('el lead magnet', async () => {
          const { getEntregables } = await import('./entregable');
          return valoresDelLeadMagnet(await getEntregables());
        }));
      }
      for (const r of await Promise.all(lecturas)) Object.assign(out, r);
    });
  }
  // El link del curso es la llave del portal del LEAD: al equipo no sale, aunque se haya escrito.
  if (destino === 'equipo') delete out.curso_link;
  // Lo que viene del evento (`leadNombre`) NO se pisa con lo de la base: el evento es más nuevo.
  Object.assign(out, valoresDelNombre(ctx.leadNombre));
  // ⚠️ LO QUE PASA EL EMISOR GANA, y va último a propósito. Son los valores que ese
  // disparador ya tenía en la mano —el número y el monto de la cuota que el cron de
  // cobranza acaba de leer— y nadie los puede resolver mejor: ir a buscarlos otra vez
  // sería una lectura por un dato que estaba acá, y dejar que un default los pise sería
  // mandar el monto de otra cuota.
  if (datos) for (const [k, v] of Object.entries(datos)) if (v) out[k] = v;
  return out;
}

/** El texto con los datos puestos. Azúcar sobre las dos de arriba. */
export async function conVariables(texto: string, ctx: CtxVariables, datos?: Record<string, string>): Promise<string> {
  if (!texto.includes('{{')) return texto;   // el 99% de los avisos, sin una sola lectura
  return resolverVariables(texto, await valoresDeVariables(ctx, texto, datos));
}

/**
 * LOS DATOS DE UN MENSAJE AL LEAD, para el motor de las automatizaciones (lib/nutricion.ts).
 *
 * `base` es lo que el motor ya tiene en la mano (`valoresVariablesLead`: el nombre partido, la
 * empresa y el negocio, de la fila que leyó para mandar) y GANA: es la lectura más nueva. Esto le
 * suma lo que el texto nombre del resto del catálogo, con destino `lead` (sin links al CRM, con el
 * link de su curso). `texto` es TODO lo que el paso puede mandar (cuerpo, partes, asunto, pie): un
 * token en la segunda parte también cuenta.
 *
 * Sin token, o sin nada fuera de lo que `base` ya resolvió, no lee nada.
 */
export async function datosParaElLead(texto: string, base: Record<string, string>, ctx: { ws: number | null; leadId: number | null }): Promise<Record<string, string>> {
  if (typeof texto !== 'string' || !texto.includes('{{') || ctx.ws == null) return base;
  // Sólo los tokens que `base` NO tiene: «Hola {{nombre}}» o «de {{empresa}}» no leen nada.
  const faltan = [...texto.matchAll(RE_VARIABLE)].map((m) => m[0]).filter((t) => !(t.slice(2, -2).toLowerCase() in base));
  if (!fuentesQueNombra(faltan.join(' ')).size) return base;
  const extra = await valoresDeVariables({ ws: ctx.ws, leadId: ctx.leadId, destino: 'lead' }, faltan.join(' '));
  return { ...extra, ...base };
}
