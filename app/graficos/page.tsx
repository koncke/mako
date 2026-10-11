// =============================================================================
// /graficos — Graphics › Mis gráficos: el tablero que cada persona arma
// =============================================================================
// Pedido de Martín (10/10/2026): «quiero poder personalizar los gráficos para todos los
// usuarios, que tengan una herramienta de selector de gráficos para elegir los que quieran…
// importante que sean funcionales, reales» y, el mismo día, «poder elegir gráficos y atarle
// datos… Puedes copiar la app de Google Data Studio para esto».
//
// El catálogo está en lib/graficos-catalogo.ts, el lector en lib/graficos-datos.ts y el
// tablero de cada persona en lib/graficos-tablero.ts. Acá sólo se arma la primera pintada:
// el tablero y los datos de todos sus gráficos, en el server, así la pantalla abre llena.

import { Pagina } from '@/app/_ui';
import { GraphicsTabs } from '../_components/GraphicsTabs';
import { FechaFiltro } from '../_components/FechaFiltro';
import { requireRolWs } from '@/lib/tab-access';
import { diasAntes, esFechaValida, hoyEnTijuana } from '@/lib/date-utils';
import { leerTablero } from '@/lib/graficos-tablero';
import { datosDeTablero } from '@/lib/graficos-datos';
import { integracionConectada } from '@/lib/credenciales';
import { EditorGraficos } from './EditorGraficos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  await requireRolWs([], { nav: 'graphics' });

  const hoy = hoyEnTijuana();
  const p = await searchParams;
  const valido = !!p.desde && !!p.hasta && esFechaValida(p.desde) && esFechaValida(p.hasta) && p.desde <= p.hasta;
  // Por defecto los últimos 30 días, como /marketing. Un rango que termina después de hoy se
  // ACOTA a hoy en vez de tirarse entero (que es lo que hace /marketing, sin avisar).
  const desde = valido ? p.desde! : diasAntes(hoy, 29);
  const hasta = valido ? (p.hasta! > hoy ? (hoy < desde ? desde : hoy) : p.hasta!) : hoy;

  const [lectura, metaConectada] = await Promise.all([leerTablero(), integracionConectada('meta').catch(() => false)]);
  const datos = await datosDeTablero(lectura.tablero.graficos, desde, hasta);

  return (
    <Pagina ancho="completo">
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', margin: '-34px -44px 22px', padding: '34px 44px 0', borderBottom: '1px solid var(--border)' }}>
        <GraphicsTabs />
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingBottom: 12 }}>
          <FechaFiltro hoyReal={hoy} />
        </div>
      </header>
      {/* Sin `key` por rango a propósito: cambiar las fechas no puede remontar el editor y
          llevarse un cambio que todavía no se guardó. El editor vuelve a pedir los datos solo. */}
      <EditorGraficos
        inicial={lectura.tablero}
        datosIniciales={datos}
        lecturaFallo={lectura.estado === 'error'}
        metaConectada={metaConectada}
        desde={desde}
        hasta={hasta}
      />
    </Pagina>
  );
}
