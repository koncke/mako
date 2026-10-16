// =============================================================================
// /m/calendario — «Calendario» en el teléfono: la Agenda de portada, el Día, y crear con el «+»
// =============================================================================
// La tab de escritorio (app/calendario) es una copia fiel de Google Calendar; ésta copia la APP de Google Calendar
// para el teléfono (Android/iOS): arriba el mes que se toca para abrir el mes chico, la tira de la semana con un punto
// en los días con algo, la Programación como portada (acá se llama «Agenda», como la vista de escritorio), el Día como
// grilla de horas, el botón de hoy arriba a la derecha y el «+» flotante abajo. Destila el escritorio: las mismas
// vistas con su nombre y su orden (Día · Agenda, de `VISTAS_CALENDARIO`), los mismos colores de calendario y la MISMA
// lectura (`leerCalendario`: lo propio, el CRM, Google, el Plan, lo que se repite, los cobros y los Objetivos).
//
// Lo que se hace acá, con las server actions de escritorio (app/calendario/actions.ts, con su guard): crear un evento
// (a Google si hay dónde escribir, si no a MaKo), tildar uno propio y borrar (con Deshacer). Semana, Mes, Año,
// plantillas, agendar por Calendly, editar o mover, elegir qué calendarios se ven y conectar Google: en la computadora.
//
// Quién: la regla del Sidebar para `calendario` (sólo el admin del negocio), y las actions vuelven a mirarlo.
// ⚠️ El workspace es el del request (lo resuelven las libs); `?vista=` y `?fecha=` son las claves de escritorio
//    (`QUERY_DE_SECCION`), así un link de la computadora abre lo más parecido.
// ⚠️ La agenda de Google no pasa por ninguna IA (AGENTS.md): esta pantalla sólo la dibuja.
// ⚠️ maxDuration 60: la lectura trae TODOS los calendarios de Google, y las escrituras en Google corren desde acá.
// =============================================================================

import './calendario.css';
import { requireMovil } from '@/lib/movil-guard';
import { hoyEnWorkspace } from '@/lib/timezone';
import { leerCalendario, zonaDelCalendario, type LecturaCalendario } from '@/lib/calendario';
import { ComputadoraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { CalendarioM } from './CalendarioM';
import { fechaDeParam, queEnLaComputadora, rangoDeLectura, vistaDeParam } from './modelo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function CalendarioPagina({ searchParams }: {
  searchParams: Promise<{ vista?: string | string[]; fecha?: string | string[] }>;
}) {
  await requireMovil({ navKey: 'calendario' });
  const sp = await searchParams;
  const [hoy, tz] = await Promise.all([hoyEnWorkspace(), zonaDelCalendario()]);
  const vista = vistaDeParam(sp.vista);
  const fecha = fechaDeParam(sp.fecha, hoy);
  const rango = rangoDeLectura(fecha);

  let lectura: LecturaCalendario;
  try {
    // Cada lectura de adentro ya falla sola (queda en `fallos`); esto es la red de lo que no se esperaba.
    lectura = await leerCalendario(rango.desde, rango.hasta, tz);
  } catch (e) {
    console.error('[m/calendario] leerCalendario:', e instanceof Error ? e.message : e);
    return (
      <PantallaM>
        <ErrorM frase="No pude leer el calendario. No es nada tuyo." />
        <ComputadoraM que="Semana, Mes y plantillas" />
      </PantallaM>
    );
  }

  return (
    <PantallaM>
      {/* La clave es la URL (vista y fecha): navegar a otra arranca de cero; refrescar (la misma URL) no pisa el día
          ni la vista que la persona eligió adentro. */}
      <CalendarioM key={`${vista}:${fecha}`} vistaInicial={vista} fecha={fecha} hoy={hoy} tz={tz} rango={rango}
        items={lectura.items} fallos={lectura.fallos} google={lectura.google} />
      <ComputadoraM que={queEnLaComputadora(lectura.fallos)} />
      {/* Lo que tapa el «+» flotante: la fila de la computadora no queda debajo. */}
      <div className="m-calendario-hueco" aria-hidden />
    </PantallaM>
  );
}
