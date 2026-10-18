// =============================================================================
// /m/conocimientos — «Knowledge» en el teléfono (17/10/2026). En la URL, /conocimientos. Sólo el super admin.
// =============================================================================
// El portal de formación interna: los cursos, sus clases y el video de cada una. Referencia: la app de Udemy (y la de
// Coursera) en el celular. Primero la biblioteca de cursos por categoría; un curso abre su «Contenido», con las
// secciones y las clases numeradas; una clase abre el video arriba y el resumen abajo, con Anterior / Siguiente. Es el
// portal de la computadora (app/conocimientos) destilado: el MISMO catálogo (`CURSOS_TODOS`, fuente única) con los
// MISMOS cambios del super admin (`ajustarFicha`/`aplicarAjustes` sobre las filas de la mig 0221), sin el editor.
//
// Lo que queda en la computadora, dicho en su fila: «Análisis de Negocio» (un formulario con modales) y «Branding MaKo»
// (una galería de archivos), que en escritorio no son cursos sino vistas propias (`VISTA_PROPIA`); editar un curso, y
// compartirlo.
//
// ⚠️ LA PUERTA ES LA DE ESCRITORIO: `getSesionAdmin()`, antes de leer nada.
// ⚠️ El catálogo pesa (~140 cursos con sus resúmenes): se lee en el SERVER y al teléfono viaja sólo la lista que dibuja.
// =============================================================================

import './conocimientos.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { leerAjustesConError } from '@/lib/conocimiento-ajustes-datos';
import { ajustarFicha } from '@/lib/conocimiento-ajustes';
import { CURSOS_TODOS, VISTA_PROPIA } from '@/app/conocimientos/catalogo';
import { FilaM, ListaM, PantallaM, SeccionM } from '@/app/m/_ui';
import { FilaEnComputadoraM } from '@/app/m/_ui/EnComputadoraM';

export const dynamic = 'force-dynamic';

const VISTAS_PROPIAS: readonly string[] = Object.values(VISTA_PROPIA);
const esVistaPropia = (slug: string) => VISTAS_PROPIAS.includes(slug);

export default async function ConocimientosMovil() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  await requireMovil();
  const { filas, error } = await leerAjustesConError();
  const cursos = CURSOS_TODOS.map((c) => ajustarFicha(c, filas));
  const categorias = [...new Set(cursos.map((c) => c.categoria))];
  return (
    <PantallaM>
      {error && <p className="m-conocimientos-aviso" role="status">No pude leer los cambios de los cursos: se ven como vienen.</p>}
      {categorias.map((cat) => (
        <SeccionM key={cat} titulo={cat}>
          <ListaM>
            {cursos.filter((c) => c.categoria === cat).map((c) => (esVistaPropia(c.slug)
              ? <FilaEnComputadoraM key={c.slug} icono="contexto" titulo={c.tituloCorto ?? c.titulo} href="/conocimientos"
                  motivo="No es un curso para mirar: es una herramienta con formularios y archivos que se usa en la computadora." />
              : <FilaM key={c.slug} titulo={c.tituloCorto ?? c.titulo} segunda={`${c.clases.length} clases`} href={`/m/conocimientos/${c.slug}`} />))}
          </ListaM>
        </SeccionM>
      ))}
    </PantallaM>
  );
}
