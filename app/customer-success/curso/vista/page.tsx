// =============================================================================
// /customer-success/curso/vista — el curso de un producto, como lo ve el cliente
// =============================================================================
// Es el ENSAYO del onboarding de la tab Curso (`curso_vista`, lib/tab-onboarding-catalogo.ts): la
// prueba de que el curso quedó listo es verlo con los ojos del alumno. Y sirve después de eso,
// desde «Vista del alumno» en la cabecera de la tab.
//
// ⚠️ SIN LEAD Y SIN TOKEN, A PROPÓSITO. Abrir el portal de un cliente real para esto le CREA su
// fila de `curso_accesos` y le suma un ingreso a «Entró N veces» (docs/relevo/customer-success.md,
// trampa 5). Acá se arma la MISMA vista con las funciones puras del portal (`armarEtapas`, sin
// progreso) y se dibuja el MISMO `PortalAlumno` con `vistaPrevia`, que apaga todo lo que escribe
// (app/compartido/curso/[token]/vista-previa.ts). No se toca ninguna tabla del alumno.
//
// La etapa se elige (`?etapa=`): por defecto la primera, que es como lo ve un cliente el día uno
// —lo de adelante, cerrado—. Los videos SUBIDOS van con un link firmado de vida corta: la ruta del
// portal pide el token de un alumno, y acá no hay ninguno.

import { requireCapa } from '@/lib/tab-access';
import { getTenantDb, adminDeWorkspaceActual } from '@/lib/workspace';
import { clasesDelProducto } from '@/lib/curso-datos';
import { urlsDeVistaPrevia } from '@/lib/curso-admin';
import { entregaDeProducto } from '@/lib/entrega-servicio';
import { armarEtapas, type VistaAlumno } from '@/lib/curso-portal';
import { estilosDeProductos } from '@/lib/curso-estilo-datos';
import { estiloVacio, soloDeClases } from '@/lib/curso-estilo';
import { Pagina, EmptyState } from '@/app/_ui';
import PortalAlumno from '@/app/compartido/curso/[token]/PortalAlumno';
import { BarraVistaPrevia } from './BarraVistaPrevia';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Vista del alumno · Curso' };

export default async function VistaAlumnoPage({ searchParams }: { searchParams: Promise<{ producto?: string; etapa?: string }> }) {
  await requireCapa('customer-success');
  const sp = await searchParams;
  const productoId = Number(sp.producto) > 0 ? Number(sp.producto) : null;

  // El producto tiene que ser de ESTE workspace: `getTenantDb` pone el filtro del inquilino.
  const db = await getTenantDb();
  const { data: prod } = productoId
    ? await db.from('productos').select('id, nombre').eq('id', productoId).maybeSingle()
    : { data: null };
  if (!productoId || !prod) {
    return (
      <Pagina>
        <EmptyState titulo="No encontré ese producto" accion={{ label: 'Volver al curso', href: '/customer-success/curso' }} />
      </Pagina>
    );
  }

  const [cfg, clases, adminId, estilos] = await Promise.all([
    entregaDeProducto(productoId),
    clasesDelProducto(productoId),
    adminDeWorkspaceActual(),
    // Cómo se ve el curso: la vista previa es justamente para mirar eso.
    estilosDeProductos([productoId]),
  ]);
  const etapa = cfg.etapas.some((e) => e.key === sp.etapa) ? sp.etapa! : cfg.etapas[0]?.key ?? null;
  const etapas = armarEtapas(cfg.etapas, etapa, clases, new Map());

  // Los videos subidos de lo que se ve (las etapas abiertas): un link firmado por cada uno.
  const pathDe = new Map(clases.map((c) => [c.id, c.videoPath]));
  const paths = etapas.flatMap((e) => e.clases)
    .filter((c) => c.video?.tipo === 'archivo')
    .map((c) => pathDe.get(c.id))
    .filter((p): p is string => !!p);
  const firmados = paths.length ? await urlsDeVistaPrevia(paths) : new Map<string, string>();
  for (const e of etapas) {
    e.clases = e.clases.map((c) => {
      if (c.video?.tipo !== 'archivo') return c;
      const url = firmados.get(pathDe.get(c.id) ?? '');
      return { ...c, video: url ? { tipo: 'directo' as const, url } : null };
    });
  }

  const vista: VistaAlumno = {
    nombre: null,
    // La vista previa es la del CLIENTE (sin progreso: ninguna clase por área muestra áreas, y el
    // link de agenda no aparece porque ninguna etapa está completa).
    area: null,
    // Un producto sin clases no se le muestra al alumno (`armarVistaAlumno`): acá tampoco.
    productos: clases.length ? [{
      productoId, nombre: (prod as { nombre: string }).nombre, etapas,
      // Lo mismo que le llega al alumno (`armarVistaAlumno`): las portadas de las clases que se ven.
      estilo: soloDeClases(estilos.get(productoId) ?? estiloVacio(), new Set(etapas.flatMap((e) => e.clases.map((c) => c.id)))),
    }] : [],
  };

  // El curso va EMBEBIDO (app/_cursos/CursoUgc.tsx): toma el alto que le dejan, así que la caja
  // ocupa la ventana y lo reparte entre la barra y el curso con flex. Un `height: 100%` acá no
  // resolvería: el padre no tiene alto definido (AGENTS.md, «una vista a pantalla completa ESTIRA
  // con flex»).
  return (
    <div style={{ height: '100dvh', minHeight: 560, display: 'flex', flexDirection: 'column' }}>
      <BarraVistaPrevia
        productoId={productoId}
        etapa={etapa}
        etapas={cfg.etapas.map((e) => ({ key: e.key, label: e.label }))}
        anotar={adminId != null}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <PortalAlumno token="" vista={vista} vistaPrevia />
      </div>
    </div>
  );
}
