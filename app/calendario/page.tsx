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
import { eventoDeLaUrl } from '@/lib/calendario-desde-crear';
import { leerCalendario, leerLlamadasDeVenta, leerTareasConFecha, zonaDelCalendario } from '@/lib/calendario';
import { DIAS_ADELANTE_LLAMADAS, DIAS_ATRAS_LLAMADAS, personaDelFiltro, personasDeLlamadas, type LlamadaDeVenta } from '@/lib/calendario-llamadas';
import { equipoDelCalendario, quienMiraElCalendario } from '@/lib/calendario-equipo-server';
import { esVistaCalendario, rangoDeVista, sumarDias, type ItemCalendario } from '@/lib/calendario-modelo';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { CalendarioApp } from './CalendarioApp';
import { ListaLlamadas } from './ListaLlamadas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ vista?: string; fecha?: string; evento?: string; persona?: string }> }) {
  // ⚠️ CLOSERS Y SETTERS ENTRAN (6/11/2026, la promesa a la agencia de Thiago: «las reuniones de tu equipo»), pero SÓLO a
  // «Llamadas», arrancando en las suyas (`quienMiraElCalendario`, lib/calendario-equipo-server.ts). La grilla trae la agenda de
  // Google del dueño, los cobros y los objetivos: eso sigue siendo del admin, y las acciones de la pantalla también
  // (`guard`, app/calendario/actions.ts).
  await requireRolWs(['closer', 'setter'], { nav: 'calendario' });
  const sp = await searchParams;
  const [hoy, tz, mirada] = await Promise.all([hoyEnWorkspace(), zonaDelCalendario(), quienMiraElCalendario()]);
  // «Llamadas» (24/10/2026, la llamada con Leandro, f07): la lista de citas de venta del CRM y las tareas del Plan con fecha
  // (./ListaLlamadas.tsx, copiada del «Appointment List View» de HighLevel). Lee una ventana fija, no la de una vista, y
  // nada de Google: lo que muestra es de MaKo.
  if (sp?.vista === 'llamadas' || mirada.soloLlamadas) {
    const fallos: { llamadas?: boolean; tareas?: boolean } = {};
    const [llamadas, tareas, equipo] = await Promise.all([
      leerLlamadasDeVenta(sumarDias(hoy, -DIAS_ATRAS_LLAMADAS), sumarDias(hoy, DIAS_ADELANTE_LLAMADAS), tz)
        .catch((e): LlamadaDeVenta[] => { console.error('[calendario] llamadas:', e instanceof Error ? e.message : e); fallos.llamadas = true; return []; }),
      // Las tareas del Plan, sólo para el admin: el Plan es de su pantalla.
      mirada.soloLlamadas ? Promise.resolve([] as ItemCalendario[]) : leerTareasConFecha(sumarDias(hoy, -14), sumarDias(hoy, 31), tz)
        .catch((e): ItemCalendario[] => { console.error('[calendario] tareas:', e instanceof Error ? e.message : e); fallos.tareas = true; return []; }),
      equipoDelCalendario(),
    ]);
    return (
      <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ListaLlamadas llamadas={llamadas} tareas={tareas} hoy={hoy} tz={tz} ahora={new Date().toISOString()} fallos={fallos}
          persona={personaDelFiltro(sp?.persona, mirada)} personas={personasDeLlamadas(llamadas, equipo)} soloLlamadas={mirada.soloLlamadas} />
      </Pagina>
    );
  }
  const pedida = sp?.vista;
  // Año y 4 días se fueron de la barra el 29/10/2026 (./Pestanas.tsx, los cuatro usos): sus links viejos abren el Mes y la Semana.
  const vista = pedida === 'anio' ? 'mes' : pedida === '4dias' ? 'semana' : esVistaCalendario(pedida) ? pedida : 'semana';
  const fecha = typeof sp?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoy;
  const rango = rangoDeVista(vista, fecha);
  const [lectura, estado] = await Promise.all([
    leerCalendario(rango.desde, rango.hasta, tz),
    getEstadoTab('calendario').catch(() => null),
  ]);

  // «Tu agenda de Google»: la prueba de vida es haberla LEÍDO (no que haya una credencial guardada).
  // (`lectura.google` sólo existe si Google contestó.)
  if (estado && !estado.steps.cal_agenda?.done && lectura.google != null) {
    await marcarPasoTab('calendario', 'cal_agenda').catch(() => null);
  }

  // La copia de Google Calendar ocupa la pantalla entera y scrollea POR DENTRO (la grilla de horas, el mes): `flex: 'none'`
  // + el alto + `overflow: hidden`, LOS TRES, como el Dashboard (Pagina trae `flex: 1`, que anula el alto; AGENTS.md).
  return (
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CalendarioApp vista={vista} fecha={fecha} hoy={hoy} tz={tz} dias={rango.dias} items={lectura.items} fallos={lectura.fallos}
        google={lectura.google} eventoInicial={eventoDeLaUrl(sp?.evento)}
        inicio={estado ? { semanaPendiente: !estado.steps.cal_semana?.done, onboardingPendiente: estado.status !== 'done' } : null} />
    </Pagina>
  );
}
