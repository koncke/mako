// =============================================================================
// Cron: ¿alguna landing dejó de mandar datos?
// =============================================================================
// El tracking del VSL falla EN SILENCIO por diseño ajeno: el beacon de la landing
// hace `fetch(...).catch(function(){})` y nuestro receptor devuelve 200 aunque
// descarte el evento. No hay error en consola, no hay 500, no hay nada.
//
// Precedente que justifica este cron: el tracking estuvo MUERTO 18 días
// (2026-07-15 → 08-03) con anuncios corriendo y 235 leads entrando a ritmo normal.
// Ninguna señal de negocio lo detectó — los leads seguían llegando por otras vías;
// lo que se perdió fue la atribución. Y el semáforo de /integraciones tampoco podía
// verlo: preguntaba "¿llegó algo ALGUNA VEZ?" sobre toda la historia.
//
// POR QUÉ NO USA correrPorWorkspace('landing', …): sería circular. Ese helper filtra
// por `integracionConectada`, y "landing conectada" se define justamente como "hay
// eventos recientes" — el workspace con el tracking muerto quedaría excluido y jamás
// se avisaría. (Además 'landing' no está en metodo-catalogo, así que devolvería false
// para todos.) Se itera por `landing_token` acuñado, que es la señal DURABLE de que
// ese workspace configuró el tracking alguna vez.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, runWithWorkspace, getTenantDb } from '@/lib/workspace';
import { getSetting } from '@/lib/settings';
import { LANDING_TOKEN_KEY, novedadesDesde, snippetDesactualizado, verificarPagina } from '@/lib/landing-token';
import { CONFIG_KEY, parsearConfig, urlsDe } from '@/lib/landing-config';
import { PAGINAS_KEY, parsearPaginas } from '@/lib/landing-paginas';

/**
 * Las páginas declaradas por este workspace, en cualquiera de los dos formatos.
 *
 * Se lee acá y no por la action porque el cron corre sin sesión: la action pide
 * el permiso de la tab, que no existe fuera de una request de usuario.
 */
const NL = String.fromCharCode(10);

async function paginasDelWorkspace(): Promise<string[]> {
  const nuevo = urlsDe(parsearConfig(await getSetting(CONFIG_KEY)));
  if (nuevo.length) return nuevo;
  return parsearPaginas(await getSetting(PAGINAS_KEY));
}
import { APP_BASE_URL } from '@/lib/app-url';
import { emitirDelCatalogo } from '@/lib/avisos';
import { mirarLanding } from '@/lib/landing-vigilancia';
import { enumerar, hayCambios, nombresDe } from '@/lib/landing-snapshot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Horas sin un solo evento a partir de las cuales se considera apagado. */
const HORAS_APAGADO = 48;
// Un día sin visitas puede ser un fin de semana con la pauta en pausa; dos días
// seguidos ya no. Se prefiere avisar tarde y seguro antes que quemar la alarma:
// un aviso que grita en falso se ignora, y entonces no sirve para nada.

/** Que no repita el mismo aviso todos los días mientras dura el apagón. */
const DEDUP_MIN = 60 * 24 * 3;

type Estado = { ws: number; ultima: string | null; horas: number | null; aviso: boolean; snippet?: number; cambios?: number };

/**
 * Las piezas cuyo cambio se AVISA. Botones y links de WhatsApp quedan afuera: se
 * prenden con cualquier `wa.me` en un pie de página y no cambian nada de lo que
 * se mide. El panel de la prueba sí los muestra — ahí la persona vino a mirar;
 * un aviso interrumpe, y un aviso que interrumpe por nada se deja de leer.
 *
 * `pixel` tampoco: el detector lo busca solo en el HTML crudo, así que una
 * landing que lo inyecta desde un bundle lo «pierde» en cada lectura. Y la
 * pregunta de verdad —¿siguen llegando mis datos?— ya la contesta el aviso
 * `tracking-apagado`, que la MIDE en vez de inferirla de un HTML.
 */
const PIEZAS_QUE_IMPORTAN = ['video-nativo', 'video-panda', 'video-youtube', 'video-vimeo', 'formulario', 'embed-agenda'];

/**
 * Revisa las páginas del workspace y avisa lo que cambió.
 *
 * ⚠️ Corre DENTRO de `runWithWorkspace`, y eso no es opcional: `mirarLanding`
 * escribe el snapshot con `setSetting`, que sin contexto de workspace cae a
 * OWNER_WS en silencio (lib/settings.ts:17) — o sea que el snapshot de cada
 * cliente terminaría escrito en el workspace de Mauricio, pisándose entre todos.
 */
async function revisarCambios(ws: number, suyas: string[]): Promise<number> {
  let n = 0;
  // Tope de páginas por vuelta: cada una son varios pedidos HTTP (el HTML más
  // hasta 8 chunks del bundle) y el cron tiene `maxDuration = 60`. Es el mismo
  // tope que ya usa el chequeo de versión de acá arriba.
  for (const url of suyas.slice(0, 8)) {
    const { cambios } = await mirarLanding(url, suyas).catch(() => ({ cambios: null }));
    if (!cambios || !hayCambios(cambios)) continue;
    const nuevas = nombresDe(cambios.nuevas.filter((p) => PIEZAS_QUE_IMPORTAN.includes(p)));
    const sacadas = nombresDe(cambios.sacadas.filter((p) => PIEZAS_QUE_IMPORTAN.includes(p)));
    if (!nuevas.length && !sacadas.length) continue;
    n++;

    const frases: string[] = [];
    if (nuevas.length) frases.push(`Le agregaste *${enumerar(nuevas)}* a tu página *${url}*. Ya lo estoy midiendo.`);
    // ⚠️ La frase de «sacaste» aclara que lo ya registrado sigue estando. Sacar
    // una pieza no borra lo que produjo, y sin esa aclaración el mensaje se lee
    // como que se perdieron los datos.
    if (sacadas.length) frases.push(`Sacaste *${enumerar(sacadas)}* de tu página *${url}*, así que dejo de pedírtelo en las pruebas. Lo que ya se registró por ahí sigue en tu CRM.`);

    // Va `texto` y no `contexto` por la regla de la casa: acá viaja una URL y un
    // link exactos, y un dato exacto que pasa por un LLM deja de ser exacto.
    await emitirDelCatalogo('landing-cambio', {
      ws,
      // Un cambio se cuenta UNA vez. La dedup va por página y por lo que cambió:
      // si mañana cambia otra cosa, ese sí es un aviso nuevo.
      dedupKey: `landing-cambio:${url}:${[...cambios.nuevas, ...cambios.sacadas].sort().join(',')}`,
      dedupTtlMin: DEDUP_MIN,
      texto: [...frases, '', LINK_LANDING].join(NL),
    });
  }
  return n;
}

/**
 * El link EXACTO que abre la pantalla, scrollea a la tarjeta y abre su modal.
 *
 * `?abrir=landing` no es decorativo: sin eso, el mensaje deja a la persona en una
 * pantalla con veinte tarjetas y la instrucción «buscá la de landing». El destino
 * de un aviso es el LUGAR donde se resuelve, no la sección que lo contiene.
 * Absoluto porque va adentro de un WhatsApp, donde un path no es clicable.
 */
const LINK_LANDING = `${APP_BASE_URL}/integraciones?abrir=landing`;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  const tStart = Date.now();
  let workspaces;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch (e) {
    console.error('[cron:tracking-vigilante] listarWorkspaces falló:', e);
    return Response.json({ ok: false, error: 'no se pudo listar workspaces' }, { status: 500 });
  }

  const revisados: Estado[] = [];
  const errores: Array<{ ws: number; error: string }> = [];

  for (const w of workspaces) {
    try {
      const estado = await runWithWorkspace(w.id, async (): Promise<Estado | null> => {
        // Sin token acuñado, este workspace nunca configuró tracking: no hay nada
        // que vigilar y avisarle sería ruido.
        const token = (await getSetting(LANDING_TOKEN_KEY))?.trim();
        if (!token) return null;

        const supabase = await getTenantDb(); // scopea landing_visits al workspace
        const { data, error } = await supabase
          .from('landing_visits').select('created_at')
          .order('created_at', { ascending: false }).limit(1);
        if (error) throw new Error(error.message);

        // ⚠️ ESTO VA ANTES DE CUALQUIER RAMA, y a propósito. La pregunta «¿cambió
        // la página?» es INDEPENDIENTE de si el tracking está vivo, viejo o
        // apagado: si el cliente le subió el VSL a una landing cuyo Pixel está
        // apagado, las dos cosas son ciertas y las dos hay que decirlas. Metido
        // adentro del `if (horas < HORAS_APAGADO)` —que es donde entraba más
        // cómodo— justo los workspaces con algo roto se quedaban sin enterarse.
        //
        // Es también lo único de este cron que corre para un workspace que
        // todavía no pegó el código: ahí no hay eventos que vigilar, pero la
        // página existe y puede cambiar.
        const suyas = await paginasDelWorkspace().catch(() => [] as string[]);
        const cambios = suyas.length ? await revisarCambios(w.id, suyas).catch(() => 0) : 0;

        const ultima = (data?.[0]?.created_at as string | undefined) ?? null;
        // Token acuñado pero CERO eventos en la historia: todavía no pegó el código.
        // Eso no es un apagón, es un onboarding a medias — lo dice el semáforo de
        // /integraciones, no una alarma roja.
        if (!ultima) return { ws: w.id, ultima: null, horas: null, aviso: false, cambios };

        const horas = (Date.now() - new Date(ultima).getTime()) / 3_600_000;
        if (horas < HORAS_APAGADO) {
          // El tracking está VIVO. Falta la otra pregunta, que es la que nadie
          // puede ver: ¿el código que tiene pegado es el ACTUAL? El snippet queda
          // congelado en el HTML del cliente el día que lo copió, así que una
          // mejora nuestra no le llega nunca — y no hay ningún síntoma, porque los
          // eventos del código viejo llegan igual y la integración sigue en verde.
          const { viejo, instalada } = await snippetDesactualizado();
          if (viejo) {
            // ⚠️ QUÉ PÁGINA. `snippetDesactualizado()` mira el setting del
            // WORKSPACE —una sola versión, la del último evento venga de donde
            // venga— así que con dos landings publicadas el aviso decía «tu
            // página» sin poder decir cuál. Y son distintas: el código puede
            // estar al día en la de ventas y viejo en la de webinar.
            //
            // Acá se pregunta por CADA una (la versión sale de landing_visits.sv,
            // por página) y se nombran solo las que de verdad quedaron atrás.
            // Si ninguna se puede evaluar, el mensaje sigue siendo el genérico:
            // callarse porque no se sabe cuál sería perder el aviso entero.
            const atrasadas: string[] = [];
            for (const u of suyas.slice(0, 8)) {
              const v = await verificarPagina(u).catch(() => null);
              if (v?.instalada && v.vieja) atrasadas.push(v.url);
            }
            const cuales = atrasadas.length === 1
              ? `Tu página *${atrasadas[0]}* tiene una versión vieja del Pixel.`
              : atrasadas.length > 1
                ? `Estas páginas tienen una versión vieja del Pixel:${NL}${atrasadas.map((u) => `• ${u}`).join(NL)}`
                : 'El código que tienes instalado es de una versión vieja.';
            // ⚠️ Va `texto` y NO `contexto`: con `contexto` el mensaje lo REDACTA
            // el modelo, y acá viaja un LINK exacto. La regla de la casa es
            // textual: «un DATO EXACTO que pasa por las manos de un LLM deja de
            // ser exacto… si un id, un número o una URL tienen que llegar
            // intactos, no los transporta el modelo». Además el mensaje es
            // siempre el mismo, así que pagarle a Claude para reescribirlo es
            // gastar por una variación que nadie pidió.
            await emitirDelCatalogo('tracking-desactualizado', {
              ws: w.id,
              dedupTtlMin: DEDUP_MIN,
              texto: [
                cuales,
                '',
                `*Qué te estás perdiendo:* ${novedadesDesde(instalada)}.`,
                '',
                `*Cómo se arregla* (2 minutos): entra aquí, elige ${atrasadas.length > 1 ? 'cada página' : 'esa página'}, copia el código y vuelve a pegarlo donde estaba.`,
                LINK_LANDING,
              ].join('\n'),
            });
          }
          return { ws: w.id, ultima, horas, aviso: false, snippet: instalada, cambios };
        }

        const dias = Math.floor(horas / 24);
        await emitirDelCatalogo('tracking-apagado', {
          ws: w.id,
          dedupTtlMin: DEDUP_MIN,
          contexto: `La landing no registra visitas desde hace ${dias} día(s) (última: ${ultima}). Los anuncios pueden seguir corriendo: lo que se pierde es la atribución. Causa típica: el Pixel de MaKo quedó apuntando a una dirección vieja — se copia con la URL congelada y no se entera de un cambio de dominio.`,
        });
        return { ws: w.id, ultima, horas, aviso: true, cambios };
      });
      if (estado) revisados.push(estado);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[cron:tracking-vigilante] ws ${w.id}:`, msg);
      errores.push({ ws: w.id, error: msg });
    }
  }

  const ms = Date.now() - tStart;
  const avisados = revisados.filter((r) => r.aviso).length;
  const cambios = revisados.reduce((n, r) => n + (r.cambios ?? 0), 0);
  console.log(`[cron:tracking-vigilante] revisados=${revisados.length} avisados=${avisados} cambios=${cambios} errores=${errores.length} ms=${ms}`);

  // 500 solo si NINGUNO se pudo revisar: es un vigilante, tiene que gritar cuando
  // es él el que está ciego.
  const ok = errores.length === 0 || revisados.length > 0;
  return Response.json({ ok, revisados, avisados, cambios, errores, ms }, { status: ok ? 200 : 500 });
}
