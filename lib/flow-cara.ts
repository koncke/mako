// =============================================================================
// La cara de una foto de la persona, dentro de Flow
// =============================================================================
// El `mediaId` en Flow de una foto de la Brand Persona. Si todavía no está, la sube
// (un trabajo `subir_imagen` del puente) y devuelve '' hasta que llegue.
//
// Vivía adentro de app/video-generator/video-action.ts (`caraEnFlow`), que es un
// módulo 'use server': ahí no se puede exportar sin volverla una server action
// llamable desde el navegador, sin puerta propia. Se mudó acá cuando la tab AI
// Avatar (17/10/2026) necesitó la MISMA cara para sus looks: dos copias de «qué
// mediaId tiene esta foto» terminan subiendo la foto dos veces o generando con
// la cara de una foto borrada en una de las dos tabs.
//
// Quien la llame ya resolvió la puerta (rol y tab): esta función no decide acceso.

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { encolar, estadoPuente } from '@/lib/flow-cola';
import { usaInterfaz, pedidoSubidaInterfaz } from '@/lib/flow-interfaz';
import { ENDPOINTS, obj, str, parchesSubirImagen, KEY_CARAS_FLOW } from '@/lib/flow-protocolo';
import { getSetting, setSetting } from '@/lib/settings';
import { personaEstado, getPersona } from '@/lib/persona';

export async function caraDeFoto(fotoIdCrudo: string): Promise<string> {
  const fotoId = str(fotoIdCrudo);
  if (!fotoId) return '';

  // ⚠️ SE COMPRUEBA QUE LA FOTO SIGA EXISTIENDO ANTES DE USAR LO CACHEADO.
  //
  // `elegirFotoAction` verifica que exista al ELEGIRLA, y eso no cubre nada acá:
  // borrar la foto después deja el `fotoId` del plan y la entrada del mapa vivos,
  // así que se seguía generando con la cara de una foto que ya no está — mientras
  // la pantalla muestra otra. Nadie puede notar que la comparación «¿apruebas tu
  // avatar?» está comparando dos cosas sin relación.
  //
  // Y de paso se purga el mapa: una clave que apunta a una foto borrada no vuelve
  // a servir nunca, y guardarla es prometer que sí.
  const est = await personaEstado().catch(() => null);
  if (est && !est.fotos.some((f: { id: string }) => f.id === fotoId)) {
    const sucio = JSON.parse((await getSetting(KEY_CARAS_FLOW)) || '{}') as Record<string, string>;
    if (fotoId in sucio) {
      delete sucio[fotoId];
      await setSetting(KEY_CARAS_FLOW, JSON.stringify(sucio));
    }
    return '';
  }

  const mapa = JSON.parse((await getSetting(KEY_CARAS_FLOW)) || '{}') as Record<string, string>;
  if (str(mapa[fotoId])) return str(mapa[fotoId]);

  const db = await getTenantDb();
  const { data } = await db
    .from('flow_trabajos')
    .select('id, estado, resultado')
    .eq('tipo', 'subir_imagen')
    .filter('pedido->>fotoId', 'eq', fotoId)
    .order('id', { ascending: false })
    .limit(3);

  for (const t of data ?? []) {
    if (str(t.estado) !== 'listo') continue;
    // ⚠️ La respuesta MEDIDA trae el id en `media.name`, y `media` es un OBJETO
    // —no un array, a diferencia de las respuestas de generación—. Por eso no se
    // usa `extraerMediaId`, que mira claves de primer nivel: acá está un nivel
    // más adentro.
    const id = str(obj(obj(t.resultado).media).name);
    if (!id) continue;
    await setSetting(KEY_CARAS_FLOW, JSON.stringify({ ...mapa, [fotoId]: id }));
    return id;
  }

  // Ninguna esperando: se sube. Con una en vuelo, se espera a ésa.
  if (!(data ?? []).some((t) => ['pendiente', 'tomado'].includes(str(t.estado)))) {
    const foto = (await getPersona()).fotos.find((f: { id: string }) => f.id === fotoId);
    if (!foto) return '';
    const bin = await db.storage.from('archivero').download(foto.path);
    if (bin.error || !bin.data) return '';
    const b64 = Buffer.from(await bin.data.arrayBuffer()).toString('base64');
    // Con el motor por interfaz la foto se sube por el menú «Upload» de Flow: viaja
    // el archivo, no un parche de un pedido aprendido.
    const puenteF = await estadoPuente().catch(() => null);
    await encolar('subir_imagen', usaInterfaz(puenteF?.version)
      ? pedidoSubidaInterfaz({ imagenB64: b64, mime: /\.png$/i.test(foto.path) ? 'image/png' : 'image/jpeg', fotoId })
      : {
        path: ENDPOINTS.subirImagen,
        parches: parchesSubirImagen(b64),
        // Para poder encontrar este trabajo despues sin mirar el cuerpo entero.
        fotoId,
      });
  }
  return '';
}
