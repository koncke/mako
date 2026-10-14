// =============================================================================
// /customer-success/curso — el curso de cada servicio, y el avance de cada cliente
// =============================================================================
// Pedido de Martín (06/10/2026), textual: «implementes la tab de "CURSO" que ya teníamos en
// el workspace de Mauricio, con todo su programa… los formularios con las tareas para los
// clientes… eliminar Whop de la ecuación, que utilicemos directamente MaKo… cargar vídeos, ya
// sea con un link o subiendo el video del curso… que se mida cuánto del vídeo se vieron,
// cuáles tareas completaron».
//
// Lo que había (`/customer-success/programa`, 44 clases en código y el sync a Whop) se borró
// el 26/09 en 07d07139 porque era el temario de UN cliente escrito a mano. Esta vez el curso
// vive en la BASE (mig 0202), cuelga de las etapas de entrega de cada producto y lo arma el
// equipo desde acá: sirve a cualquier workspace, y el de Mauricio es el primero.
//
// ⚠️ TODO VIENE CON EL HTML, como en la cartera: cambiar de producto o de vista es un filtro
// sobre lo que ya llegó, sin estado de carga. Son pocas lecturas (las clases de cada producto,
// el avance de los clientes ganados) y todas indexadas por workspace.

import { redirect } from 'next/navigation';
import { requireCapa } from '@/lib/tab-access';
import { adminDeWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { clasesDelProducto, progresoDeClientes } from '@/lib/curso-datos';
import { accesosDeClientes } from '@/lib/curso-admin';
import { estilosLeidos } from '@/lib/curso-estilo-datos';
import type { EstiloCurso } from '@/lib/curso-estilo';
import { colorDeEtapa } from '@/lib/servicio-etapas';
import { filasDeModulos } from '@/lib/curso-modulos-datos';
import { nombresDeCursos } from '@/lib/curso-nombre-datos';
import { derivarModulos, type FilaModulo } from '@/lib/curso-modulos';
// ⚠️ DE lib/ Y NO DE ../trabajo: es la MISMA función (trabajo.ts la re-exporta), pero importarla
// de allá arrastra el cruce, el ruteo y el Perro al grafo de una pantalla que sólo quiere los
// nombres de los clientes (ver la cabecera de lib/clientes-ganados.ts).
import { clientesGanados } from '@/lib/clientes-ganados';
import type { Clase, Progreso } from '@/lib/curso';
import { carteraEnEntrega } from '../entrega';
import { esDelProducto } from '../pertenencia';
import { avanceDeCliente, etapaDelCliente, ordenarFilas, type FilaAvance } from './reglas';
import { CursoApp, type ServicioCurso, type VistaCurso } from './CursoApp';
import type { OnboardingCurso } from './ChecklistCurso';
import { hechosDeClases } from './onboarding-curso';
import { senalesDelPortal, sincronizarOnboardingCurso } from './onboarding-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Curso · Customer Success' };

const mensaje = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);

export default async function CursoPage({ searchParams }: { searchParams: Promise<{ producto?: string; vista?: string }> }) {
  await requireCapa('customer-success');
  const sp = await searchParams;
  const productoId = Number(sp.producto) > 0 ? Number(sp.producto) : null;
  // ⚠️ EL AVANCE DE LOS CLIENTES SE FUE DEL CURSO (item 4, Martín, 07/10/2026: «Elimina la tab de
  //    "Avance de clientes" en este lugar solo se va a editar el curso. Que esa tab esté en la ruta de
  //    clientes»). Hoy es una vista de /customer-success (Kanban · Tabla · Avance). Un link viejo
  //    (`?vista=avance`, de un marcador, de un aviso ya mandado) se REDIRIGE y no da 404, con el
  //    producto y la pestaña del cliente que se estaba mirando (`rutaConWs`: sin el `?ws=`, el super
  //    admin terminaría mirando su propio workspace).
  if (sp.vista === 'avance') {
    redirect(await rutaConWs(`/customer-success?vista=avance${productoId ? `&producto=${productoId}` : ''}`));
  }
  const inicial: { productoId: number | null; vista: VistaCurso } = { productoId, vista: 'clases' };

  // Los servicios y sus etapas: la MISMA lectura que el kanban de Customer Success, para que
  // las secciones de acá sean exactamente sus columnas y los clientes de cada producto los
  // mismos (su casa del CRM o una fila en `cliente_entrega`, ver ../pertenencia.ts).
  const entrega = await carteraEnEntrega();
  if (!entrega.ok) {
    return (
      <CursoError mensaje={entrega.error} />
    );
  }

  // Los MÓDULOS de cada curso (D1, lib/curso-modulos.ts): las etapas que son módulo y los sueltos.
  // Para DIBUJAR: si los sueltos no se pueden leer, se dibuja sin ellos (sus clases caen en «Sin
  // etapa», que es un aviso visible) y queda en el log. Lo que ESCRIBE vuelve a leer estricto.
  const filasModulos = await filasDeModulos(entrega.servicios.map((s) => s.productoId)).catch((e) => {
    console.warn('[curso] no pude leer los módulos sueltos:', mensaje(e, ''));
    return new Map<number, FilaModulo[]>();
  });
  // El nombre de cada CURSO es el de su oferta, no el del CRM (lib/curso-nombre.ts, 13/10/2026). El
  // kanban sigue nombrando el SERVICIO como el producto: acá cambia sólo el curso.
  const nombresCurso = await nombresDeCursos(entrega.servicios.map((s) => s.productoId)).catch((e) => {
    console.warn('[curso] no pude leer los nombres de los cursos:', mensaje(e, ''));
    return new Map<number, string>();
  });
  const servicios: ServicioCurso[] = entrega.servicios.map((s) => ({
    productoId: s.productoId,
    nombre: nombresCurso.get(s.productoId) ?? s.nombre,
    etapas: s.etapas.map((e) => ({ key: e.key, label: e.label, color: colorDeEtapa(e, s.fases) })),
    modulos: derivarModulos(s.etapas, filasModulos.get(s.productoId) ?? []),
  }));

  // Las clases de cada producto, en paralelo (uno a un puñado). Si una lectura falla, ESE
  // producto lo dice y los demás se dibujan: una lista vacía sobre una consulta caída le diría
  // a Mauricio que su curso no tiene clases.
  const errorClases: Record<number, string> = {};
  const [listas, senales, adminId] = await Promise.all([
    Promise.all(servicios.map(async (s) => {
      try { return await clasesDelProducto(s.productoId); } catch (e) { errorClases[s.productoId] = mensaje(e, 'Error de lectura.'); return [] as Clase[]; }
    })),
    senalesDelPortal(),
    adminDeWorkspaceActual(),
  ]);
  const clases = listas.flat();

  // ⚠️ SIN LA MARCA DE GRABAR NI EL CONTEO DE NOTAS desde el 08/10/2026 (items 13 y 15 de Martín: se
  // fueron de la tab). Las columnas y la tabla de la mig 0208 quedan; esta página ya no las lee.
  const productoIds = servicios.map((s) => s.productoId);
  // Cómo se ve cada curso (mig 0214). No tira: si no puede leer, vuelve el de siempre.
  const estilosLeidosR = await estilosLeidos(productoIds);
  const estilos: Record<number, EstiloCurso> = Object.fromEntries(estilosLeidosR.estilos);

  // ── El onboarding de la tab (regla de la casa: toda tab tiene uno) ──
  // Los pasos se DERIVAN de lo que hay y se anotan acá en cada carga (./onboarding-sync.ts), así
  // el ws1 —con su programa ya cargado— entra con «Tu programa» hecho y nada le tapa la tab. Con
  // una lectura de clases caída, un CERO no es un dato (puede ser el producto que falló): va
  // `null` y el paso no se toca.
  const hc = hechosDeClases(clases);
  const falloAlguna = Object.keys(errorClases).length > 0;
  const steps = await sincronizarOnboardingCurso({
    clases: falloAlguna && hc.clases === 0 ? null : hc.clases,
    conVideo: falloAlguna && hc.conVideo === 0 ? null : hc.conVideo,
    ...senales,
  });
  /* Esto sólo decide si se DIBUJAN los botones de editar (y la lista del onboarding, que es
     de quien arma el curso): el guard de verdad lo vuelve a hacer cada server action
     (./actions.ts). Mismo criterio que las etapas de la entrega. */
  const puedeEditar = adminId != null;
  const onboarding: OnboardingCurso | null = puedeEditar && steps ? {
    programa: !!steps.curso_programa?.done,
    vista: !!steps.curso_vista?.done,
    invitar: !!steps.curso_invitar?.done,
    invitados: senales.invitados ?? 0,
  } : null;

  // ── El avance ──
  // ⚠️ SI FALLA, FALLA VISIBLE: la vista dice «no pude leer» en vez de una tabla vacía, que se
  // leería como «nadie empezó».
  let avance: Record<number, FilaAvance[]> = {};
  let avanceError: string | null = null;
  const conAvance: Record<number, number> = {};
  try {
    const clientes = await clientesGanados();
    const ids = clientes.map((c) => c.leadId);
    const [progreso, accesos] = await Promise.all([
      progresoDeClientes(ids),
      // El acceso es lo único que puede faltar sin tumbar la tabla: sin él la columna dice «—».
      accesosDeClientes(ids).catch((e) => { console.warn('[curso] no pude leer los accesos:', mensaje(e, '')); return null; }),
    ]);

    // Cuántos clientes ya tienen algo en cada clase (lo vio o la contestó): lo dice el aviso de
    // borrar, porque el avance se va con la clase (FK en cascada, mig 0202).
    for (const m of progreso.values()) {
      for (const [claseId, p] of m) if (tieneAlgo(p)) conAvance[claseId] = (conAvance[claseId] ?? 0) + 1;
    }

    avance = Object.fromEntries(servicios.map((s, i) => {
      const keys = s.etapas.map((e) => e.key);
      const asignacion = entrega.porServicio[s.productoId] ?? {};
      const filas = clientes
        .filter((c) => esDelProducto(c.leadId, s.productoId, entrega.casaPorLead, asignacion))
        .map((c): FilaAvance => {
          const etapa = etapaDelCliente(keys, asignacion[c.leadId]?.etapa);
          const a = avanceDeCliente(listas[i], keys, etapa, progreso.get(c.leadId));
          return {
            leadId: c.leadId, nombre: c.nombre, empresa: c.empresa ?? null, etapa, ...a,
            // El email del CRM: «Invitar alumnos» del editor (./InvitarAlumnos.tsx) lo prellena.
            email: c.email ?? null,
            acceso: accesos ? (accesos.get(c.leadId) ?? { estado: 'sin-link', ingresos: 0, ultimoIngresoAt: null }) : null,
          };
        });
      return [s.productoId, ordenarFilas(filas, keys)];
    }));
  } catch (e) {
    avanceError = mensaje(e, 'Error de lectura.');
  }

  return (
    <CursoApp
      servicios={servicios}
      clases={clases}
      avance={avance}
      avanceError={avanceError}
      conAvance={conAvance}
      errorClases={errorClases}
      estilos={estilos}
      estiloError={estilosLeidosR.error}
      inicial={inicial}
      puedeEditar={puedeEditar}
      onboarding={onboarding}
    />
  );
}

/** ¿El cliente hizo ALGO en esta clase? Abrió el video o tocó la tarea. */
const tieneAlgo = (p: Progreso) => p.vistoAt != null || p.segundosMax > 0 || p.estado !== 'pendiente' || Object.keys(p.valores ?? {}).length > 0;

function CursoError({ mensaje: m }: { mensaje: string }) {
  return <CursoApp servicios={[]} clases={[]} avance={{}} avanceError={m} conAvance={{}} errorClases={{}}
    inicial={{ productoId: null, vista: 'clases' }} puedeEditar={false} errorEntrega={m} />;
}
