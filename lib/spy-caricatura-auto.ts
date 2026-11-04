import 'server-only';

// =============================================================================
// spy-caricatura-auto — el motor de la caricatura automática: un paso por llamada (4/11/2026)
// =============================================================================
// Martín, 4/11 (por el Cerebro): «me traje a @den.borgg y no me hizo la caricatura como habíamos quedado... Eso debe
// hacerse en segundo plano de manera automática». `pedirCaricatura` (lib/spy-caricatura-flow.ts) existía desde el 3/11
// y NO LA LLAMABA NADIE: le faltaban los rasgos y quien la dispare.
//
// Qué paso toca lo decide `pasoSiguiente` (lib/spy-caricatura-reglas.ts, con test). Acá se hace ese paso y se anota en
// `spy.caricaturas` (app_settings del negocio, sin migración: una entrada por competidor). La pantalla llama a
// /api/competitor-spy/caricatura y vuelve a preguntar mientras haya algo en marcha; si se cierra, lo pedido sigue en la
// cola de Flow y la próxima apertura lo recoge.
//
// ⚠️ LO PAGA EL NEGOCIO, DOS VECES: los rasgos con SU IA (`leerDocumentoIA`, sin la red de la plataforma) y la imagen
// con SU Google Flow, por el puente de SU navegador. Sin el puente listo no se pide nada.
// =============================================================================

import { leerDocumentoIA } from './ai-cheap';
import { estadoPuente } from './flow-cola';
import { clipDeInterfaz, usaInterfaz } from './flow-interfaz';
import { imagenesDeRespuesta } from './flow-imagen';
import { estaVivo } from './flow-puente-frescura';
import { estadoDePrueba } from './prueba-uso';
import { cambiarSettingSi, getSettingEstricto } from './settings';
import { leerCompetidor } from './spy';
import { referenteDeCompetidor } from './spy-caricatura';
import { pedirCaricatura } from './spy-caricatura-flow';
import {
  ABANDONO_MS, CLAVE_CARICATURAS, FALLOS_HASTA_RENDIRSE, leerRegistro, pasoSiguiente, rasgosDeRespuesta, sigueEnMarcha,
  type EntradaCaricatura, type Paso,
} from './spy-caricatura-reglas';
import { esNuestra, guardarMiniaturas } from './spy-miniaturas';
import { getTenantDb } from './workspace';

/** Lo que la pantalla necesita saber: si ya está (y dónde), y si tiene que volver a preguntar. */
export type EstadoCaricatura = { url: string | null; enMarcha: boolean; porque?: string };

/** El prompt de los rasgos. En inglés, porque van tal cual al prompt de la imagen. Sin nombres: no hace falta saber quién es. */
const PROMPT_RASGOS = `Look at the person in this profile photo. In ONE line, under 30 words, in English, describe only what makes their HEAD unmistakable for a caricature artist: hair (style, color, length), facial hair, glasses, eyebrows, face shape, skin tone and approximate age. No clothing, no background, no names, no opinions. If there is no single human face in the photo, answer exactly: NONE`;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Escribe la entrada de un competidor sin pisar la de otro: compare-and-set, y un reintento si alguien escribió en el medio. */
async function anotar(id: number, cambio: (e: EntradaCaricatura) => EntradaCaricatura): Promise<void> {
  for (let vuelta = 0; vuelta < 2; vuelta += 1) {
    const crudo = await getSettingEstricto(CLAVE_CARICATURAS);
    const r = leerRegistro(crudo);
    r[String(id)] = cambio(r[String(id)] ?? {});
    if (await cambiarSettingSi(CLAVE_CARICATURAS, crudo, JSON.stringify(r))) return;
  }
}

/** ¿El puente de Flow del negocio puede generar ahora? El mismo criterio que el AI Avatar (app/ai-avatar/actions.ts). */
async function puenteListo(): Promise<boolean> {
  const p = await estadoPuente().catch(() => null);
  return !!p && p.estado === 'listo' && estaVivo(p.ultimoVisto, Date.now()) && usaInterfaz(p.version);
}

/** Los rasgos de su foto, con la IA del negocio. null si no hay una cara o la IA no los pudo decir. */
async function describirCara(avatar: string): Promise<{ rasgos: string | null; sinIA?: true }> {
  const r = await fetch(avatar, { signal: AbortSignal.timeout(10_000), cache: 'no-store' }).catch(() => null);
  if (!r || !r.ok) return { rasgos: null };
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length || buf.length > 4_000_000) return { rasgos: null };
  const mime = /png/i.test(r.headers.get('content-type') ?? '') ? 'image/png' : /webp/i.test(r.headers.get('content-type') ?? '') ? 'image/webp' : 'image/jpeg';
  try {
    const leido = await leerDocumentoIA({
      dataUrl: `data:${mime};base64,${buf.toString('base64')}`, isPdf: false, nombreArchivo: 'cara.jpg', prompt: PROMPT_RASGOS,
      feature: 'spy', motivo: 'Describir la cara de un competidor para su caricatura', timeoutMs: 40_000,
    });
    return { rasgos: rasgosDeRespuesta(leido.text) };
  } catch (e) {
    // «No hay ninguna IA que pueda mirar esto»: el negocio no tiene una IA que mire fotos. Se queda con su foto.
    return /ninguna IA|Conecta tu/i.test(msg(e)) ? { rasgos: null, sinIA: true } : { rasgos: null };
  }
}

/** Mira el trabajo de Flow que la está generando, y si terminó la guarda. */
async function mirarTrabajo(ws: number, id: number, trabajo: number): Promise<EstadoCaricatura> {
  const db = await getTenantDb();
  const { data, error } = await db.from('flow_trabajos').select('estado, resultado, tomado_at, created_at').eq('id', trabajo).maybeSingle();
  // No poder leer no es «no salió»: se vuelve a preguntar.
  if (error) return { url: null, enMarcha: true };
  if (!data) { await anotar(id, (e) => ({ ...e, trabajo: undefined })); return { url: null, enMarcha: true }; }
  const estado = String(data.estado ?? '');
  if (estado === 'listo') {
    const propia = clipDeInterfaz(data.resultado);
    const url = (propia?.url || imagenesDeRespuesta(data.resultado)[0]?.url || '').trim();
    if (!url) {
      await anotar(id, (e) => ({ ...e, trabajo: undefined, fallos: (e.fallos ?? 0) + 1 }));
      return { url: null, enMarcha: false, porque: 'Flow terminó sin devolver la imagen' };
    }
    // Se BAJA a nuestro bucket: la de Flow vence en una hora (lib/flow-imagen.ts).
    const [bajada] = await guardarMiniaturas([{ canal: 'caricatura', ref: `${ws}-${id}`, miniatura: url }]);
    const final = esNuestra(bajada.miniatura) ? bajada.miniatura as string : null;
    if (!final) return { url: null, enMarcha: true, porque: 'No pude bajar la caricatura: vuelvo a intentar' };
    await anotar(id, (e) => ({ ...e, url: final, trabajo: undefined }));
    return { url: final, enMarcha: false };
  }
  if (estado === 'fallido') {
    await anotar(id, (e) => ({ ...e, trabajo: undefined, fallos: (e.fallos ?? 0) + 1 }));
    return { url: null, enMarcha: false, porque: 'Flow no pudo generarla' };
  }
  const nacio = Date.parse(String(data.created_at ?? ''));
  if (!data.tomado_at && Number.isFinite(nacio) && Date.now() - nacio > ABANDONO_MS) {
    // Nadie lo tomó: se cierra (que el navegador no lo genere más tarde a escondidas) y se vuelve a pedir otro día.
    await db.from('flow_trabajos').update({ estado: 'fallido', motivo: 'puente_ausente', error: 'Nadie levantó el pedido.', listo_at: new Date().toISOString() })
      .eq('id', trabajo).eq('estado', 'pendiente');
    await anotar(id, (e) => ({ ...e, trabajo: undefined }));
    return { url: null, enMarcha: false, porque: 'Tu navegador no tomó el pedido' };
  }
  return { url: null, enMarcha: true };
}

/**
 * Un paso de la caricatura de un competidor. Nunca tira: una caricatura es una comodidad, y la tarjeta tiene su foto.
 * Lo llama /api/competitor-spy/caricatura, con la sesión y el negocio ya resueltos.
 */
export async function avanzarCaricatura(ws: number, id: number): Promise<EstadoCaricatura> {
  try {
    const c = await leerCompetidor(id);
    if (!c) return { url: null, enMarcha: false };
    const registro = leerRegistro(await getSettingEstricto(CLAVE_CARICATURAS));
    const e = registro[String(id)];
    if (e?.url) return { url: e.url, enMarcha: false };
    const [enPrueba, listo] = await Promise.all([
      // Sin poder saber si está en la prueba, no se gasta: es lo conservador.
      estadoDePrueba(ws).then((x) => x.enPrueba).catch(() => true),
      puenteListo(),
    ]);
    const paso: Paso = pasoSiguiente(e, { referente: !!referenteDeCompetidor(c), avatar: c.avatar, enPrueba, puenteListo: listo });

    if (paso.hacer === 'nada') return { url: null, enMarcha: false, porque: paso.porque };
    if (paso.hacer === 'mirar-trabajo') return await mirarTrabajo(ws, id, paso.trabajo);
    if (paso.hacer === 'rasgos') {
      const d = await describirCara(c.avatar as string);
      if (!d.rasgos) {
        // Sin una cara, no se insiste (una caricatura sin rasgos sale igual a todas). Sin IA, se vuelve a probar la próxima
        // vez: no cuesta nada y el negocio puede conectar la suya.
        if (!d.sinIA) await anotar(id, (x) => ({ ...x, fallos: FALLOS_HASTA_RENDIRSE }));
        return { url: null, enMarcha: false, porque: d.sinIA ? 'sin-ia' : 'sin-cara' };
      }
      await anotar(id, (x) => ({ ...x, rasgos: d.rasgos as string }));
      return { url: null, enMarcha: sigueEnMarcha({ hacer: 'pedir' }) };
    }
    // pedir: sube la foto a Flow (si todavía no está) y pide la imagen. `null` = la foto está subiendo: se vuelve.
    const trabajo = await pedirCaricatura(c, e?.rasgos ?? '');
    if (trabajo == null) return { url: null, enMarcha: true, porque: 'Subiendo su foto a Flow' };
    await anotar(id, (x) => ({ ...x, trabajo, pedidaEn: new Date().toISOString() }));
    return { url: null, enMarcha: true };
  } catch (err) {
    console.error(`[spy-caricatura] ws=${ws} competidor=${id}: ${msg(err)}`);
    return { url: null, enMarcha: false };
  }
}
