// =============================================================================
// /customer-success/curso/vista — el curso de un producto, como lo ve el cliente
// =============================================================================
// Es el ENSAYO del onboarding de la tab Curso (`curso_vista`, lib/tab-onboarding-catalogo.ts): la
// prueba de que el curso quedó listo es verlo con los ojos del alumno. Y sirve después de eso,
// desde «Vista del alumno» en la cabecera de la tab.
//
// ⚠️ SIN LEAD Y SIN TOKEN, A PROPÓSITO. Abrir el portal de un cliente real para esto le CREA su
// fila de `curso_accesos` y le suma un ingreso a «Entró N veces» (docs/relevo/customer-success.md,
// trampa 5). Acá se arma la MISMA vista con las funciones puras del portal (`armarModulos`, sin
// progreso) y se dibuja el MISMO `PortalAlumno` con `vistaPrevia`, que apaga todo lo que escribe
// (app/compartido/curso/[token]/vista-previa.ts). No se toca ninguna tabla del alumno.
//
// Los candados (D2, lib/curso-bloqueo.ts) se evalúan como el DÍA UNO de un alumno: hoy es el día en
// que se le abrió el curso, está en el nivel 1 y nadie le abrió nada a mano. Así lo que se abre «a los
// 7 días» o «en el nivel 3» se ve cerrado, con su motivo, que es lo que ve un alumno que recién entra.
//
// La etapa es SIEMPRE la primera, que es como lo ve un cliente el día uno —lo de adelante, cerrado—.
// ⚠️ Hasta el 08/10/2026 se elegía con un desplegable arriba a la derecha (`?etapa=`), y Martín lo pidió
//    afuera (item 2: «no entiendo por qué el desplegable de "Bienvenida"... quitalo»): se leía como un
//    selector de módulos. Un `?etapa=` viejo ya no se lee. Los videos SUBIDOS van con un link firmado
//    de vida corta: la ruta del portal pide el token de un alumno, y acá no hay ninguno.

import { requireCapa } from '@/lib/tab-access';
import { getTenantDb, adminDeWorkspaceActual } from '@/lib/workspace';
import { clasesDelProducto } from '@/lib/curso-datos';
import { urlsDeVistaPrevia } from '@/lib/curso-admin';
import { urlsAdjuntosEquipo } from '@/lib/curso-adjuntos';
import { refsEnHtml } from '@/lib/curso-adjuntos-reglas';
import { modulosDelCurso } from '@/lib/curso-modulos-datos';
import { armarModulos, conHtmlSaneado, cursoSeLista, estiloQueViaja, esClaseCerrada, type VistaAlumno } from '@/lib/curso-portal';
import { htmlsDeTareas } from '@/lib/curso';
import { estilosDeProductos } from '@/lib/curso-estilo-datos';
import { nombresDeCursos } from '@/lib/curso-nombre-datos';
import { estiloVacio } from '@/lib/curso-estilo';
import { sanearHtml } from '@/lib/html-seguro';
import { tzActual } from '@/lib/timezone';
import { hoyEnTz } from '@/lib/date-utils';
import { Pagina, EmptyState } from '@/app/_ui';
import PortalAlumno from '@/app/compartido/curso/[token]/PortalAlumno';
import { conCorrectasDelEquipo } from '@/app/compartido/curso/[token]/tarea-valores';
import { BarraVistaPrevia } from './BarraVistaPrevia';

// ⚠️ ITEM 3 DEL AUDIO DEL 08/10/2026 (02:40 y 15:40: «la vista del alumno no me aparece, tienes que
//    esperar… que aparezca un loader o que no te permita entrar hasta que se actualice»). Medido contra
//    Next 16.2.6 (node_modules/next/dist/docs, `staleTimes` y el glosario «Client Cache»): ESTA página
//    no se cachea en ningún lado — `force-dynamic`, las lecturas van por supabase-js sin `unstable_cache`
//    ni 'use cache', y el caché del router no guarda páginas dinámicas (`staleTimes.dynamic` = 0, que
//    este repo no toca). Ir con el link «Vista del alumno» la pide entera al server cada vez.
//    Lo que sí mostraba lo de antes eran DOS cosas de AFUERA de esta página:
//      · el AUTOGUARDADO con respiro de la lección: el clic en «Vista del alumno» salía antes de que se
//        escribiera lo último, y esta página leía la base sin eso. La cura es el guardado MANUAL
//        (contrato 1, `guardarLeccionAction`): lo que se ve acá es lo GUARDADO, y nada más.
//      · el ATRÁS del navegador: el glosario de Next dice que las páginas «are reused during browser
//        back/forward navigation». Volver al editor con Atrás lo redibuja con lo que trajo la PRIMERA
//        vez, y como las actions del curso no llaman a `revalidatePath` (modulos-actions.ts), nada lo
//        invalida. Es la otra mitad de «volví para atrás y se me borraron todos los campos» (16:40).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Vista del alumno · Curso' };

export default async function VistaAlumnoPage({ searchParams }: { searchParams: Promise<{ producto?: string }> }) {
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
        <EmptyState titulo="No encontré ese producto" accion={{ label: 'Volver a editar', href: '/customer-success/curso' }} />
      </Pagina>
    );
  }

  // Para DIBUJAR (la tolerante): una vista previa con las etapas de fábrica por una lectura caída es
  // un susto, no una decisión — nada de acá le abre ni le cierra nada a un alumno.
  const [cur, clases, adminId, estilos, tz, nombreCurso] = await Promise.all([
    modulosDelCurso(productoId),
    clasesDelProducto(productoId),
    adminDeWorkspaceActual(),
    // Cómo se ve el curso: la vista previa es justamente para mirar eso.
    estilosDeProductos([productoId]),
    tzActual(),
    nombresDeCursos([productoId]).catch(() => new Map<number, string>()),
  ]);
  const cfg = cur.entrega;
  // El día uno: la primera etapa del kanban (ver la cabecera).
  const etapa = cfg.etapas[0]?.key ?? null;
  const hoy = hoyEnTz(tz);
  const modulos = conHtmlSaneado(armarModulos({
    modulos: cur.modulos, etapas: cfg.etapas, actual: etapa, clases, progreso: new Map(),
    contexto: { fechas: { hoy, inicio: hoy }, nivel: 1, desbloqueos: [] },
  }), sanearHtml);

  // Los videos subidos de lo que se ve (las clases abiertas): un link firmado por cada uno.
  const pathDe = new Map(clases.map((c) => [c.id, c.videoPath]));
  const paths = modulos.flatMap((e) => e.clases)
    .flatMap((c) => (esClaseCerrada(c) || c.video?.tipo !== 'archivo' ? [] : [pathDe.get(c.id)]))
    .filter((p): p is string => !!p);
  const firmados = paths.length ? await urlsDeVistaPrevia(paths) : new Map<string, string>();
  for (const e of modulos) {
    e.clases = e.clases.map((c) => {
      if (esClaseCerrada(c) || c.video?.tipo !== 'archivo') return c;
      const url = firmados.get(pathDe.get(c.id) ?? '');
      return { ...c, video: url ? { tipo: 'directo' as const, url } : null };
    });
  }

  // ⚠️ LOS ADJUNTOS DE LAS DESCRIPCIONES (imágenes, PDF, archivos), firmados para el EQUIPO: el alumno
  // los pide con su token, y acá no hay ninguno — sin esto la vista previa salía sin imágenes y con los
  // archivos sin link, sin ningún error. Sólo los de lo que se ve (las clases abiertas). Si la firma
  // falla, el adjunto no se dibuja: la vista previa no se cae por eso.
  // También los de la consigna de cada tarea (mig 0226 y las `seccion`): sin esto, una imagen en la
  // tarea salía rota sólo en la vista previa.
  const refs = [...new Set(modulos.flatMap((e) => e.clases)
    .flatMap((c) => (esClaseCerrada(c) ? [] : [c.descripcionHtml, ...htmlsDeTareas(c)].flatMap((h) => refsEnHtml(h)))))];
  const urlsAdjuntos = refs.length
    ? await urlsAdjuntosEquipo(refs).catch((e) => { console.warn('[curso] no pude firmar los adjuntos de la vista previa:', e instanceof Error ? e.message : e); return {}; })
    : {};

  const vista: VistaAlumno = {
    nombre: null,
    // La vista previa es la del CLIENTE (sin progreso: ninguna clase por área muestra áreas, y el
    // link de agenda no aparece porque ninguna etapa está completa).
    area: null,
    // La MISMA regla que el alumno (`armarVistaAlumno`): sin clases, sólo si hay un módulo PÚBLICO
    // (item 16 del audio del 08/10/2026, 03:00: el módulo publicado y vacío tiene que aparecer, como en
    // Skool, con su «Próximamente»).
    productos: cursoSeLista(cur.modulos, clases) ? [{
      // El nombre del curso, como en el portal: el de su oferta (lib/curso-nombre.ts).
      productoId, nombre: nombreCurso.get(productoId) ?? (prod as { nombre: string }).nombre, modulos,
      // Lo mismo que le llega al alumno (`armarVistaAlumno`): las portadas de lo que se ve.
      estilo: estiloQueViaja(estilos.get(productoId) ?? estiloVacio(), modulos),
    }] : [],
  };

  // El curso va EMBEBIDO (app/_cursos/CursoUgc.tsx): toma el alto que le dejan, así que la caja
  // ocupa la ventana y lo reparte entre la barra y el curso con flex. Un `height: 100%` acá no
  // resolvería: el padre no tiene alto definido (AGENTS.md, «una vista a pantalla completa ESTIRA
  // con flex»).
  //
  // ⚠️ PUNTO 5 DEL AUDIO DEL 08/10 A LA NOCHE: la vista va con TODAS las correctas de vuelta
  //    (`conCorrectasDelEquipo`; `clases` es la de arriba, de la base y con las correctas). Sin eso la
  //    vista previa no podía corregir el quiz —lo daba por enviado, sin nota— mientras al alumno el
  //    server sí lo corregía. CUÁNDO se muestra la correcta lo decide la misma regla que al alumno.
  return (
    <div style={{ height: '100dvh', minHeight: 560, display: 'flex', flexDirection: 'column' }}>
      <BarraVistaPrevia productoId={productoId} anotar={adminId != null} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <PortalAlumno token="" vista={conCorrectasDelEquipo(vista, clases)} vistaPrevia urlsAdjuntos={urlsAdjuntos} />
      </div>
    </div>
  );
}
