// =============================================================================
// Cron: la extracción histórica del onboarding, que nadie hacía avanzar
// =============================================================================
//
// ⚠️ EL TRABAJO EXISTÍA Y NO TENÍA QUIÉN LO EMPUJARA. `tickExtraccion()` trae el
// histórico de 365 días de un cliente nuevo —métricas de Meta, leads de formularios,
// transcripción de anuncios, análisis de guiones, llamadas de venta, métricas del
// VSL— y hasta el 03/09/2026 su ÚNICO llamador en todo el repo era `loopTicks`, un
// bucle del navegador que vive adentro de `app/onboarding/OnboardingWizard.tsx`.
//
// O sea: el trabajo avanzaba solamente mientras el cliente tuviera el wizard abierto.
// Y no podía reanudarse nunca, porque al cerrar el onboarding `status` pasa a 'done',
// `app/onboarding/page.tsx` deja de renderizar el wizard, y con él desaparece el único
// lugar de la app capaz de llamar al tick. `extraction.status` quedaba en 'running'
// para siempre, con el histórico a medias, sin error y sin síntoma.
//
// Lo tapaba un accidente: el paso `retro` iba DESPUÉS de conectar Meta y su pantalla
// era literalmente la sala de espera («todavía estoy leyendo tu histórico…», con el
// botón deshabilitado hasta que `meta_metrics` terminara). Al sacar ese paso del
// recorrido, el cliente conecta Meta en la ÚLTIMA pantalla y se va: la retención que
// mantenía vivo al bucle desapareció. El defecto de fondo era anterior; lo que cambió
// es que dejó de estar disimulado.
//
// Es la regla de la casa dos veces:
//   · «Escribir la salida no es ofrecerla: después de escribirla, preguntá QUIÉN LA
//     LLAMA». Un solo call-site, y encima en una pantalla que por diseño deja de
//     existir justo cuando el trabajo todavía está corriendo.
//   · «Todo proceso largo necesita algo que lo MIRE, no solo que lo lance».
//
// AUTH: Vercel firma el request con `Authorization: Bearer ${CRON_SECRET}`.
//
// IDEMPOTENTE, y NO por disciplina: `tickExtraccion` ya tiene un lease de 5 minutos
// (`leaseAt`) contra dos runners simultáneos, escrito el día que el problema eran dos
// pestañas del wizard. O sea que este cron y el bucle del navegador pueden convivir:
// el que llega segundo ve el lease fresco y se va sin tocar nada. Los dos drivers son
// deliberados — el del navegador avanza rápido mientras el cliente mira, y éste es el
// que garantiza que termine aunque cierre.
//
// CADA 15 MINUTOS, y el número es una decisión: parado cuesta una lista de workspaces
// y dos lecturas por cada uno con Meta, así que la frecuencia se paga casi entera en
// consultas baratas. Lo que compra es que el histórico de un cliente que acaba de
// entrar esté completo esa misma tarde en vez del día siguiente — y hasta que esté, su
// dashboard se ve vacío.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrRonda } from '@/lib/cron-workspaces';
import { getEstadoOnboarding } from '@/lib/onboarding-state';
import { tickExtraccion } from '@/lib/onboarding-extract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/** Lo mínimo que tiene que quedar para que darle el turno a un workspace sirva de algo.
 *  Un tick de 10 s no alcanza ni para un día de métricas con su pausa de 1,5 s. */
const MINIMO_MS = 30_000;

export async function GET(request: NextRequest) {
  const authFail = checkCronAuth(request);
  if (authFail) return authFail;

  const t0 = Date.now();
  // Se recorren los workspaces con META conectado, que es exactamente el conjunto que
  // puede tener una extracción viva: la arranca conectar Meta, por cualquiera de sus
  // puertas (`arrancarHistoricoEnSegundoPlano`, lib/onboarding-extract.ts; hasta el
  // 16/10/2026, sólo el wizard). Adentro se vuelve a preguntar por el estado real, así
  // que un workspace con Meta y sin extracción pendiente no cuesta nada.
  //
  // `rotacion` con clave PROPIA (no la del servicio): si dos crons de Meta comparten
  // cursor, se lo pisan y la rotación deja de repartir. Con la rotación, un cliente con
  // mucho histórico no se queda con todas las rondas.
  const ronda = await correrRonda(
    'meta',
    async (ws, deadlineMs) => {
      const est = await getEstadoOnboarding();
      if (est.extraction.status !== 'running') return { ws, saltado: 'sin extracción pendiente' };

      const restante = deadlineMs - Date.now();
      if (restante < MINIMO_MS) return { ws, saltado: 'sin tiempo en esta ronda' };

      // El presupuesto sale del tiempo que QUEDA, no de una constante: el tick se corta
      // solo al llegar a su deadline y deja el progreso guardado, así que pedirle más de
      // lo que hay lo mataría a mitad de un job.
      const nuevo = await tickExtraccion(restante - 5_000);
      const jobs = Object.entries(nuevo.extraction.jobs)
        .filter(([, j]) => j.status === 'done' || j.status === 'error').length;
      return { ws, estado: nuevo.extraction.status, jobsCerrados: jobs };
    },
    { techoMs: maxDuration * 1000, minimoMs: MINIMO_MS, rotacion: 'onboarding-extraccion' },
  );

  const trabajados = ronda.resultados.filter(
    (r) => r.ok && !(r.resultado as { saltado?: string })?.saltado,
  ).length;

  // Se loguea SIEMPRE, incluso cuando no hubo nada que hacer: «no encontré nada» y
  // «revisé y estaba todo al día» son respuestas distintas, y sin esta línea las dos
  // se ven como un cron que corrió y no dijo nada.
  console.log(
    `[cron:onboarding-extraccion] ${ronda.conectados.length} con Meta · ${trabajados} con extracción viva · ` +
    `${ronda.sinTurno.length} sin turno · ${Date.now() - t0}ms`,
  );

  return Response.json({
    ok: true,
    conMeta: ronda.conectados.length,
    trabajados,
    sinTurno: ronda.sinTurno,
    resultados: ronda.resultados,
    ms: Date.now() - t0,
  });
}
