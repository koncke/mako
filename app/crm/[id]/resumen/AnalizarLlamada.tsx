'use client';

// =============================================================================
// El botón que manda a analizar la llamada — y el estado mientras tanto
// =============================================================================
// El trabajo NO vive acá: se dispara con un POST que responde al toque y sigue
// corriendo en el server (`after()` en /api/closing/analizar-lead). Este
// componente solo lo arranca y pinta en qué anda.
//
// Por eso el estado llega por PROP desde el server y no de un `useState`: si
// viviera en el componente, cerrar la pestaña —que es lo que se hace con el
// celular en la mano— lo perdería, y al volver la pantalla ofrecería arrancar
// otra corrida sobre algo que ya está corriendo. El `job` sale de closing_jobs,
// así que sobrevive al navegador, al refresh y a cambiar de teléfono.
//
// El polling es `router.refresh()` y no un fetch a un endpoint de estado, a
// propósito: cuando el análisis termina no hay que actualizar un cartel, hay que
// mostrar la llamada entera — y eso ya lo sabe renderizar el server component.
// Un endpoint de estado sería una segunda fuente de verdad para lo mismo.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button, Mako } from '@/app/_ui';

export type JobUI = { estado: 'corriendo' | 'listo' | 'error'; detalle: string | null } | null;

/** Cada cuánto se vuelve a preguntar mientras corre. El análisis tarda minutos:
 *  más seguido es pegarle al server sin que haya nada nuevo que mostrar. */
const CADA_MS = 5_000;

export function AnalizarLlamada({ leadId, job, hayGrabacion }: { leadId: number; job: JobUI; hayGrabacion: boolean }) {
  const router = useRouter();
  const [pendiente, arrancarTransicion] = useTransition();
  // Solo cubre el hueco entre el click y el primer refresh: apenas el server
  // contesta `corriendo`, manda el prop.
  const [recienMandado, setRecienMandado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const corriendo = job?.estado === 'corriendo' || recienMandado;

  // Mientras corre, se le vuelve a preguntar al server. El intervalo se limpia
  // solo cuando deja de correr: un `setInterval` que sobrevive al cambio de
  // estado sigue refrescando la pantalla para siempre.
  useEffect(() => {
    if (!corriendo) return;
    const t = setInterval(() => router.refresh(), CADA_MS);
    return () => clearInterval(t);
  }, [corriendo, router]);

  // Cuando el server ya dice "corriendo", el flag local sobra.
  useEffect(() => { if (job?.estado === 'corriendo') setRecienMandado(false); }, [job?.estado]);

  const analizar = async () => {
    setFallo(null);
    setRecienMandado(true);
    try {
      const r = await fetch('/api/closing/analizar-lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setRecienMandado(false);
        setFallo(j.error ?? 'No pude arrancar el análisis.');
        return;
      }
      arrancarTransicion(() => router.refresh());
    } catch {
      setRecienMandado(false);
      setFallo('No pude arrancar el análisis. Revisá la conexión y probá de nuevo.');
    }
  };

  if (corriendo) {
    // El rótulo («Revisando») sale de GRAMATICA, no de acá. La `fuente` es lo que
    // el estado exige al lado: sin ella es un spinner con otro nombre.
    return (
      <Mako
        estado="analizando"
        titulo="Escuchando la llamada"
        fuente="la grabación de Fathom"
        datos={[{ k: 'Tarda', v: 'un par de minutos' }]}
      />
    );
  }

  return (
    <div>
      {job?.estado === 'error' && job.detalle && (
        <p style={{ margin: '0 0 10px', fontSize: 14.5, lineHeight: 1.5, color: 'var(--bad)' }}>{job.detalle}</p>
      )}
      {fallo && <p style={{ margin: '0 0 10px', fontSize: 14.5, lineHeight: 1.5, color: 'var(--bad)' }}>{fallo}</p>}
      {/* `full`: la pantalla se usa parada y con una mano — un botón al ancho de
          la columna se toca sin apuntar. `loading` (y no `disabled`) para que el
          lector de pantalla anuncie el aria-busy en vez de un botón muerto. */}
      <Button onClick={analizar} loading={pendiente} variant="primary" full>
        {job?.estado === 'error' ? 'Probar de nuevo' : 'Analizar la llamada'}
      </Button>
      <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--dim)' }}>
        {hayGrabacion
          ? 'MaKo escucha la grabación y te deja acá el resumen, las objeciones y el próximo paso. Podés cerrar esta pantalla: sigue trabajando igual.'
          : 'Todavía no hay una grabación cargada para este lead. Si la reunión ya pasó, MaKo la busca igual en Fathom por el email.'}
      </p>
    </div>
  );
}
