import { requireRolWs } from '@/lib/tab-access';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { AdsWriterApp } from './AdsWriterApp';
import { PuertaCopyGen } from './PuertaCopyGen';

export default async function AdsWriterPage() {
  await requireRolWs([], { nav: 'ads-writer' });

  // La tab abre en su onboarding mientras no esté hecho, pero NO lo reemplaza para
  // siempre: al terminar el último paso la puerta devuelve la tab SIN recargar (un
  // `router.refresh()` volvería a correr este guard y devolvería el mismo wizard).
  //
  // Estos cinco pasos —lead magnet, avatares, cara de marca, personalidad, matriz—
  // vivían en el onboarding GLOBAL y se le pedían a todo cliente nuevo antes de
  // dejarlo entrar a nada. El porqué de la mudanza está en lib/capas.ts.
  const falta = await onboardingTabPendiente('ads-writer').catch(() => false);
  if (!falta) return <AdsWriterApp />;

  // ⚠️ ACÁ NO VA `TemaOscuroScript`, Y NO ES UN OLVIDO.
  //
  // Ese script pone `data-tema="oscuro"` en el <html> antes del primer pintado, y lo
  // pone PARA SIEMPRE: lo único que lo saca es el cleanup de `TemaOscuro`, que decide
  // si sacarlo mirando si el atributo YA estaba al montarse. Con el script puesto,
  // siempre estaba — así que el cleanup no hace nada.
  //
  // En /second-brain y /video-generator eso da igual: la pantalla entera es oscura y
  // solo se sale navegando, y una navegación parsea un documento nuevo sin el atributo.
  // Acá NO: `PuertaCopyGen` sale del wizard con estado de cliente, sin navegar. El
  // atributo quedaría pegado, la tab detrás —que es clara— saldría oscura, y de ahí en
  // adelante toda la app también, incluido el cliente que eligió el tema claro.
  //
  // Así que el oscuro lo prende `TemaOscuro` DENTRO de `OnboardingCopyGen`, que se
  // desmonta al salir y ahí sí restaura lo que el cliente tenía. Se paga un cuadro de
  // fogonazo en la primera carga; se compra no dejarle la app pintada de otro color.
  return <PuertaCopyGen><AdsWriterApp /></PuertaCopyGen>;
}
