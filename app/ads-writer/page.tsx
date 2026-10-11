import type { ReactNode } from 'react';
import { requireRolWs } from '@/lib/tab-access';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { puentearPasosCopyGen } from '@/lib/copygen-puente';
import { integracionConectada } from '@/lib/credenciales';
import { tabActivacion } from '@/lib/tab-activacion';
import { getDrafts, getScriptAnalystView } from '@/lib/ads-analyst';
import { DEFAULT_ANGLES, getAngles } from '@/lib/script-angles';
import { getAvatares } from '@/lib/script-avatares';
import { TemaOscuroScript } from '@/app/_components/TemaOscuroScript';
import { PanelActivacion } from '@/app/_components/PanelActivacion';
import { AdsWriterApp } from './AdsWriterApp';
import { AnalizarGuion } from './AnalizarGuion';
import { PuertaCopyGen } from './PuertaCopyGen';
import { SIN_CONTEO } from './analizar';
import { tabDeUrl } from './tabs';

/**
 * «Analizar guion» armado en el server: lo que se mudó de /ads-analyst el 11/10/2026 (valorar un guion
 * nuevo, el historial, sincronizar, ángulos y avatares).
 *
 * Sin Meta conectado, lo mismo que hacía Ads Analyst: el panel que la pide. Sin anuncios analizados no
 * hay contra qué valorar un guion (el perfil de la cuenta sale vacío) ni nada que sincronizar.
 *
 * Las cuatro lecturas van en paralelo y cada una cae sola: un historial que no se pudo leer no puede
 * apagar la valoración. El conteo sí avisa cuando falla (`errorLectura`): en cero, sin aviso, diría
 * «no hay guiones», que es otra cosa. De la vista de guiones viajan SÓLO el conteo y la fecha, no la
 * lista entera con sus métricas: esta vista no la dibuja.
 */
async function vistaAnalizar(): Promise<ReactNode> {
  const tab = tabActivacion('script');
  if (tab && !(await integracionConectada('meta'))) return <PanelActivacion tab={tab} />;

  const [vista, drafts, angulos, avatares] = await Promise.allSettled([
    getScriptAnalystView(), getDrafts(), getAngles(), getAvatares(),
  ]);
  return (
    <AnalizarGuion
      conteo={vista.status === 'fulfilled' ? vista.value.counts : SIN_CONTEO}
      ultimaSync={vista.status === 'fulfilled' ? vista.value.lastSync : null}
      errorLectura={vista.status === 'rejected' ? (vista.reason instanceof Error ? vista.reason.message : String(vista.reason)) : null}
      drafts={drafts.status === 'fulfilled' ? drafts.value : []}
      angulos={angulos.status === 'fulfilled' ? angulos.value : DEFAULT_ANGLES}
      avatares={avatares.status === 'fulfilled' ? avatares.value : []}
    />
  );
}

export default async function AdsWriterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRolWs([], { nav: 'ads-writer' });
  // La vista viaja en `?tab=` y se lee ACÁ, en el server (molde app/experimentos/tabs.ts): un link de
  // afuera —la capacidad de MaKo, el redirect de /ads-analyst— tiene que aterrizar en la vista que nombra.
  const tab = tabDeUrl((await searchParams).tab);

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

  // ⚠️ «Analizar guion» NO pasa por la puerta del onboarding (decisión del 11/10/2026): valorar un
  // guion, sincronizar los anuncios y editar ángulos no usan la matriz, y la puerta es un wizard SIN
  // salida — mandar ahí a alguien que llegó por el link de «valorar este guion» lo deja sin la única
  // pantalla que buscaba. Va ANTES del guard a propósito, y devuelve el mismo `<AdsWriterApp>` en la
  // misma posición que la tab sin puerta: cambiar de vista no lo remonta (no se pierde lo escrito).
  if (tab === 'analizar') return <AdsWriterApp tabInicial={tab} analizar={await vistaAnalizar()} />;

  const falta = await onboardingTabPendiente('ads-writer').catch(() => false);
  if (!falta) return <AdsWriterApp tabInicial={tab} />;

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
      <PuertaCopyGen><AdsWriterApp tabInicial={tab} /></PuertaCopyGen>
    </>
  );
}
