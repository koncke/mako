// =============================================================================
// /m/comunidad — «Comunidad» (Customer Success) en el teléfono: la comunidad tipo Skool de cada producto
// =============================================================================
// La tab de escritorio (app/customer-success/comunidad, que monta app/_comunidad/Comunidad.tsx) es un grupo
// de Skool: las pestañas Comunidad (el feed: «Escribe algo», los chips de categoría, los fijados arriba y las
// tarjetas; al costado la comunidad y el ranking de 30 días) · Calendario · Miembros (Todos · Equipo · En
// línea, con su buscador) · Ranking (los 9 niveles y las tablas de 7 días, 30 días y total) · About; a la
// derecha, la lupa, la campana y el selector de producto. El post se abre en su modal con los comentarios
// de dos niveles, el like y «Responder».
//
// Ésta lo DESTILA como el prototipo (docs/prototipos/mako-mobile-tableros.html, `comunidad`): el segmentado
// Comunidad · Miembros · Ranking (las tres de escritorio que se usan con el dedo, en su orden) y la lupa en
// la cabecera. En el feed se lee, se da like, se abre el post, se comenta y se responde, y se publica un post
// de texto (título, texto y categoría) con las MISMAS server actions de escritorio (`apiDelEquipo`). Miembros
// y Ranking, en lectura (el perfil de cada uno abre en su hoja). Calendario, About, la campana y la
// moderación (fijar, cerrar comentarios, sacar, borrar, editar, las categorías): en la computadora.
//
// Referencia: la app de Skool para iPhone. Arriba del feed la caja «Escribe algo» con tu cara, los chips de
// categoría debajo, y cada post como tarjeta (la cara con su nivel, el nombre, «hace cuánto · categoría», el
// título en negrita, dos líneas del texto y la foto; abajo el pulgar y el globo con sus números). Tocar un post
// lo abre ENTERO con los comentarios y el campo «Escribe un comentario» pegado abajo; «Responder» deja el
// @nombre puesto. Miembros es la lista con el punto verde de «en línea»; Leaderboards, la tabla con el puesto.
//
// Quién: la regla del Sidebar para `cs-comunidad` (sólo el admin). Cada action vuelve a preguntar con
// `actorDelEquipo` (sesión, plan con Customer Success y producto de este negocio), como en escritorio.
// ⚠️ El workspace es el del request (./datos.ts). `?producto=` y `?post=` son las claves de escritorio
//    (QUERY_DE_SECCION); nunca `?ws=`.
// =============================================================================

import './comunidad.css';
import { requireMovil } from '@/lib/movil-guard';
import { ComputadoraM, ErrorM, PantallaM, VacioM } from '@/app/m/_ui';
import { leerComunidad } from './datos';
import { ComunidadM } from './ComunidadM';
import { EN_LA_COMPUTADORA, R } from './modelo';

export const dynamic = 'force-dynamic';

export default async function ComunidadPagina({ searchParams }: {
  searchParams: Promise<{ producto?: string | string[]; post?: string | string[] }>;
}) {
  await requireMovil({ navKey: 'cs-comunidad' });
  const lectura = await leerComunidad(await searchParams);

  if (lectura.tipo === 'sin-productos') {
    return (
      <PantallaM>
        <VacioM frase={`${R.sinProductos}.`} />
        <ComputadoraM que="Crear un producto en el CRM" />
      </PantallaM>
    );
  }

  if (lectura.tipo === 'error') {
    return (
      <PantallaM>
        <ErrorM frase={lectura.frase} />
        <ComputadoraM que={EN_LA_COMPUTADORA} />
      </PantallaM>
    );
  }

  if (lectura.tipo === 'cerrada') {
    return (
      <PantallaM>
        <VacioM frase={lectura.frase} />
      </PantallaM>
    );
  }

  return (
    <PantallaM>
      {/* La llave es el producto: cambiarlo es otra comunidad (su feed, sus miembros, sus hojas). */}
      <ComunidadM key={lectura.productoId} productos={lectura.productos} productoId={lectura.productoId}
        comunidad={lectura.comunidad} feed={lectura.feed} postInicial={lectura.postInicial} />
      <ComputadoraM que={EN_LA_COMPUTADORA} />
    </PantallaM>
  );
}
