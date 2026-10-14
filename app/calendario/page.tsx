// =============================================================================
// /calendario — el Calendario de MaKo: publicaciones, llamadas, bloques, el Plan y el Quarter en una pantalla
// =============================================================================
// Pedido de Martín (punto 14 de su feedback, y el 13/10/2026: «Dale, arrancá con el Calendario, pero que sea en
// otra tab, no en GENERAL»), textual: «Quiero implementar el CALENDARIO de contenidos... Aunque debería ser más que
// un calendario de contenidos, para mi debería ser "CALENDARIO" y listo... puede utilizarse para planificar
// publicaciones de Stories, Reels, Ads... organizar llamadas de ventas, de entrega de servicio... poner "bloques de
// trabajo"... Se puede combinar con lo que queremos implementar de "OBJETIVOS", el Q, el PLAN... Nos falta una vista
// de calendario. Y como siempre, que sea simple de usar, que sirva para todos los casos, que tenga IA que te ayude o
// "templates" y que no sea restrictivo.»
//
// Acá se arma la primera pintada en el server (la vista y la fecha de la URL, la zona del negocio, las cinco
// lecturas: lib/calendario.ts) y se le pasa a la pantalla (app/calendario/CalendarioApp.tsx).
//
// EL ONBOARDING SE HACE USÁNDOLA (el molde de Offer): «Tu primera semana» se cierra al agendar algo —a mano o con una
// plantilla— (app/calendario/actions.ts) y «Tu agenda de Google» (opcional) se cierra cuando la agenda se lee bien acá.
// Nada se abre solo para el onboarding desde el 14/10/2026: lo que salta al entrar es el modal de CONECTAR Google
// Calendar, si no está (Martín: «si una persona entra allí y no tiene el google calendar conectado, que salte el modal
// que tenemos en integraciones allí mismo»), y «¿Qué vas a crear hoy?» se fue entero.

import { requireRolWs } from '@/lib/tab-access';
import { Pagina } from '@/app/_ui';
import { hoyEnWorkspace } from '@/lib/timezone';
import { leerCalendario, zonaDelCalendario, type LecturaCalendario } from '@/lib/calendario';
import { esVistaCalendario, rangoDeVista } from '@/lib/calendario-modelo';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { googleCalendarConectado } from '@/lib/google-calendar';
import { CalendarioApp } from './CalendarioApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ vista?: string; fecha?: string }> }) {
  await requireRolWs([], { nav: 'calendario' });
  const sp = await searchParams;
  const [hoy, tz] = await Promise.all([hoyEnWorkspace(), zonaDelCalendario()]);
  const pedida = sp?.vista;
  const vista = esVistaCalendario(pedida) ? pedida : 'semana';
  const fecha = typeof sp?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoy;
  const rango = rangoDeVista(vista, fecha);
  // El Año no dibuja eventos (Google tampoco): no se lee nada. Sólo si hay agenda de Google conectada, para que entrar
  // por el Año sin Google también ofrezca conectarla (un fallo al preguntarlo no se afirma como «no conectada»).
  const [lectura, estado] = await Promise.all([
    vista === 'anio'
      ? googleCalendarConectado().catch(() => true).then((hay): LecturaCalendario => ({ items: [], fallos: hay ? {} : { google: 'sin-conexion' }, google: null }))
      : leerCalendario(rango.desde, rango.hasta, tz),
    getEstadoTab('calendario').catch(() => null),
  ]);

  // «Tu agenda de Google»: la prueba de vida es haberla LEÍDO (no que haya una credencial guardada).
  // (`lectura.google` sólo existe si Google contestó: el Año no lee nada y no puede cerrar este paso.)
  if (estado && !estado.steps.cal_agenda?.done && lectura.google != null) {
    await marcarPasoTab('calendario', 'cal_agenda').catch(() => null);
  }

  // La copia de Google Calendar ocupa la pantalla entera y scrollea POR DENTRO (la grilla de horas, el mes): `flex: 'none'`
  // + el alto + `overflow: hidden`, LOS TRES, como el Dashboard (Pagina trae `flex: 1`, que anula el alto; AGENTS.md).
  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CalendarioApp vista={vista} fecha={fecha} hoy={hoy} tz={tz} dias={rango.dias} items={lectura.items} fallos={lectura.fallos}
        google={lectura.google} />
    </Pagina>
  );
}
