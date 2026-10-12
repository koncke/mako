// =============================================================================
// /m/landing/[id] — una landing en el teléfono: la página como una columna de secciones
// =============================================================================
// docs/diseno-mako-mobile-v2.md, «Landing Generator (reducido)», y el prototipo
// (`data-ir="landing-ed"`). Pantalla de TRABAJO (cabecera.ts → `esTrabajo`): el nombre en la
// barra, sin título grande y sin la barra de abajo. Arriba a la derecha, «Copiar el enlace
// público» (si está publicada). Abajo, «Publicar cambios», apagado si no hay nada que publicar.
//
// LA PÁGINA ES EL RENDER PÚBLICO, no un dibujo aparte: cada sección sale de `htmlDeTarjeta`
// (lib/editor-landing/render.ts, la única fábrica de HTML de una landing) con el tema de la
// landing y la hoja `CSS_CONTENIDO`, igual que las miniaturas del Panel de escritorio. Va en
// modo 'miniatura': sin enlaces, formularios ni botones de verdad, sin iframes ni videos (un
// toque no saca a nadie de MaKo ni manda un formulario de prueba). A este ancho aplica la media
// query de celular de la hoja: se ve como la ve un visitante en su teléfono. Se dibuja LO
// GUARDADO (las páginas que se publicarían, sin las secciones ocultas), no la foto publicada:
// es lo que «Publicar cambios» pondría en línea.
//
// Por qué no un iframe de la dirección pública: la página publicada carga el Pixel de MaKo, y
// abrirla desde aquí sumaría visitas propias a la analítica de la landing.
//
// Editar una sección (título, «Mejorar la escritura», imagen) NO se hace en el teléfono: en main
// eso es el editor TipTap de escritorio, y escribir el JSON de la landing a mano desde aquí sería
// otro editor. Fila gris al final.
//
// LA PUERTA: `requireMovil({ navKey: 'landing-writer' })` = admin del negocio + la tab en su capa
// (la misma de /landing-generator/<id> y de /api/landing-generator, que es por donde publica).
// LA LANDING se lee con `abrir`, que filtra por el workspace del request: una de otro negocio
// contesta «No existe» y aquí se dice como tal, sin confirmar que exista.
// =============================================================================

import '../landing.css';
import { requireMovil } from '@/lib/movil-guard';
import { ComputadoraM, ErrorM, SeccionM, VacioM } from '@/app/m/_ui';
import { abrir, temasPropiosDe } from '@/lib/editor-landing/server';
import { paginasParaPublicar } from '@/lib/editor-landing/server-reglas';
import { htmlDeTarjeta } from '@/lib/editor-landing/render';
import { CSS_CONTENIDO } from '@/lib/editor-landing/css';
import { temaPorId, urlFuentes } from '@/lib/editor-landing/temas';
import { tarjetasDe } from '@/lib/editor-landing/doc';
import type { TemaPropio } from '@/lib/editor-landing/api-tipos';
import { idDeLanding } from '../modelo';
import { AccionesLandingM } from './AccionesLandingM';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VOLVER = { rotulo: 'Volver a las landings', href: '/m/landing' };

export default async function LandingTrabajoMovil({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireMovil({ navKey: 'landing-writer' });
  const { id: crudo } = await params;
  const id = idDeLanding(crudo);
  if (id == null || ctx.ws == null) return <VacioM frase="Esa landing no está en esta cuenta." accion={VOLVER} />;

  const r = await abrir(id);
  if (!r.ok) {
    if (r.status === 404) return <VacioM frase="Esa landing no está en esta cuenta." accion={VOLVER} />;
    console.error(`[m/landing] abrir #${id}:`, r.error);
    return <ErrorM frase="No pude abrir la landing." />;
  }
  const doc = r.doc;

  // Los temas propios se leen sólo si la landing usa uno; si fallan, el tema de fábrica (como el
  // editor de escritorio, que abre igual y lo dice en el log).
  let propios: TemaPropio[] = [];
  if (doc.config.tema.startsWith('ws:')) {
    try { propios = await temasPropiosDe(ctx.ws); } catch (e) {
      console.warn(`[m/landing] #${id}: no pude leer los temas propios`, e instanceof Error ? e.message : e);
    }
  }
  const tema = temaPorId(doc.config.tema, propios);
  const fuentes = urlFuentes([tema]);

  const paginas = paginasParaPublicar(doc.contenido)
    .map((p, i) => ({
      id: p.id || String(i),
      titulo: (p.titulo ?? '').trim() || `Página ${i + 1}`,
      secciones: tarjetasDe(p)
        .map((t, j) => ({ clave: `${typeof t.attrs?.id === 'string' ? t.attrs.id : ''}-${j}`, html: htmlDeTarjeta(t, tema, { modo: 'miniatura' }) }))
        .filter((s) => s.html),
    }))
    .filter((p) => p.secciones.length);

  const publicada = !!doc.slug && !!doc.publicadoAt;
  const varias = paginas.length > 1;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_CONTENIDO }} />
      {fuentes && <link rel="stylesheet" href={fuentes} />}

      {paginas.length === 0 ? (
        <VacioM frase="La página está vacía." />
      ) : (
        paginas.map((p) => {
          const columna = (
            <div className="m-landing-pagina">
              {p.secciones.map((s) => (
                <div key={s.clave} className="m-landing-secc" dangerouslySetInnerHTML={{ __html: s.html }} />
              ))}
            </div>
          );
          // Con varias páginas, cada una con su nombre; con una sola, el nombre ya está en la barra.
          return varias
            ? <SeccionM key={p.id} titulo={p.titulo}>{columna}</SeccionM>
            : <div key={p.id} className="m-landing-sola">{columna}</div>;
        })
      )}

      <ComputadoraM que={publicada ? 'Editar, diseño y dominio' : 'Editar y publicar'} />
      {/* Al FINAL: el pie fijo deja su hueco donde se monta, y tiene que quedar debajo de todo. */}
      <AccionesLandingM
        id={doc.id}
        titulo={doc.titulo.trim() || 'Sin título'}
        url={doc.urlPublica}
        slug={publicada ? doc.slug : null}
        version={doc.version}
        cambios={doc.cambiosSinPublicar}
        sitioActivo={doc.sitioActivo}
      />
    </>
  );
}
