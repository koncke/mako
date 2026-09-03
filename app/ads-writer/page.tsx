import { requireRolWs } from '@/lib/tab-access';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { puentearPasosCopyGen } from '@/lib/copygen-puente';
import { TemaOscuroScript } from '@/app/_components/TemaOscuroScript';
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
  // ⚠️ PRIMERO EL PUENTE. Los cinco pasos de esta tab vivían en el onboarding global,
  // así que el estado nuevo nace vacío y sin esto la tab figura pendiente hasta para
  // quien la completó hace meses — y con el `requiere` del Video Generator, eso lo
  // expulsa de una tab que ya usaba hacia un wizard sin salida. Ver lib/copygen-puente.ts.
  await puentearPasosCopyGen();

  const falta = await onboardingTabPendiente('ads-writer').catch(() => false);
  if (!falta) return <AdsWriterApp />;

  // Las DOS mitades del oscuro, y las dos hacen falta:
  //   · el `<script>` acá, que marca el <html> antes del primer pintado (sin él hay un
  //     fogonazo blanco de pantalla completa);
  //   · `<TemaOscuro />` DENTRO de `OnboardingCopyGen`, que se desmonta al salir del
  //     wizard y ahí restaura lo que el cliente tenía.
  //
  // ⚠️ La segunda es la que importa acá y por poco no funciona: `PuertaCopyGen` sale del
  // wizard con estado de cliente, SIN navegar, así que no hay documento nuevo que
  // limpie el atributo. Y hasta el 03/09/2026 el cleanup no podía hacer su trabajo con
  // el script puesto —creía que el oscuro era del usuario— con lo cual la tab de atrás,
  // que es clara, habría quedado oscura y de ahí en adelante toda la app. Lo que lo
  // arregla es la marca `data-tema-prestado` que ahora deja el script; el detalle está
  // en app/_components/TemaOscuroScript.tsx.
  return (
    <>
      <TemaOscuroScript />
      <PuertaCopyGen><AdsWriterApp /></PuertaCopyGen>
    </>
  );
}
