// =============================================================================
// /m/stories — «Stories» (Copywriting › Stories) en el teléfono: MaKo escribe el día de stories
// =============================================================================
// La tab de escritorio (app/stories) destilada: el MISMO pedido (qué quieres lograr hoy, con los tres objetivos de
// app/stories/objetivos.ts, y la idea del día), el MISMO motor (`generarSecuenciaAction`, lib/ig-writer.ts, con su
// chequeo de que el cierre empuje al DM), la MISMA secuencia frame por frame y «Copiar la secuencia» con el mismo
// texto (app/stories/texto.ts).
//
// El historial SOBREVIVE a recargar desde el 6/11/2026 (item 129 del barrido): las últimas diez secuencias del
// workspace se guardan en `app_settings` (lib/ig-historial.ts, sin tabla nueva) y esta page las siembra. La page
// es la que las lee: el server component ya corre detrás del guard, y así la pantalla abre con la última secuencia
// a la vista en vez de vacía. Una lectura caída devuelve `[]` — se pierde el historial, no la pantalla.
//
// Referencia de app real: el visor de historias de Instagram. La secuencia se MIRA como se va a ver: un frame por
// pantalla, la barra de segmentos arriba (cuántos son y en cuál vas), tocar a la derecha pasa al siguiente y a la
// izquierda vuelve, el texto del frame grande al centro, y lo interactivo como el sticker que se pega a mano. El
// pedido es la hoja que sube desde abajo, como el compositor de Instagram.
//
// Quién: la MISMA puerta que escritorio, `requireRolWs([], { nav: 'stories' })`. Arriba, la barra de secciones de
// Copywriting con las que esa persona ve.
// ⚠️ Sin el wizard de onboarding de escritorio: la primera secuencia lo cierra (`generarSecuenciaAction` marca los
//    dos pasos), y lo que el wizard mostraba del negocio queda en una fila si el perfil está vacío.
// =============================================================================

import './stories.css';
import { requireMovil } from '@/lib/movil-guard';
import { getAnswers, getSchema } from '@/lib/onboarding';
import { PantallaM } from '@/app/m/_ui';
import { SeccionesTabM } from '@/app/m/_ui/SeccionesTabM';
import { vistaDe } from '../_creacion/secciones';
import { historialStoriesAction } from '@/app/stories/actions';
import { StoriesM } from './StoriesM';

export const dynamic = 'force-dynamic';

/** ¿El perfil del negocio tiene algo? Lo mismo que la page de escritorio cuenta como «grupo listo». */
async function perfilConDatos(): Promise<boolean> {
  try {
    const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
    return schema.some((g) => g.fields.some((f) => (answers[f.key] ?? '').trim()));
  } catch {
    // Sin perfil legible no se afirma que está vacío: la fila no se dibuja.
    return true;
  }
}

export default async function StoriesPagina() {
  const ctx = await requireMovil({ navKey: 'stories' });
  const [perfilListo, historial] = await Promise.all([perfilConDatos(), historialStoriesAction()]);
  return (
    <PantallaM>
      <SeccionesTabM tab="copywriting" activa="stories" vista={vistaDe(ctx)} />
      <StoriesM perfilListo={perfilListo} historial={historial} />
    </PantallaM>
  );
}
