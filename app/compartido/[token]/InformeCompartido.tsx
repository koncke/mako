// =============================================================================
// InformeCompartido — el informe del Dashboard que alguien compartió, en SÓLO LECTURA
// =============================================================================
// Lo monta /compartido/<token> cuando el share es del informe (`recurso: 'dashboard'`). Es el MISMO
// editor de /dashboard (app/dashboard/EditorInforme.tsx) con `compartido`: sin editar, sin Compartir,
// sin AI Analyst y sin guardar; sus pedidos de datos van a /api/compartido/graficos con el token.
//
// ⚠️ `soloLectura` VA ADEMÁS DE `compartido`, a propósito: es lo que apaga el guardado (`guardable`).
//    Quien abre el link puede tener SU sesión de MaKo, y un autoguardado que saliera a /api/graficos con
//    esa sesión le pisaría SU informe con el de otro. Las dos llaves cierran lo mismo; con una sola,
//    un cambio en la otra lo abre.
// ⚠️ Los datos de la primera pintada salen de ./informe-compartido.ts con la vista vacía y la versión 0,
//    igual que app/dashboard/page.tsx: la pantalla compara FIRMAS y no vuelve a pedir lo que ya vino.

import { Pagina } from '@/app/_ui';
import { EditorInforme } from '@/app/dashboard/EditorInforme';
import { registrarVisita } from '@/lib/shares';
import { hojaDeInforme, tableroParaLink } from './informe-reglas';
import { datosInicialesDeHoja, hoyDelInforme, leerInformeCompartido, type AccesoInforme } from './informe-compartido';

/** Lo que se ve si el informe no se pudo leer: no se abre, y se dice sin culpar a nadie. */
function NoAbrio() {
  return (
    <Pagina>
      <p style={{ margin: '64px auto', textAlign: 'center', color: 'var(--dim)', fontSize: 15 }}>
        No pudimos abrir el informe. Prueba de nuevo en un rato.
      </p>
    </Pagina>
  );
}

export default async function InformeCompartido({ informe, token, hoja: pedida }: {
  informe: AccesoInforme;
  token: string;
  /** `?hoja=` del link: la hoja que estaba abierta al compartir. Sin ella (o si ya no está), la primera. */
  hoja: string | null;
}) {
  // La visita se cuenta ANTES de leer: un informe que no se pudo leer también es alguien que entró.
  await registrarVisita(informe.acceso);
  const tablero = await leerInformeCompartido(informe);
  if (!tablero) return <NoAbrio />;
  const hoy = hoyDelInforme();
  const hoja = hojaDeInforme(tablero, pedida);
  // Los DATOS salen del informe real; al navegador va el informe con los controles de personas en alias y lo
  // que no se comparte como la tarjeta que lo dice (`tableroParaLink`). Las firmas de lo que ya vino las toma
  // la pantalla de `datosIniciales`: no se pide dos veces aunque el chip diga «Closer 1» y el pedido real «Juan».
  const { datos } = await datosInicialesDeHoja(informe, hoja, hoy);
  const inicial = tableroParaLink(tablero);

  return (
    // El mismo marco que app/dashboard/page.tsx (el porqué de cada propiedad está ahí): el que scrollea es
    // el lienzo, y la barra de controles queda pegada arriba.
    <Pagina ancho="completo" densidad="compacta" style={{ padding: 0, flex: 'none', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <EditorInforme
        inicial={inicial}
        datosIniciales={datos}
        lecturaFallo={false}
        hoy={hoy}
        hojaInicial={hoja.id}
        soloLectura
        compartido={{ token }}
      />
    </Pagina>
  );
}
