// Media Buyer (/ads-manager) mientras carga: EL loader de las tabs grandes (app/_ui/CargandoMako.tsx, 23/10/2026). Sin esto, el clic en la barra
// dejaba la pantalla anterior quieta hasta que el server terminaba. ⚠️ Un loading.tsx es un Suspense: va en la lista
// blanca de tests/layout-sin-suspense.test.ts y sólo en segmentos privados.
import { CargandoMako } from '@/app/_ui/CargandoMako';

export default function Cargando() {
  return <CargandoMako que="Marketing CoPilot" />;
}
