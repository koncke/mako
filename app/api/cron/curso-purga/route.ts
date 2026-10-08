// =============================================================================
// Cron: borra los archivos HUÉRFANOS de los buckets del curso (diario)
// =============================================================================
// Videos (`curso-videos`) y adjuntos de notas (`curso-notas`) que se subieron y ninguna fila de
// ningún workspace nombra, con más de 24 h: subidas abandonadas cerrando la pestaña, o lo que
// quedó de una clase o una nota borrada. El qué y el porqué viven en lib/curso-purga.ts; la regla
// de qué se puede borrar, pura y con test, en app/customer-success/curso/reglas.ts.
//
// ⚠️ POR DEFAULT ES UN MODO PRUEBA: lista, cruza y devuelve los candidatos con su peso, y NO borra.
// Borra sólo con un '1' explícito (`pideBorrarPurga`):
//   GET /api/cron/curso-purga             → prueba: qué borraría y cuánto pesa
//   GET /api/cron/curso-purga?borrar=1    → borra UNA vez, a mano, después de leer la prueba
//   CURSO_PURGA_BORRAR=1 en el entorno    → el cron diario borra (lo que la prende de verdad)
// El contenido de los buckets nunca se midió: sin esto, lo primero que hacía en producción era
// un `remove` real.
//
// ⚠️ NO ITERA WORKSPACES, a propósito: el bucket es uno para toda la plataforma y la pregunta es
// «¿lo usa ALGUIEN?». Correrlo adentro de un inquilino sería cruzar el bucket contra las clases de
// uno solo, que es justo el error que borra los videos de los demás.
//
// Contesta 500 si hubo un error de verdad (listado, lectura o borrado) para que el monitoreo del
// cron lo vea; una vuelta que se abstuvo por la regla (la lectura volvió vacía) es un 200 con su
// motivo escrito.
//
// ⚠️ PRIMERO LA PAPELERA (08/10/2026, mig 0223): las clases y los módulos que se borraron desde el
// editor hace más de una semana se borran DE VERDAD (lib/curso-papelera.ts). Va antes y SIN modo
// prueba —es el `delete` de siempre, diferido para que exista el «Deshacer»—, y así el video de una
// clase purgada queda sin fila que lo nombre para la purga de los buckets de abajo.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { purgarHuerfanosDelCurso } from '@/lib/curso-purga';
import { purgarPapeleraDelCurso } from '@/lib/curso-papelera';
import { pideBorrarPurga } from '@/app/customer-success/curso/reglas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  try {
    const papelera = await purgarPapeleraDelCurso();
    const borrar = pideBorrarPurga(req.nextUrl.searchParams.get('borrar'), process.env.CURSO_PURGA_BORRAR);
    const resultados = await purgarHuerfanosDelCurso({ borrar });
    const conError = !!papelera.error || resultados.some((r) => r.error);
    return Response.json({ ok: !conError, modo: borrar ? 'borra' : 'prueba', papelera, resultados }, { status: conError ? 500 : 200 });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
