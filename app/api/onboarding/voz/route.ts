// =============================================================================
// /api/onboarding/voz — los audios del cliente y el clon de su voz
// =============================================================================
// GET                                → { muestras:[…], clon:…|null, puede:{…} }
// POST multipart (file)              → sube audios
// POST json {action:'clonar'}        → crea el clon en ElevenLabs
// POST json {action:'clonar', destino:'otra', nombre, muestras:[ids]}
//                                    → OTRA voz (AI Step v2, décima tanda): sólo con esas muestras
// POST json {action:'olvidar'}       → borra el clon (en ElevenLabs y acá)
// DELETE ?id                         → borra UN audio
//
// Molde: `app/api/onboarding/persona/route.ts`, mismo guard y mismo
// `runWithWorkspace`. Es un route handler y no una server action por la razón de
// siempre: **una server action topea el cuerpo en 1 MB** y esto sube audio.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { familiaDeArchivo } from '@/lib/formatos-archivo';
import {
  getVozCliente, subirMuestra, borrarMuestra, leerMuestra, guardarClon, olvidarClon, guardarOtraVoz,
} from '@/app/video-generator/voz-cliente';
import { clonarVoz, borrarVoz, preflightEleven, verificarVoz, elevenKey } from '@/lib/elevenlabs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Clonar con tres audios de 90 s tarda; el default de 10 s corta a la mitad.
export const maxDuration = 180;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * ⚠️ 4 MB, NO 15. Vercel rechaza los POST de más de ~4,5 MB con un 413 que ni
 * siquiera llega a este archivo, así que un tope declarado por encima de ése no
 * protege: PROMETE. La ruta de `persona` declara 15 MB sobre el mismo límite
 * físico, y es el mismo error que este repo ya tiene escrito — «el entorno tiene
 * un tope y tu código declara otro».
 *
 * Con qué alcanza: 90 s de mp3 mono a 96 kbps son ~1,1 MB. Por eso el `accept`
 * de la pantalla no ofrece wav —90 s a 48 kHz son ~8,6 MB y no entran— y el
 * mensaje lo dice antes de que alguien lo intente.
 */
const MAX_BYTES = 4 * 1024 * 1024;

async function estado() {
  const v = await getVozCliente();
  return {
    muestras: v.muestras.map((m) => ({ id: m.id, nombre: m.nombre, mime: m.mime })),
    clon: v.clon ? { voiceId: v.clon.voiceId, nombre: v.clon.nombre, creadoAt: v.clon.creadoAt } : null,
    // Las otras voces (AI Step v2): las ofrece el desplegable «Tu voz» de un AI Step.
    otras: (v.otras ?? []).map((o) => ({ voiceId: o.voiceId, nombre: o.nombre })),
  };
}

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try {
      const e = await estado();
      // ⚠️ Si hay clon, se comprueba que SIGA EXISTIENDO. Un `voiceId` guardado
      // puede haberse borrado a mano en el panel de ElevenLabs, y entonces el
      // fallo aparece recién al convertir — después de gastar el pipeline entero.
      // Acá cuesta una lectura y la pantalla puede ofrecer rehacerlo.
      let vivo: boolean | null = null;
      if (e.clon) vivo = (await verificarVoz(e.clon.voiceId)).ok;
      // ⚠️ SI HAY KEY SE CONTESTA ACÁ, no al final del paso.
      //
      // Desde que la voz es BYOK, un cliente puede no tener cuenta de ElevenLabs.
      // Sin este dato la pantalla le pedía NOVENTA SEGUNDOS de grabación y recién
      // al subirlos le contestaba que falta la key — o sea, le hacía gastar el
      // trabajo entero para darle una noticia que se sabía desde el principio.
      //
      // Es sólo la presencia de la fila: no se le pega a ElevenLabs para esto,
      // porque un GET de pantalla no puede depender de que el proveedor conteste.
      const hayKey = (await elevenKey()) != null;
      return Response.json({ ok: true, ...e, vivo, hayKey });
    } catch (err) { return Response.json({ ok: false, error: msg(err) }, { status: 500 }); }
  });
}

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  const ct = req.headers.get('content-type') || '';

  return runWithWorkspace(ws, async () => {
    try {
      if (ct.includes('application/json')) {
        const body = (await req.json()) as { action?: string; autorizo?: boolean; nombre?: string; destino?: string; muestras?: unknown };

        if (body.action === 'olvidar') {
          const v = await getVozCliente();
          if (v.clon) {
            const r = await borrarVoz(v.clon.voiceId);
            // ⚠️ Si ElevenLabs no lo pudo borrar, NO se olvida acá: perder el
            // `voiceId` deja el clon vivo en la cuenta de la plataforma ocupando
            // un slot, y sin el id nadie lo puede volver a encontrar.
            if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 502 });
          }
          await olvidarClon();
          return Response.json({ ok: true, ...(await estado()), vivo: null });
        }

        if (body.action !== 'clonar') {
          return Response.json({ ok: false, error: 'Acción desconocida.' }, { status: 400 });
        }

        // ── Clonar ──
        // ⚠️ FALLA CERRADO SIN AUTORIZACIÓN. No es un formalismo: se está creando
        // una copia de la voz de una persona en una cuenta de un tercero.
        if (body.autorizo !== true) {
          return Response.json({ ok: false, error: 'Falta tu autorización para clonar la voz.' }, { status: 400 });
        }
        const v = await getVozCliente();
        // OTRA VOZ (AI Step v2): se clona SÓLO con las muestras que se subieron para ella (`muestras`, ids), y
        // con su nombre. Sin ids, no: con todas, saldría una mezcla con «Tu voz».
        const otra = body.destino === 'otra';
        const ids = Array.isArray(body.muestras) ? body.muestras.filter((x): x is string => typeof x === 'string') : [];
        const muestras = otra ? v.muestras.filter((m) => ids.includes(m.id)) : v.muestras;
        if (otra && !(body.nombre ?? '').trim()) {
          return Response.json({ ok: false, error: 'Ponle un nombre a la voz.' }, { status: 400 });
        }
        if (!muestras.length) {
          return Response.json({ ok: false, error: 'Todavía no subiste ningún audio.' }, { status: 400 });
        }

        // El preflight ANTES de bajar los audios del storage: ejercita las dos
        // operaciones reales sin gastar cuota, así que un problema de la cuenta se
        // dice acá y no después de tres descargas.
        const pre = await preflightEleven();
        if (!pre.ok) return Response.json({ ok: false, error: pre.error, motivo: pre.motivo }, { status: 502 });

        const buffers = await Promise.all(muestras.map(async (m) => {
          const buf = await leerMuestra(m.path);
          return buf ? { nombre: m.nombre, mime: m.mime, buf } : null;
        }));
        const utiles = buffers.filter((b): b is NonNullable<typeof b> => !!b);
        if (!utiles.length) {
          return Response.json({ ok: false, error: 'No pude leer tus audios del almacenamiento.' }, { status: 500 });
        }

        const nombre = (body.nombre || `MaKo ws${ws}`).slice(0, 100);
        if (otra) {
          const r = await clonarVoz(nombre, utiles);
          if (!r.ok) return Response.json({ ok: false, error: r.error, motivo: r.motivo }, { status: 502 });
          const ahora = new Date().toISOString();
          await guardarOtraVoz({ voiceId: r.valor.voiceId, nombre, creadoAt: ahora, muestras: muestras.map((m) => m.path), autorizadoAt: ahora }, muestras.map((m) => m.id));
          return Response.json({ ok: true, ...(await estado()), vivo: true, voiceId: r.valor.voiceId });
        }
        // ⚠️ EL CLON VIEJO SE ANOTA ANTES DE CREAR EL NUEVO.
        //
        // `clonarVoz` siempre crea una voz NUEVA y `guardarClon` pisa el id
        // anterior, así que hasta hoy cada re-clonado dejaba una voz colgada en la
        // cuenta sin nada que la nombrara. Medido: NUEVE huérfanas en la cuenta de
        // la casa, y las cuentas de ElevenLabs topean la cantidad de voces
        // personalizadas — o sea que el que vuelve a grabar unas cuantas veces se
        // queda sin poder clonar, con un error que habla de un límite que él no
        // sabe que existe.
        //
        // Con BYOK ya no es la cuenta de la casa: es la del cliente, y son sus
        // slots. Dejarlas ahí es ensuciarle su propia cuenta.
        const anterior = v.clon?.voiceId ?? '';
        const r = await clonarVoz(nombre, utiles);
        if (!r.ok) return Response.json({ ok: false, error: r.error, motivo: r.motivo }, { status: 502 });

        await guardarClon({
          voiceId: r.valor.voiceId,
          nombre,
          creadoAt: new Date().toISOString(),
          muestras: v.muestras.map((m) => m.path),
          autorizadoAt: new Date().toISOString(),
        });

        // ⚠️ Y SE BORRA DESPUÉS DE GUARDAR EL NUEVO, nunca antes. Borrando primero,
        // un clonado que falla deja a la persona SIN voz — pierde la que tenía por
        // intentar mejorarla. El orden es lo único que separa «quedó una de más» de
        // «se perdió la única».
        //
        // Y no rompe la respuesta: la voz nueva ya está guardada y andando, así que
        // un fallo acá deja una huérfana —lo que pasaba SIEMPRE hasta ahora— y no
        // hay ninguna razón para contarle eso a quien acaba de clonar bien.
        if (anterior && anterior !== r.valor.voiceId) {
          const b = await borrarVoz(anterior).catch(() => null);
          if (!b?.ok) console.warn(`[voz] quedó huérfana en ElevenLabs: ${anterior} (ws ${ws})`);
        }
        return Response.json({ ok: true, ...(await estado()), vivo: true });
      }

      // ── Multipart: subir audios ──
      const form = await req.formData();
      const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
      if (files.length === 0) return Response.json({ ok: false, error: 'No subiste ningún audio.' }, { status: 400 });

      const avisos: string[] = [];
      let subidas = 0;
      for (const file of files) {
        // La familia se decide SERVER-SIDE: el `accept` del input es una comodidad
        // de la pantalla, no un control — se puede arrastrar cualquier cosa.
        if (familiaDeArchivo(file.name, file.type) !== 'audio') {
          avisos.push(`«${file.name}» no es un audio, lo salté.`); continue;
        }
        if (file.size > MAX_BYTES) {
          avisos.push(`«${file.name}» pesa más de 4 MB, lo salté. Grábalo como mp3 y entra de sobra.`); continue;
        }
        await subirMuestra(Buffer.from(await file.arrayBuffer()), file.name, file.type || 'audio/mpeg');
        subidas += 1;
      }
      // ⚠️ CERO SUBIDAS ES UN ERROR, y la ruta gemela devuelve 200. Un 200 con la
      // lista igual que antes se lee como «se subió» y la persona sigue de largo
      // creyendo que ya está.
      if (subidas === 0) {
        return Response.json({ ok: false, error: avisos.join(' ') || 'No se pudo subir ningún audio.' }, { status: 400 });
      }
      return Response.json({ ok: true, avisos, ...(await estado()), vivo: null });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}

export async function DELETE(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ ok: false, error: 'Falta el id del audio.' }, { status: 400 });
  return runWithWorkspace(ws, async () => {
    try { await borrarMuestra(id); return Response.json({ ok: true, ...(await estado()), vivo: null }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}
