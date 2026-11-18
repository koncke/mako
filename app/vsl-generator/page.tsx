// La `nav` key sigue siendo 'vsl-writer': está escrita en la base (estado del
// onboarding por tab y capas). Lo que cambió es el nombre y la ruta.
//
// 18/11/2026: un VSL se escribe en el Copywriter (./destino.ts). Quien lo puede usar va derecho a sus plantillas, con las
// de VSL primero, como /youtube-writer; los demás siguen viendo el «Coming soon».
import { redirect } from 'next/navigation';
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';
import { rutaConWs } from '@/lib/workspace';
import { veCopywriter } from '../copywriter/acceso';
import { destinoDelVslGenerator } from './destino';

export default async function VslGeneratorPage() {
  await requireRolWs([], { nav: 'vsl-writer' });
  const destino = destinoDelVslGenerator(await veCopywriter());
  if (destino) redirect(await rutaConWs(destino));
  return <ComingSoon title="VSL Generator" icon="video" />;
}
