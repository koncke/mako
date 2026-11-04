// =============================================================================
// /dashboard — la tab Dashboard: el editor de informes, de punta a punta
// =============================================================================
// Pedido de Martín (11/10/2026): «Elimina las tab de Marketing y Comercial que hay por
// defecto... Todo la tab de Dashboard debe ser el editable, no lo pongas como un recuadro
// abajo. Elimina la topbar, el título de la tab...». Marketing y Comercial son ahora las dos
// HOJAS del informe inicial, y sus rutas viejas traen acá con `?hoja=` (app/marketing/page.tsx,
// app/comercial/page.tsx).
//
// El catálogo está en lib/graficos-catalogo.ts, el lector en lib/graficos-datos.ts y el informe de cada
// persona en lib/graficos-tablero.ts (los bloques de antes se convierten en gráficos en el saneo,
// lib/graficos-migrar-v5.ts: no se lee ninguno). Acá sólo se arma
// la primera pintada: el informe y los datos de la hoja que se abre, en el server, así la pantalla
// abre llena.
//
// ⚠️ LOS PEDIDOS SALEN DE `pedidosDeHoja` (./exportar.ts), la MISMA función que usa la pantalla, con
//    la vista vacía y la versión 0. Si esto armara los suyos, la firma de lo que ya llegó no coincidiría
//    con la de la pantalla y cada gráfico se pediría dos veces al abrir.
//
// Desde el 11/10/2026 (Closing, Ads y Landing Analyst se retiraron de la sidebar y traen acá):
//   · `?hoja=` se resuelve con `hojaDestino` (lib/graficos-plantillas.ts): el id exacto, la hoja que
//     tiene la firma de la plantilla pedida, o la plantilla AGREGADA al informe (EditorInforme la suma
//     y la guarda). Antes caía en la primera hoja sin avisar.
//   · EL CLOSER entra (decisión 6 de Martín) y ve SÓLO la hoja Closing: un informe EN MEMORIA con la
//     plantilla de ids fijos, sin editar ni guardar (`soloLectura`). No se lee su informe guardado: no
//     tiene uno que pueda tocar. /api/graficos le contesta sólo lo de Closing.
//   · `?llamada=<recording_id>` abre la ficha de esa llamada (la ruta vieja era /closing?call=).
//
// TANDA v5 (12/10/2026):
//   · LA VERSIÓN de lo que se leyó (`leerTablero().version`) baja a la pantalla: el autoguardado la manda y la
//     ruta escribe con compare-and-set (lib/graficos-tablero.ts). El closer no guarda: null.
//   · Lo que arranca PLEGADO (una sección con «Arranca plegada», lib/graficos-secciones.ts) no se pide en la
//     primera pintada: se pide al abrirse (`pedidosDeHoja` con `ocultos`, la MISMA cuenta que la pantalla).
//   · EL SETTER entra como el closer (decisión de la tanda: «El setter ve SÓLO la hoja Chat Analyst»): un rol
//     con hoja ÚNICA (`HOJA_DE_ROL`, lib/graficos-plantillas.ts) recibe el informe EN MEMORIA con esa hoja, sin
//     editar, y sólo si su negocio compró la capa que la hoja pide (Closing / WhatsApp).
//
// EL DASHBOARD UNIDO (17/10/2026, lib/dashboard-focus.ts): Home sale de la sidebar y el Dashboard abre en la hoja fija
// «Focus», que es lo que era /general (./FocusDeGeneral.tsx). Son DOS informes y siguen siéndolo: esta página elige qué
// editor monta según `?hoja=` (`informeDePedida`) y a cada uno le da las hojas del otro para la tira de arriba. Sólo
// para quien veía /general (el admin con la capa que incluye General); el closer y el setter, como siempre.
// ⚠️ Los dos editores llevan `key` con su informe: pasar de Focus a una hoja es una navegación a la MISMA ruta, y sin
//    la key React reusaría el editor con el estado del otro informe.

import { redirect } from 'next/navigation';
import { Pagina } from '@/app/_ui';
import { homeDeCapa, requireRolWs } from '@/lib/tab-access';
import { getCapaActual, getRolWsEfectivo, rutaConWs } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { sinSuHoja } from './redireccion';
import { hoyEnTijuana } from '@/lib/date-utils';
import { leerInformeGeneral, leerTablero, type LecturaTablero } from '@/lib/graficos-tablero';
import { hojaDeRol, hojaDestino, informeDeRol, llamadaDeUrl } from '@/lib/graficos-plantillas';
import { datosDeGraficos } from '@/lib/graficos-datos';
import type { Hoja, Tablero } from '@/lib/graficos-catalogo';
import { ocultosPorPlegado, plegadasDeEntrada } from '@/lib/graficos-secciones';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { informeGeneralInicial } from '@/lib/general-plantillas';
import { PARAM_PLANTILLAS, hojaGeneralPedida, informeDePedida, type HojaCorta } from '@/lib/dashboard-focus';
import { PLANTILLAS_GENERAL } from '@/lib/general-plantillas';
import { EditorInforme } from './EditorInforme';
import { FocusDeGeneral } from './FocusDeGeneral';
import { textoProbar } from '@/lib/experimentos-catalogo';
import { pedidosDeHoja } from './exportar';
import { conQueAnalizaElClosing, CONECTA_TU_CLAUDE_CLOSING } from '@/lib/closing';
import { accionDeLaHojaClosing, avisoDeLaHojaClosing, esHojaClosing } from './aviso-closing';
import { iaCaidaParaLaHoja } from '@/lib/closing-ia-caida';
import { avisoDeIaCaida } from '@/lib/closing-ia-caida-reglas';
import { agendaParaElClosing } from '@/lib/closing-diseno-server';
import { agendaParaComercial } from '@/lib/comercial-diseno-server';
import { etapasDeLaEntregaEnOrden } from '@/lib/cs-diseno-server';
import { variablesDeQuienMira } from '../general/datos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Busqueda = { hoja?: string | string[]; llamada?: string | string[]; probar?: string | string[]; plantillas?: string | string[] };

const corta = (h: Hoja): HojaCorta => ({ id: h.id, nombre: h.nombre, emoji: h.emoji });
/** Las hojas que la tira muestra de un informe: ninguna si la persona no armó ninguna (el inicial viaja por dentro). */
const hojasDe = (l: LecturaTablero): Hoja[] => (l.estado === 'inicial' || l.tablero.enBlanco ? [] : l.tablero.hojas);

export default async function Page({ searchParams }: { searchParams: Promise<Busqueda> }) {
  await requireRolWs(['closer', 'setter'], { nav: 'graphics' });
  // Cacheado por request (lib/auth.ts): no es una consulta más.
  const rol = await getRolWsEfectivo();
  const unica = hojaDeRol(rol);
  // Cacheada por request, como el rol.
  const capa = await getCapaActual();
  // Lo único que el closer (o el setter) ve acá es SU hoja: si su negocio no compró esa capa, esto no es para él.
  // ⚠️ Lo hace ANTES el layout (./layout.tsx: en una carga directa, un redirect debajo de ./loading.tsx va en el stream,
  //    React #310); éste queda para cuando se llega navegando. La MISMA decisión (`sinSuHoja`, ./redireccion.ts).
  if (sinSuHoja(rol, capa)) redirect(await rutaConWs(homeDeCapa(capa)));
  // Focus: quien veía /general (`requireRolWs([], { nav: 'general' })`: el admin, con la capa que lo incluye).
  const conFocus = rol === 'admin' && tabEnCapa('general', capa);

  // Lo que se sabe del negocio para que la galería ponga primero sus sugeridas (lib/plantillas-sugeridas.ts). Arranca
  // YA y se espera al final: corre en paralelo con el informe y los datos. El closer y el setter no ven la galería.
  const senales = unica ? Promise.resolve(null) : senalesDelNegocio().catch(() => null);
  const hoy = hoyEnTijuana();
  const p = await searchParams;
  const pedida = Array.isArray(p.hoja) ? p.hoja[0] : p.hoja;
  const llamada = llamadaDeUrl(p.llamada);
  // `?probar=` (17/10/2026): un link viejo de /experimentos con su hipótesis abre «Editar con MaKo» con «Probemos…».
  const probar = textoProbar(p.probar);
  // `?plantillas=1`: «Templates» desde Focus. Abre el Dashboard con la galería.
  const plantillas = p[PARAM_PLANTILLAS] != null;

  // Con Focus se leen los DOS informes (dos filas de app_settings, en paralelo): la tira muestra las hojas de los dos.
  const [lecturaDash, lecturaGeneral] = conFocus ? await Promise.all([leerTablero(), leerInformeGeneral()]) : [null, null];
  if (lecturaDash && lecturaGeneral && !plantillas) {
    const idsGeneral = (lecturaGeneral.tablero.hojas.length ? lecturaGeneral.tablero.hojas : informeGeneralInicial().hojas).map((h) => h.id);
    if (informeDePedida(pedida, idsGeneral, lecturaDash.tablero.hojas.map((h) => h.id), true, PLANTILLAS_GENERAL.map((x) => x.id)) === 'general') {
      return (
        <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <FocusDeGeneral lectura={lecturaGeneral} hojaPedida={hojaGeneralPedida(pedida, idsGeneral)} plantillaPedida={pedida} hoy={hoy} hojasDashboard={hojasDe(lecturaDash).map(corta)} senales={senales} />
        </Pagina>
      );
    }
  }
  // Las hojas de General para la tira del Dashboard: en blanco, sólo Focus (su inicial).
  const otrasDeGeneral: HojaCorta[] | null = lecturaGeneral
    ? (hojasDe(lecturaGeneral).length ? hojasDe(lecturaGeneral) : informeGeneralInicial().hojas.slice(0, 1)).map(corta)
    : null;

  let tablero: Tablero;
  let lecturaFallo = false;
  let version: string | null = null;
  let hoja: Hoja;
  let agregar: Hoja | null = null;
  let lleno = false;
  // Quien nunca guardó un informe arranca SIN páginas (12/10/2026, Martín: «si es un usuario que nunca creó una
  // página en dashboard, que no le salga ninguna página, que le salga todo en blanco abajo con la opción de crear
  // una»). El inicial queda sólo por dentro (la pantalla lee `hojas[0]`) y no se le muestra.
  let sinPaginas = false;
  const enMemoria = informeDeRol(rol);
  if (enMemoria) {
    tablero = enMemoria;
    hoja = tablero.hojas[0];
  } else {
    const lectura = lecturaDash ?? await leerTablero();
    tablero = lectura.tablero;
    lecturaFallo = lectura.estado === 'error';
    version = lectura.version;
    const destino = hojaDestino(tablero, pedida);
    agregar = destino.agregar;
    lleno = !!destino.lleno;
    hoja = agregar ?? tablero.hojas.find((h) => h.id === destino.hojaId) ?? tablero.hojas[0];
    if (lectura.estado === 'inicial') {
      // Si llegó pidiendo una (`?hoja=`, las rutas viejas de los Analysts), ésa es su primera y ÚNICA página, y se
      // guarda al abrir como cualquier hoja agregada. Si no pidió nada, la pantalla en blanco.
      const pedidaHoja = pedida ? (agregar ?? tablero.hojas.find((h) => h.id === destino.hojaId) ?? null) : null;
      if (pedidaHoja) { tablero = { ...tablero, hojas: [] }; agregar = pedidaHoja; hoja = pedidaHoja; lleno = false; }
      else sinPaginas = true;
    } else if (tablero.enBlanco && !agregar) {
      // Se eliminaron todas las hojas (quedaron en Archivados): la pantalla en blanco, como quien nunca armó una.
      sinPaginas = true;
    }
  }
  const pedidos0 = pedidosDeHoja(hoja, {}, hoy, 0, ocultosPorPlegado(hoja.componentes, plegadasDeEntrada(hoja.componentes)));
  // En blanco no se dibuja ningún gráfico: no se lee nada.
  const graficos = sinPaginas ? [] : pedidos0.graficos;
  // El período va TAL CUAL: el corte en hoy (y la fecha que mira hacia adelante) lo decide `datosDeGraficos`
  // (contrato v5, «el corte en hoy en UN lugar»). La firma sale del período que pidió el gráfico.
  // La hoja «Closing» sin con qué analizar las llamadas (IA12, ./aviso-closing.ts): se pregunta sólo si el informe tiene
  // una, en paralelo con los datos. Sin poder saberlo, 'no-se': no se avisa.
  const hayHojaClosing = !sinPaginas && (tablero.hojas.some((h) => esHojaClosing(h)) || esHojaClosing(agregar));
  const conClosing = hayHojaClosing
    ? conQueAnalizaElClosing().catch(() => 'no-se' as const)
    : Promise.resolve(null);
  // Y con SU clave caída (sin crédito, borrada: lib/closing-ia-caida.ts), la causa y el paso para arreglarlo (27/10/2026).
  const caidaClosing = hayHojaClosing ? iaCaidaParaLaHoja() : Promise.resolve(null);
  // La hoja Closing con DISEÑO PROPIO (la copia de Halden, app/dashboard/disenos/HojaClosing.tsx) lee además la agenda
  // del CRM (las llamadas que vienen) y quién mira (el saludo). La agenda nombra leads: NO para el closer ni el setter
  // (`unica`, su hoja sin los leads); el saludo sí.
  const hayDiseno = (id: string) => !sinPaginas && (tablero.hojas.some((h) => h.diseno?.id === id) || agregar?.diseno?.id === id);
  const hayDisenoClosing = hayDiseno('closing');
  // La de Cobranza (la copia de Coffer, app/dashboard/disenos/HojaCobranza.tsx) saluda a quien mira, como Coffer.
  const hayDisenoCobranza = hayDiseno('cobranza');
  // La de Comercial (la copia de Selvar, app/dashboard/disenos/HojaComercial.tsx) lee las llamadas de venta de HOY (su «Hoy», que
  // nombra leads: tampoco para el closer ni el setter) y saluda a quien mira.
  const hayDisenoComercial = hayDiseno('comercial');
  // La de Marketing (la copia de Kestrel, app/dashboard/disenos/HojaMarketing.tsx) sólo saluda a quien mira: lo demás sale de sus piezas.
  const hayDisenoMarketing = hayDiseno('marketing');
  // La de Landing (la copia de Corbel, app/dashboard/disenos/HojaLanding.tsx), igual: sólo saluda a quien mira.
  const hayDisenoLanding = hayDiseno('landing');
  // La de Chat Analyst (la copia de Parley, app/dashboard/disenos/HojaChat.tsx), igual: sólo saluda a quien mira. Es también la hoja
  // del setter (`HOJA_DE_ROL`): lo que dibuja sale de sus piezas, que ya son de sus conjuntos.
  const hayDisenoChat = hayDiseno('chat');
  // La de Automatizaciones (la copia de Noria, app/dashboard/disenos/HojaAutomatizaciones.tsx), igual: sólo saluda a quien mira.
  const hayDisenoAutomatizaciones = hayDiseno('automatizaciones');
  // La de CS Analyst (la copia de Mender, app/dashboard/disenos/HojaCs.tsx) saluda y lee el ORDEN de las etapas de la entrega
  // (lib/cs-diseno-server.ts): los carriles van en el orden del servicio, no del que más clientes tiene al que menos.
  const hayDisenoCs = hayDiseno('cs');
  const etapasCs = hayDisenoCs ? etapasDeLaEntregaEnOrden() : Promise.resolve(null);
  const agendaComercial = hayDisenoComercial && !unica ? agendaParaComercial(hoy) : Promise.resolve(null);
  const agendaClosing = hayDisenoClosing && !unica ? agendaParaElClosing(hoy) : Promise.resolve(null);
  const quienClosing = hayDisenoClosing || hayDisenoCobranza || hayDisenoComercial || hayDisenoMarketing || hayDisenoLanding || hayDisenoChat || hayDisenoAutomatizaciones || hayDisenoCs
    ? variablesDeQuienMira().then((q) => ({ saludo: q.saludo ?? 'Hola', nombre: q.nombre ?? '', fecha: q.fecha ?? '' })).catch(() => null)
    : Promise.resolve(null);
  const [datos, senalesNegocio, closing, caida, agenda, quien, agendaHoy, etapas] = await Promise.all([
    datosDeGraficos(graficos.map(({ pedido }) => pedido)), senales, conClosing, caidaClosing, agendaClosing, quienClosing, agendaComercial, etapasCs,
  ]);

  return (
    // ⚠️ `flex: 'none'` + el alto + `overflow: hidden`, LOS TRES. Pagina trae `flex: 1` (base 0%), que en
    // la columna del layout ANULA el `height`: el <main> se estiraba a su contenido (2405 px medidos), el
    // que scrolleaba era el documento y la barra de controles —sticky contra .lk-lienzo— se iba con la
    // página (y = -1079 tras la rueda). Con esto el que scrollea es .lk-lienzo y la barra queda en y = 46.
    // `dvh` y no `vh`: en el celular, 100vh incluye la barra del navegador y el pie queda abajo de ella.
    // El PDF lo desarma en el @media print de ./editor-css.ts.
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <EditorInforme
        key="dashboard"
        inicial={tablero}
        datosIniciales={datos}
        lecturaFallo={lecturaFallo}
        hoy={hoy}
        hojaInicial={hoja.id}
        versionInicial={version}
        hojaAgregada={agregar}
        aviso={lleno ? 'Máximo de hojas' : null}
        soloLectura={!!unica}
        llamadaInicial={llamada}
        probarInicial={unica ? null : probar}
        sinPaginas={sinPaginas}
        senales={senalesNegocio}
        unido={otrasDeGeneral ? { otras: otrasDeGeneral } : null}
        plantillasInicial={plantillas && !unica}
        avisoClosing={avisoDeLaHojaClosing(closing, CONECTA_TU_CLAUDE_CLOSING, avisoDeIaCaida(caida))}
        accionClosing={accionDeLaHojaClosing(closing)}
        disenos={hayDisenoClosing || hayDisenoCobranza || hayDisenoComercial || hayDisenoMarketing || hayDisenoLanding || hayDisenoChat || hayDisenoAutomatizaciones || hayDisenoCs ? {
          closing: hayDisenoClosing ? { agenda, quien } : null,
          cobranza: hayDisenoCobranza ? { quien } : null,
          comercial: hayDisenoComercial ? { agenda: agendaHoy, quien } : null,
          marketing: hayDisenoMarketing ? { quien } : null,
          landing: hayDisenoLanding ? { quien } : null,
          chat: hayDisenoChat ? { quien } : null,
          automatizaciones: hayDisenoAutomatizaciones ? { quien } : null,
          cs: hayDisenoCs ? { quien, etapas } : null,
        } : null}
      />
    </Pagina>
  );
}
