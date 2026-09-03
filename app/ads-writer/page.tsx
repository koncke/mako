import { requireRolWs } from '@/lib/tab-access';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { AdsWriterApp } from './AdsWriterApp';
import { PuertaCopyGen } from './PuertaCopyGen';
// El Copy Generator se pinta OSCURO como el resto de Content Machine. Las dos
// mitades hacen falta: el `<script>` corre antes del primer pintado (sin él hay un
// fogonazo blanco) y el componente cliente cubre volver por navegación y apagar el
// atributo al salir. Ver app/_components/TemaOscuro.tsx.
import { TemaOscuroScript } from '@/app/_components/TemaOscuroScript';

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

  return (
    <>
      <TemaOscuroScript />
      <PuertaCopyGen><AdsWriterApp /></PuertaCopyGen>
    </>
  );
}
