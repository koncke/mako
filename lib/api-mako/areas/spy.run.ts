// =============================================================================
// api-mako/areas/spy.run — los cuerpos del área `spy` (Competitors Spy)
// =============================================================================
// Todo lo que toca la base vive en lib/spy.ts; acá se arma lo que viaja y se dice lo que no se pudo.
//
// ⚠️ EL WORKSPACE NO SE LEE DE `input`. `ejecutarOperacion` (lib/api-mako/ejecutar.ts) ya corre cada
// runner dentro de `runWithWorkspace(ctx.ws, …)`, así que `getTenantDb()` resuelve solo al negocio
// que preguntó. Un `id` de competidor que venga de otro negocio no existe para estas consultas: el
// proxy les inyecta el `workspace_id` y la fila no aparece.
//
// ⚠️ UN `error` DE `preparar()` ES UNA REGLA; UNA FALLA NUESTRA LLEVA `falla: true`. Sin la marca,
// el «no pude» de MaKo después de esa falla no abre ticket. «Ese competidor no tiene YouTube
// cargado» es una regla y va SIN la marca; «no pude leer la base» es nuestra y va CON ella
// (tests/guarda-por-defecto.test.ts).
//
// ⚠️ `ejecutar()` no lanza nunca: `seguro()`.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Runners, SalidaLectura } from '../tipos';
import {
  agregarCompetidor, analizarCompetidor, AUN_SIN_TABLAS, etapaDePieza, guardarAnuncioPegado,
  leerCompetidor, listarCompetidores, listarPiezas, mirarCompetidor, queEs, quitarCompetidor,
} from '@/lib/spy';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { contenidoNoConfiable } from '@/lib/prompt-render';
import { funnelDeFila, funnelEnPalabras } from '@/lib/spy-funnel';
import { dibujarContador, NOMBRE_CANAL, NOMBRE_ETAPA, NOMBRE_FUENTE, SIN_ANUNCIOS_EN_ESTE_PAIS, adLibraryCubreComercial, type CanalSpy } from '@/lib/spy-reglas';

const json = (o: unknown): string => JSON.stringify(o);

async function seguro(que: string, fn: () => Promise<Ejecutado>): Promise<Ejecutado> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[api-mako spy] ${que}:`, msg);
    return { ok: false, resumen: `No se pudo ${que}: vuelve a intentarlo.` };
  }
}

/** El id que llegó, si es un entero positivo. Nada de `Number(x) || 0`, que convierte basura en 0. */
const idDe = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** El competidor, o el motivo por el que no se puede seguir. */
async function elCompetidor(v: unknown): Promise<{ ok: true; c: Awaited<ReturnType<typeof leerCompetidor>> & object } | { ok: false; error: string }> {
  const id = idDe(v);
  if (id == null) return { ok: false, error: 'Dime cuál: el id que devuelve listar_vigilados.' };
  const c = await leerCompetidor(id);
  if (!c) return { ok: false, error: 'No encontré a ese competidor en este negocio.' };
  return { ok: true, c };
}

export const RUNNERS: Runners = {
  listar_vigilados: {
    leer: async (_input, _ctx): Promise<SalidaLectura> => {
      const r = await listarCompetidores();
      if (!r.ok) return { content: json({ ok: false, error: r.error }), isError: r.error !== AUN_SIN_TABLAS };
      return json({
        ok: true,
        competidores: r.competidores.map((c) => ({
          id: c.id, nombre: c.nombre,
          canales: [c.instagram ? 'instagram' : '', c.youtube_id ? 'youtube' : '', c.landing_url ? 'landing' : ''].filter(Boolean),
          instagram: c.instagram ? `@${c.instagram}` : null,
          // Los contadores se dicen como lo que son: «no lo publica» no es cero, ni para la pantalla
          // ni para el modelo.
          seguidores: dibujarContador(c.instagram_seguidores),
          suscriptores: dibujarContador(c.youtube_suscriptores),
          revisado: c.mirado_en ? c.mirado_en.slice(0, 10) : 'nunca',
          oferta: c.oferta?.promete ?? null,
        })),
        total: r.competidores.length,
      });
    },
  },

  sumar_al_radar: {
    preparar: async (input) => {
      const pegado = String(input.pegado ?? '').trim();
      if (!pegado) return { error: 'Pega su @ de Instagram, el enlace de su canal de YouTube o el de su sitio.' };
      const leido = queEs(pegado);
      if (!leido) return { error: 'No reconocí eso. Pega un @ de Instagram, un enlace de YouTube o el de su sitio.' };
      const nombre = String(input.nombre ?? '').trim();
      const comoQueda = nombre || (leido.campo === 'nombre' ? leido.valor : leido.valor.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);
      return {
        payload: { pegado, nombre: nombre || null },
        resumen: `Empezar a mirar a «${comoQueda}» (${leido.campo === 'instagram' ? `@${leido.valor} en Instagram` : leido.campo === 'youtube_id' ? 'su canal de YouTube' : leido.campo === 'tiktok' ? `@${leido.valor} en TikTok` : leido.campo === 'landing_url' ? 'su sitio' : 'por nombre, sin canales todavía'})`,
      };
    },
    ejecutar: async (p) => seguro('sumarlo al radar', async () => {
      const r = await agregarCompetidor(String(p.pegado ?? ''), typeof p.nombre === 'string' ? p.nombre : undefined);
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Listo: «${r.competidor.nombre}» quedó en el radar. Dime «revisa qué publicó» cuando quieras la primera lectura.`, datos: { id: r.competidor.id } };
    }),
  },

  revisar_sus_canales: {
    preparar: async (input) => {
      const c = await elCompetidor(input.id);
      if (!c.ok) return { error: c.error };
      const tiene = [c.c.instagram ? 'Instagram' : '', c.c.youtube_id ? 'YouTube' : '', c.c.landing_url ? 'su sitio' : ''].filter(Boolean);
      if (!tiene.length) return { error: `De «${c.c.nombre}» no hay ningún canal cargado todavía. Pega su @ de Instagram, su canal de YouTube o su sitio.` };
      return { payload: { id: c.c.id }, resumen: `Leer ahora ${tiene.join(', ')} de «${c.c.nombre}» y guardar lo nuevo` };
    },
    ejecutar: async (p) => seguro('revisar sus canales', async () => {
      const id = idDe(p.id);
      if (id == null) return { ok: false, resumen: 'No sé a quién revisar.' };
      const r = await mirarCompetidor(id);
      if (r.error) return { ok: false, resumen: r.error };
      // TRES estados por canal, no dos: leyó · no se pudo · no estaba configurado. «No pude leer» y
      // «no tiene nada» son datos distintos y la respuesta los dice distinto.
      const lineas = r.canales.map((x) => `${NOMBRE_CANAL[x.canal]}: ${x.ok ? `${x.detalle}${x.nuevas ? ` (${x.nuevas} nuevas)` : ''}` : x.detalle}`);
      const nuevas = r.canales.reduce((n, x) => n + x.nuevas, 0);
      return {
        ok: r.ok,
        resumen: `${nuevas ? `${nuevas} piezas nuevas.` : 'Sin piezas nuevas.'}\n${lineas.join('\n')}`,
        datos: { nuevas, canales: r.canales },
      };
    }),
  },

  que_esta_haciendo: {
    leer: async (input): Promise<SalidaLectura> => {
      const c = await elCompetidor(input.id);
      if (!c.ok) return { content: json({ ok: false, error: c.error }), isError: true };
      const canal = typeof input.canal === 'string' ? (input.canal as CanalSpy) : undefined;
      const piezas = await listarPiezas(c.c.id, canal);
      const out: string[] = [`## ${c.c.nombre}`];
      if (c.c.oferta?.promete) {
        out.push('', `**Qué vende:** ${c.c.oferta.promete}${c.c.oferta.aQuien ? ` — a ${c.c.oferta.aQuien}` : ''}`);
        if (c.c.oferta.objecion) out.push(`**Qué objeción ataca:** ${c.c.oferta.objecion}`);
        if (c.c.oferta.huecos.length) out.push(`**Lo que ataca y tú no mencionas:** ${c.c.oferta.huecos.join(' · ')}`);
      }
      if (!piezas.length) {
        out.push('', c.c.mirado_en ? 'Se lo revisó y no hay piezas guardadas.' : 'Todavía no se lo revisó.');
      }
      for (const canalUno of (canal ? [canal] : (['instagram', 'youtube', 'landing', 'anuncios'] as const))) {
        const delCanal = piezas.filter((p) => p.canal === canalUno);
        if (!delCanal.length) continue;
        out.push('', `### ${NOMBRE_CANAL[canalUno]}`);
        // Todo lo de abajo es de un tercero: el copy de un anuncio puede decir cualquier cosa, y esta
        // respuesta se la lee un modelo. Va marcado, igual que en `analizarCompetidor`.
        const lineas: string[] = [];
        for (const p of delCanal.slice(0, 15)) {
          const etapa = etapaDePieza(p);
          lineas.push([
            `- ${p.titulo || p.texto?.slice(0, 90) || p.ref}`,
            `vistas ${dibujarContador(p.vistas)}`,
            `me gusta ${dibujarContador(p.megusta)}`,
            // La etapa es NUESTRO criterio y la respuesta lo dice; y «no se sabe desde cuándo» no es
            // «es nuevo», que es el error que esta tab existe para no cometer.
            etapa ? NOMBRE_ETAPA[etapa].rotulo.toLowerCase() : 'no se sabe desde cuándo',
            NOMBRE_FUENTE[p.fuente].toLowerCase(),
          ].join(' · '));
          const funnel = p.canal === 'landing' ? funnelDeFila(p.funnel) : null;
          if (funnel) lineas.push(...funnelEnPalabras(funnel).map((l) => `  - ${l}`));
        }
        out.push(contenidoNoConfiable(lineas.join('\n'), 'piezas_del_competidor'));
      }
      // Si pidió los anuncios y el país no está cubierto, se dice por qué no hay nada que traer en
      // vez de dejar una sección vacía que se lee como «no pauta».
      if ((!canal || canal === 'anuncios') && !piezas.some((p) => p.canal === 'anuncios') && c.c.pais && !adLibraryCubreComercial(c.c.pais)) {
        out.push('', `### ${NOMBRE_CANAL.anuncios}`, SIN_ANUNCIOS_EN_ESTE_PAIS);
      }
      return { content: out.join('\n'), formato: 'md' };
    },
  },

  leer_su_oferta: {
    preparar: async (input) => {
      const c = await elCompetidor(input.id);
      if (!c.ok) return { error: c.error };
      const piezas = await listarPiezas(c.c.id);
      if (!piezas.length) return { error: `De «${c.c.nombre}» todavía no hay nada leído. Dime «revisa qué publicó» primero.` };
      return { payload: { id: c.c.id }, resumen: `Leer con IA las ${piezas.length} piezas guardadas de «${c.c.nombre}» y decir qué vende y qué objeción ataca` };
    },
    ejecutar: async (p) => seguro('leer su oferta', async () => {
      const id = idDe(p.id);
      if (id == null) return { ok: false, resumen: 'No sé a quién leer.' };
      // Lo que vende ESTE negocio es la mitad del análisis: sin eso sale «este competidor promete
      // X», que es la Biblioteca de Anuncios con otro CSS. El cruce es lo que ninguna herramienta
      // de afuera puede hacer, porque ninguna conoce el negocio.
      const brief = await perfilNegocioTexto().catch(() => '');
      const r = await analizarCompetidor(id, brief);
      if (!r.ok) return { ok: false, resumen: r.error };
      const o = r.analisis.oferta;
      const lineas = [
        o.promete ? `Promete: ${o.promete}` : '',
        o.aQuien ? `A: ${o.aQuien}` : '',
        o.precio ? `Precio publicado: ${o.precio}` : '',
        o.objecion ? `Ataca: ${o.objecion}` : '',
        o.huecos.length ? `Lo que él ataca y tú no mencionas: ${o.huecos.join(' · ')}` : '',
      ].filter(Boolean);
      return { ok: true, resumen: lineas.join('\n') || 'Lo leí y no pude concluir nada de lo guardado.', datos: { piezas: r.analisis.piezas.length } };
    }),
  },

  dejar_de_mirar: {
    preparar: async (input) => {
      const c = await elCompetidor(input.id);
      if (!c.ok) return { error: c.error };
      return { payload: { id: c.c.id, nombre: c.c.nombre }, resumen: `Dejar de mirar a «${c.c.nombre}» y borrar lo que se leyó de él` };
    },
    ejecutar: async (p) => seguro('dejar de mirarlo', async () => {
      const id = idDe(p.id);
      if (id == null) return { ok: false, resumen: 'No sé a quién dejar de mirar.' };
      const r = await quitarCompetidor(id);
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: `Listo: ya no miro a «${String(p.nombre ?? '')}».` };
    }),
  },
  guardar_anuncio_visto: {
    preparar: async (input) => {
      const c = await elCompetidor(input.id);
      if (!c.ok) return { error: c.error };
      const enlace = String(input.enlace ?? '').trim();
      if (!/^https?:\/\//i.test(enlace)) return { error: 'Pega el enlace del anuncio en la Biblioteca de Anuncios de Meta.' };
      return {
        payload: { id: c.c.id, enlace, copy: String(input.copy ?? '').trim() || null },
        resumen: `Guardar ese anuncio en la ficha de «${c.c.nombre}»`,
      };
    },
    ejecutar: async (p) => seguro('guardar el anuncio', async () => {
      const id = idDe(p.id);
      if (id == null) return { ok: false, resumen: 'No sé de quién es ese anuncio.' };
      const r = await guardarAnuncioPegado(id, String(p.enlace ?? ''), typeof p.copy === 'string' ? p.copy : undefined);
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: r.nuevo ? 'Guardado. Desde hoy cuento cuántos días lleva a la vista.' : 'Ese anuncio ya estaba guardado: actualicé la última vez que se vio.' };
    }),
  },
};

/** Para que el linter no marque `Ctx` como importado y sin usar: lo usan las firmas de `Runners`. */
export type CtxDelSpy = Ctx;
