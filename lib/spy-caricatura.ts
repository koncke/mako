// =============================================================================
// spy-caricatura — la cara de un competidor que YA tenemos dibujada (2/11/2026)
// =============================================================================
// Martín: «aprovechá todas las caricaturas que ya tenemos hechas de todos los gurús para ponerlas
// ahí también. Yo mismo voy a entrar a poner ese arroba, entonces ya directamente salen con la
// caricatura correspondiente».
//
// Hay 22 caricaturas aprobadas en `public/asesores/<id>.png`, dibujadas para el Ops Center. Varias
// son de gente que Martín mira como competencia (Hormozi, Sofía Contreras, Iman Gadzhi, Agustín
// Nievas…). La tarjeta de Spy tiene un hueco cuadrado a sangre esperando una imagen. Eran la misma
// imagen en dos lugares y no se cruzaban.
//
// ⚠️ SE EMPAREJA POR NOMBRE COMPARABLE, NO POR UNA TABLA DE ARROBAS, y ésa es la decisión que hace
// que esto funcione sin que nadie cargue nada. `nombreComparable` borra tildes, espacios y signos,
// así que el @ y el nombre real colapsan al MISMO texto:
//     '@alexhormozi'     → 'alexhormozi' ─┐
//     'Alex Hormozi'     → 'alexhormozi' ─┴─ iguales
//     'sofiacontreras'   → 'sofiacontreras' ─┐
//     'Sofía Contreras'  → 'sofiacontreras' ─┴─ iguales (la tilde no estorba)
// Una tabla de @ hardcodeada habría hecho falta mantenerla, se habría desactualizado cuando alguien
// cambia su usuario, y sobre todo: **un @ puesto de memoria trae a OTRA persona**, que es el error
// que ya pagamos resolviendo gurús por búsqueda en vez de por handle (docs/hallazgos-ops-center.md).
//
// ⚠️ EL TOPE DE LARGO NO ES DECORATIVO. Sin él, un competidor llamado «Ads» o «IA» emparejaría con
// cualquier referente cuyo nombre corto colapse a esas letras, y la tarjeta mostraría la cara de un
// desconocido. Seis caracteres es lo más corto de la lista real (`juanads` son siete).
//
// ⚠️ ES UN RESPALDO, NO UN REEMPLAZO: si el competidor tiene su foto de perfil bajada (`avatar`,
// migración 0362), manda la foto — es la cara de verdad de la persona que el negocio eligió mirar.
// La caricatura llena el hueco cuando no hay foto, que es el caso de todos los que Martín va a
// pegar ahora. Quién gana lo decide la pantalla, no este archivo.
// =============================================================================

import { ASESORES, type IdAsesor } from './asesores/catalogo';
import { nombreComparable } from './spy-reglas';

/** Más corto que esto no se empareja: colisionaría con nombres de dos sílabas. */
export const MINIMO_PARA_EMPAREJAR = 6;

/** Todas las formas en que se puede nombrar a un referente, ya comparables. */
const porNombre = new Map<string, IdAsesor>();
for (const a of ASESORES) {
  for (const forma of [a.completo, a.nombre, a.id]) {
    const k = nombreComparable(forma);
    // El primero gana: `completo` es el más específico y se recorre primero.
    if (k.length >= MINIMO_PARA_EMPAREJAR && !porNombre.has(k)) porNombre.set(k, a.id);
  }
}

/** Lo que identifica a un competidor, de lo más confiable a lo menos. */
export type AQuienMira = {
  nombre?: string | null;
  instagram?: string | null;
  youtube_id?: string | null;
};

/**
 * El id del referente que es ESTE competidor, o `null` si no es ninguno.
 *
 * Se prueban el nombre guardado y los @ de sus canales: cualquiera de los tres alcanza, porque los
 * tres colapsan al mismo texto comparable. El `youtube_id` se prueba sólo cuando es un handle
 * (`@algo`): un id de canal (`UCxxxx`) no se parece al nombre de nadie y emparejarlo sería ruido.
 */
export function referenteDeCompetidor(c: AQuienMira): IdAsesor | null {
  const youtube = (c.youtube_id ?? '').startsWith('@') ? c.youtube_id : null;
  for (const dato of [c.nombre, c.instagram, youtube]) {
    if (!dato) continue;
    const k = nombreComparable(dato);
    if (k.length < MINIMO_PARA_EMPAREJAR) continue;
    const id = porNombre.get(k);
    if (id) return id;
  }
  return null;
}

/**
 * La ruta pública de la caricatura de este competidor, o `null`.
 *
 * ⚠️ VIENE DE `/asesores/grandes/`, NO DE `/asesores/`, Y LOS DOS TIENEN QUE EXISTIR. Son el mismo
 * dibujo en dos tamaños porque los usa gente distinta:
 *   · `/asesores/<id>.png` — 200 px. Lo pide el Ops Center para el disco de una fila de chat, y
 *     `tests/coaches-ops-center.test.ts` EXIGE que pese menos de 150 KB: esa lista las baja TODAS.
 *   · `/asesores/grandes/<id>.png` — 600 px. Lo pide la tarjeta de Spy, que es cuadrada y ocupa el
 *     ancho entero; a 248 px de CSS en una pantalla retina son ~500 px reales.
 *
 * Martín, 2/11/2026: «al agrandar la imagen se perdió un poco la calidad de resolución, se ve un
 * poco borroso». La causa era que la tarjeta usaba el archivo de 200 px. Agrandar ESE archivo
 * habría puesto en rojo el test del Ops Center (159 KB contra el tope de 150), así que son dos.
 *
 * ⚠️ Y NO SE REGENERAN: `app/admin/operaciones/Retratos.tsx` dice que Martín aprobó estas caras
 * después de ocho vueltas. El grande sale de agrandar el aprobado, no de dibujar otro.
 */
export function caricaturaDeCompetidor(c: AQuienMira): string | null {
  const id = referenteDeCompetidor(c);
  return id ? `/asesores/grandes/${id}.png` : null;
}

/**
 * El nombre completo de un referente, para GUARDARLO como nombre del competidor.
 *
 * ⚠️ POR QUÉ IMPORTA, y es un pedido de Martín (2/11/2026): «no pueden haber dos Alex Hormozi, no
 * pueden haber dos Sofía Contreras». Pegar su YouTube guardaba el nombre `UCxxxxxx` —el id del
 * canal— y pegar su @ guardaba `alexhormozi`. Para la base son dos nombres distintos, así que la
 * deduplicación por nombre no los juntaba y salían DOS tarjetas de la misma persona.
 *
 * Con esto, cualquiera de las dos formas guarda «Alex Hormozi», y la próxima vez que alguien pegue
 * cualquier cosa suya, el nombre comparable ya coincide.
 */
export function nombreDeReferente(id: IdAsesor): string {
  return ASESORES.find((a) => a.id === id)?.completo ?? id;
}

/**
 * Cómo se titula la tarjeta: el nombre de VERDAD cuando sabemos quién es.
 *
 * ⚠️ POR QUÉ EXISTE, visto en producción el 2/11/2026: una tarjeta decía «@AlexHormozi». El alta
 * guarda el nombre completo desde hoy, pero **los competidores que ya estaban se guardaron con lo
 * que se pegó** —el @, o el id del canal—, y esas filas no se arreglan solas.
 *
 * ⚠️ SE ARREGLA AL DIBUJAR Y NO TOCANDO LA BASE, a propósito: el nombre guardado es del negocio y
 * reescribirlo sería cambiarle un dato suyo sin que lo pida. Acá sólo se elige qué mostrar.
 *
 * ⚠️ Y NO PISA UN NOMBRE QUE EL NEGOCIO HAYA PUESTO. Sólo entra cuando el nombre guardado ES una de
 * las formas del referente (su @, su nombre corto, su id): «Hormozi (competencia directa)» no
 * colapsa a ninguna de ésas, así que se respeta tal cual.
 */
export function nombreDeTarjeta(c: AQuienMira & { nombre?: string | null }): string {
  const guardado = (c.nombre ?? '').trim();
  const id = referenteDeCompetidor(c);
  if (!id) return guardado;
  const real = nombreDeReferente(id);
  // Si lo guardado ya es su nombre real, no hay nada que cambiar; si es otra cosa que el negocio
  // escribió, tampoco se toca — y eso sólo puede pasar si NO emparejó por nombre.
  if (!guardado) return real;
  return nombreComparable(guardado) === nombreComparable(real) || porNombre.get(nombreComparable(guardado)) === id
    ? real
    : guardado;
}

/** Lo que `queEs` devolvió, visto como «a quién mira», para poder emparejarlo con un referente. */
export function comoAQuienMira(leido: { campo: 'instagram' | 'youtube_id' | 'tiktok' | 'landing_url' | 'nombre'; valor: string }): AQuienMira {
  if (leido.campo === 'instagram') return { instagram: leido.valor };
  if (leido.campo === 'youtube_id') return { youtube_id: leido.valor };
  if (leido.campo === 'nombre') return { nombre: leido.valor };
  // Un TikTok tampoco: los referentes no tienen su @ de TikTok cargado.
  // Una landing NO se empareja: `acquisition.com` colapsa a 'acquisitioncom' y no se parece al
  // nombre de nadie. Juntar un dominio con una persona necesitaría una tabla de dominios, que es
  // otra cosa y hay que mantenerla.
  return {};
}
