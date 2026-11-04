'use server';

// =============================================================================
// «Nuevo diseño»: crear un diseño con una plantilla de «¿Qué vas a crear hoy?» — la computadora Y el teléfono
// =============================================================================
// UNA acción para los dos lados (../m/image-editor/InicioImagenM.tsx y ./ImageEditorCliente.tsx), con la lista de
// ./plantillas-crear.ts: el id que llega del navegador se busca ahí (no se confía en medidas que vengan de afuera).
// El documento se arma en el server, sin el motor (que es sólo de cliente: test 4 de tests/image-editor-integracion.test.ts):
// en blanco con `documentoEnBlanco` (una página por id: el carrusel trae varias) o el de la plantilla con
// `documentoDePlantilla`, lo MISMO que usa la API de MaKo para `crear_diseno_imagen` (lib/api-mako/areas/imagen.run.ts).
// La puerta, la validación y la tabla son las de /api/image-editor/disenos (lib/image-editor/server.ts).
// Un carrusel de MaKo por tipo (4/11/2026) sale de su estructura (lib/carruseles/documento.ts), con el nombre del negocio en
// la cabecera; «Hacer el mío» (./carruseles/actions.ts) usa el mismo armado con la estructura de una referencia.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { crearDiseno, puerta } from '@/lib/image-editor/server';
import { documentoEnBlanco } from '@/lib/image-editor/reglas';
import { documentoDeCarrusel } from '@/lib/carruseles/documento';
import { marcaDelNegocio } from '@/lib/carruseles/marca';
import { tipoCarrusel } from '@/lib/carruseles/tipos';
import { documentoDePlantilla } from './mako/plantillas';
import { plantillaNueva } from './plantillas-crear';

type Resultado = { ok: true; id: string } | { ok: false; error: string };

/** Crea el diseño de la plantilla `id` (./plantillas-crear.ts) en el negocio de la pestaña y devuelve su id para abrirlo. */
export async function crearDisenoNuevoAction(id: string): Promise<Resultado> {
  const p = await puerta();
  if (p instanceof Response) return { ok: false, error: 'No se pudo crear el diseño.' };
  const pl = plantillaNueva(id);
  if (!pl) return { ok: false, error: 'Esa plantilla no existe.' };
  const tipo = pl.carrusel ? tipoCarrusel(pl.carrusel) : null;
  const doc = tipo
    ? documentoDeCarrusel({ laminas: tipo.estructura(tipo.laminas.def), estilo: tipo.estilo, marca: await marcaDelNegocio(p.ws), nuevoId: randomUUID })
    : pl.plantilla
      ? await documentoDePlantilla(pl.plantilla)
      : documentoEnBlanco(pl.ancho, pl.alto, Array.from({ length: Math.max(1, pl.paginas) }, () => randomUUID()));
  if (!doc) return { ok: false, error: 'Esa plantilla no existe.' };
  const r = await crearDiseno(p.ws, p.quien, { titulo: pl.tituloDiseno ?? pl.nombre, doc });
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error };
}
