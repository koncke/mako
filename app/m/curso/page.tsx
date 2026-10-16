// =============================================================================
// /m/curso — «Curso» (Customer Success) en el teléfono: el curso, sus módulos y sus clases
// =============================================================================
// La tab de escritorio (app/customer-success/curso) es el EDITOR del curso con el dibujo de
// Conocimientos: arriba el curso que se mira (la lista «Cursos» del menú de la marca), los MÓDULOS en su
// orden (las etapas de la entrega que son módulo y los sueltos, con «Sin módulo» al final si quedaron
// clases huérfanas) y en cada uno sus clases como tarjetas, con sus chips (Sin video · Tarea ·
// Obligatoria · el candado) y sus minutos. El menú «…» de cada clase tiene, entre otras cosas, el ACCESO:
// Público | Privado. Desde el 07/10/2026 la tab «sólo edita el curso» (Martín: «Elimina la tab de "Avance
// de clientes" en este lugar»): el avance de cada cliente es la vista Avance de Clientes.
//
// Ésta lo DESTILA en ese orden: el curso (una fila que abre «Cursos» si hay más de uno), cada módulo
// como sección con su conteo, cada clase como fila con los MISMOS chips y sus minutos. Tocar una clase
// abre su hoja: el Acceso (Público | Privado, con «Se abre…» si es privada), que se guarda con la MISMA
// action de escritorio y deja «Acceso cambiado» con Deshacer, y el avance de ESA clase entre los alumnos
// del producto, en lectura (Terminada · Visto: «3 de 8»). Editar la clase (título, video, descripción,
// tarea), la estructura (módulos, mover, portadas, eliminar), el estilo, la Vista del alumno e Invitar
// alumnos: en la computadora.
//
// Referencia: el Classroom de Skool en su app (el curso arriba con su selector; cada módulo con cuántas
// lecciones tiene y cada lección como fila con su duración; lo cerrado con su marca —acá el ojo tachado,
// que icons.tsx no tiene candado—; el permiso de una lección se cambia en su hoja, no arrastrando nada).
// La hoja de la clase copia la de un ítem de Ajustes de iPhone: el segmentado arriba y los datos abajo.
//
// Quién: la regla del Sidebar para `cs-curso` (sólo el admin), y `guardarBloqueoAction` vuelve a mirar
// que sea admin del workspace y que el producto sea suyo (app/customer-success/curso/puerta-curso.ts).
// ⚠️ El workspace es el del request (./datos.ts: todo lee con getTenantDb). `?producto=` es la clave de
//    escritorio (QUERY_DE_SECCION) y la lee la pantalla; nunca `?ws=`.
// ⚠️ La lección se GUARDA A MANO en escritorio (audio del 08/10/2026): por eso el teléfono no edita nada
//    de la lección; lo único que cambia es el acceso, que en escritorio tampoco pasa por «Guardar».
// =============================================================================

import './curso.css';
import { requireMovil } from '@/lib/movil-guard';
import { ComputadoraM, ErrorM, PantallaM, VacioM } from '@/app/m/_ui';
import { leerCursos } from './datos';
import { CursoM } from './CursoM';
import { EN_LA_COMPUTADORA, R } from './modelo';

export const dynamic = 'force-dynamic';

export default async function CursoPagina() {
  await requireMovil({ navKey: 'cs-curso' });
  const lectura = await leerCursos();

  if (!lectura.ok) {
    console.error('[m/curso] carteraEnEntrega:', lectura.error);
    return (
      <PantallaM>
        <ErrorM frase={`${R.sinLeerServicios}.`} />
        <ComputadoraM que={EN_LA_COMPUTADORA} />
      </PantallaM>
    );
  }

  if (!lectura.cursos.length) {
    return (
      <PantallaM>
        <VacioM frase={`${R.sinServicios}.`} accion={{ rotulo: R.irAClientes, href: '/m/cs' }} />
      </PantallaM>
    );
  }

  return (
    <PantallaM>
      <CursoM cursos={lectura.cursos} puedeEditar={lectura.puedeEditar} />
      <ComputadoraM que={EN_LA_COMPUTADORA} />
    </PantallaM>
  );
}
