// =============================================================================
// editor-video/presets-subtitulos-server — leer y escribir los presets del negocio
// =============================================================================
// Las reglas viven en ./presets-subtitulos.ts (puro). Acá: la clave de app_settings del
// negocio en curso, con compare-and-set para que dos pestañas que guardan a la vez no
// se pisen (gana una, la otra vuelve a leer y reintenta). «No pude leer» TIRA: con la
// base caída, guardar sobre una lista vacía borraría los presets de la marca.
//
// Lo usan la ruta /api/video-editor/presets (el editor) y la API de MaKo
// (lib/api-mako/areas/video.run.ts). El negocio sale del contexto (la cookie de la
// ruta, o `runWithWorkspace` de la API): nada de acá lee un `?ws=`.

import 'server-only';
import { cambiarSettingSi, getSettingEstricto } from '@/lib/settings';
import {
  CLAVE_PRESETS, buscarPreset, conPreset, escribirPresets, leerPresets, nuevoIdPreset, sanearPreset,
  type PresetSubtitulos,
} from './presets-subtitulos';

export async function listarPresets(): Promise<PresetSubtitulos[]> {
  return leerPresets(await getSettingEstricto(CLAVE_PRESETS));
}

type Escritura = { ok: true; preset: PresetSubtitulos } | { ok: false; motivo: string };

/** Lee, cambia y escribe con compare-and-set; si otro escribió en el medio, vuelve a leer (3 veces). */
async function cambiar(
  cambio: (lista: PresetSubtitulos[]) => { ok: true; lista: PresetSubtitulos[]; preset: PresetSubtitulos } | { ok: false; motivo: string },
): Promise<Escritura> {
  for (let intento = 0; intento < 3; intento++) {
    const crudo = await getSettingEstricto(CLAVE_PRESETS);
    const r = cambio(leerPresets(crudo));
    if (!r.ok) return r;
    if (await cambiarSettingSi(CLAVE_PRESETS, crudo, escribirPresets(r.lista))) return { ok: true, preset: r.preset };
  }
  return { ok: false, motivo: 'otra persona estaba guardando presets a la vez: vuelve a intentarlo' };
}

/**
 * Crea un preset (sin `id`) o reemplaza el de ese id. `raw` es lo que mandó el editor o
 * la API: se sanea entero acá.
 */
export async function guardarPreset(raw: unknown, id?: string | null): Promise<Escritura> {
  return cambiar((lista) => {
    const existe = id ? lista.find((p) => p.id === id) : undefined;
    if (id && !existe) return { ok: false, motivo: 'ese preset ya no está (otra persona lo borró)' };
    const s = sanearPreset(raw, { id: existe?.id ?? nuevoIdPreset(), ahora: new Date().toISOString() });
    if (!s.ok) return s;
    const puesta = conPreset(lista, s.valor);
    return puesta.ok ? { ok: true, lista: puesta.lista, preset: s.valor } : puesta;
  });
}

export async function borrarPreset(cual: string, marca?: string | null): Promise<Escritura> {
  return cambiar((lista) => {
    const b = buscarPreset(lista, cual, marca);
    if (!b.ok) return b;
    return { ok: true, lista: lista.filter((p) => p.id !== b.preset.id), preset: b.preset };
  });
}
