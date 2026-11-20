import 'server-only';
// =============================================================================
// LA PRUEBA POR WHATSAPP DE LOS DÍAS 3, 4 Y 5: LO QUE HABLA CON LA BASE Y CON LA IA (20/11/2026, a la tarde)
// =============================================================================
// Lo puro y el porqué: ./pruebas-whatsapp.ts. Lo llama lib/reto/respuestas.ts (`responderAlReto`) DESPUÉS de contestarle al webhook.
// Todo REUSA lo que ya hace MaKo, no lo copia:
//   · escuchar el audio: `transcribirAudio`, con las mismas opciones que la nota de voz del bot (lib/mako-bot.ts);
//   · día 3: la herramienta `proponer_lead` del doer (lib/mako-doer-acciones.ts, `crearRunnerAcciones`), la que corre el bot. Los datos
//     los saca la IA barata con la descripción de esa herramienta (`sistemaDelLead`);
//   · día 4: lo que guardó Competitor Spy (`listarCompetidores`, `listarPiezas`), ordenado como en la pantalla (`loQueMasLeFunciona`);
//   · día 5: las operaciones del Copywriter de la API de MaKo (lib/api-mako/areas/copywriter.run.ts): `crear_documento_copywriter`
//     arma la página y `editar_documento_copywriter` la escribe con «Editar» (la IA del negocio). Sin la confirmación del chat: lo
//     pidió ella con su audio y la página es nueva, no pisa nada. Si la escritura falla, la página va a la Papelera: vacía, la señal
//     del reto (lib/reto/senales.ts, '5:guion') la contaría como guion escrito.
// Todo corre DENTRO del workspace del negocio (`runWithWorkspace`): la IA la paga ese negocio, con sus MaKo Tokens.
// =============================================================================
import { runWithWorkspace } from '../workspace';
import { linkApp } from '../app-url';
import type { Ctx } from '../api-mako/tipos';
import { GUION_POR_WHATSAPP } from './pruebas';
import {
  LEIDO_COMPETENCIA, PIDE_EL_NOMBRE, SE_ME_CORTO, datosDelLead, instruccionDelGuion, leidoDelLead, loQueMasLeFunciona,
  respuestaDeLaCompetencia, respuestaDelGuion, respuestaDelLead, sinCompetencia, sistemaDelLead, tituloDelGuion,
} from './pruebas-whatsapp';

/** Lo que MaKo le contesta. Con `leido`, la prueba quedó hecha: es lo que dice la tarjeta del chat del reto («✓ Hecho: …»). */
export type Contestada = { texto: string; leido?: string };

const motivo = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** El audio, en texto. null: no se pudo escuchar (sin IA que escuche, o falló). */
export async function escucharAudio(ws: number, audio: { base64: string; mime: string }): Promise<string | null> {
  return runWithWorkspace(ws, async () => {
    try {
      const { transcribirAudio } = await import('../ai-cheap');
      const t = await transcribirAudio(audio.base64, audio.mime, { language: 'es', feature: 'MaKo · nota de voz', motivo: 'Transcribir el audio de la prueba del reto', pii: true, notaDeVozDelGrupo: true });
      return t.trim() || null;
    } catch (e) {
      console.error(`[reto] ws${ws}: no pude escuchar el audio de la prueba: ${motivo(e)}`);
      return null;
    }
  });
}

/** Día 3: el lead que pidió en el audio, propuesto con la herramienta del bot. */
export async function proponerElLead(ws: number, jid: string, idea: string): Promise<Contestada> {
  return runWithWorkspace(ws, async () => {
    try {
      const { MAKO_ACCION_TOOLS, crearRunnerAcciones } = await import('../mako-doer-acciones');
      const tool = MAKO_ACCION_TOOLS.find((t) => t.name === 'proponer_lead');
      if (!tool) throw new Error('el doer no tiene proponer_lead');
      const campos = ((tool.input_schema as { properties?: Record<string, { description?: string }> }).properties) ?? {};
      const { chatCheapJson } = await import('../ai-cheap');
      const crudo = await chatCheapJson<unknown>({ system: sistemaDelLead(tool.description ?? '', campos), user: idea, maxTokens: 400 });
      const datos = datosDelLead(crudo, Object.keys(campos));
      if (!datos.nombre) return { texto: PIDE_EL_NOMBRE };
      const salida = await crearRunnerAcciones(ws, jid)('proponer_lead', datos);
      const r = JSON.parse(typeof salida === 'string' ? salida : (salida as { content: string }).content) as { ok?: boolean; url?: unknown; error?: unknown };
      if (r.ok !== true || typeof r.url !== 'string') throw new Error(String(r.error ?? 'no se pudo proponer'));
      return { texto: respuestaDelLead(datos.nombre, r.url), leido: leidoDelLead(datos.nombre) };
    } catch (e) {
      console.error(`[reto] ws${ws}: no pude proponer el lead del día 3: ${motivo(e)}`);
      return { texto: SE_ME_CORTO };
    }
  });
}

/** Día 4: lo que más le funciona a su competencia, de lo que leyó Competitor Spy. «No pude leer» no es «no tienes competidores». */
export async function leerLaCompetencia(ws: number, ahora = Date.now()): Promise<Contestada> {
  return runWithWorkspace(ws, async () => {
    const link = linkApp('/competitor-spy', ws);
    try {
      const { AUN_SIN_TABLAS, listarCompetidores, listarPiezas } = await import('../spy');
      const r = await listarCompetidores();
      if (!r.ok) {
        if (r.error === AUN_SIN_TABLAS) return { texto: sinCompetencia(link) };
        throw new Error(r.error);
      }
      const cs = await Promise.all(r.competidores.slice(0, 10).map(async (c) => ({ nombre: c.nombre, piezas: await listarPiezas(c.id) })));
      const lineas = loQueMasLeFunciona(cs, ahora);
      return lineas.length ? { texto: respuestaDeLaCompetencia(lineas, link), leido: LEIDO_COMPETENCIA } : { texto: sinCompetencia(link) };
    } catch (e) {
      console.error(`[reto] ws${ws}: no pude leer Competitor Spy para el día 4: ${motivo(e)}`);
      return { texto: SE_ME_CORTO };
    }
  });
}

/** Día 5: el guion de su idea, escrito por MaKo en una página nueva de Copywriting. */
export async function escribirElGuion(ws: number, jid: string, idea: string): Promise<Contestada> {
  return runWithWorkspace(ws, async () => {
    let id: string | null = null;
    try {
      const { runnerDe } = await import('../api-mako/runners');
      const crear = runnerDe('crear_documento_copywriter'), editar = runnerDe('editar_documento_copywriter');
      if (!crear || !('ejecutar' in crear) || !crear.preparar || !editar || !('ejecutar' in editar) || !editar.preparar) throw new Error('faltan las operaciones del Copywriter');
      const ctx: Ctx = { ws, canal: 'whatsapp', canalKey: jid, alcance: 'ejecutar', rol: 'admin', mensajeUsuario: idea, actor: 'MaKo' };
      const p = await crear.preparar({ titulo: tituloDelGuion(idea), tipo: 'reel' }, ctx);
      if ('error' in p) throw new Error(p.error);
      const c = await crear.ejecutar(p.payload, ctx);
      id = typeof c.datos?.documentoId === 'string' ? c.datos.documentoId : null;
      if (!c.ok || !id) throw new Error(c.resumen);
      const pe = await editar.preparar({ documentoId: id, instruccion: instruccionDelGuion(idea) }, ctx);
      if ('error' in pe) throw new Error(pe.error);
      const ce = await editar.ejecutar(pe.payload, ctx);
      if (!ce.ok) throw new Error(ce.resumen);
      return { texto: respuestaDelGuion(linkApp(`/copywriter/${id}`, ws)), leido: GUION_POR_WHATSAPP };
    } catch (e) {
      console.error(`[reto] ws${ws}: no pude escribir el guion del día 5: ${motivo(e)}`);
      if (id) {
        const { papelera } = await import('../copywriter/server');
        await papelera(id).catch(() => null);
      }
      return { texto: SE_ME_CORTO };
    }
  });
}
