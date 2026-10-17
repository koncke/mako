// =============================================================================
// /m/stories — «Stories» (Copywriting › Stories) en el teléfono: MaKo escribe el día de stories
// =============================================================================
// La tab de escritorio (app/stories) destilada: el MISMO pedido (qué quieres lograr hoy, con los tres objetivos de
// app/stories/objetivos.ts, y la idea del día), el MISMO motor (`generarSecuenciaAction`, lib/ig-writer.ts, con su
// chequeo de que el cierre empuje al DM), la MISMA secuencia frame por frame y «Copiar la secuencia» con el mismo
// texto (app/stories/texto.ts). Como en escritorio, las secuencias de la sesión viven en la pantalla: no hay
// historial guardado (StoriesApp.tsx dice por qué).
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
import { nombreTab, seccionesTabM, vistaDe } from '../_creacion/secciones';
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
  const secciones = seccionesTabM('copywriting', vistaDe(ctx));
  const perfilListo = await perfilConDatos();
  return (
    <PantallaM>
      <SeccionesTabM etiqueta={nombreTab('copywriting')} secciones={secciones} activa="stories" />
      <StoriesM perfilListo={perfilListo} />
    </PantallaM>
  );
}
