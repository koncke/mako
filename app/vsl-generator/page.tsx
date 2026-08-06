// La `nav` key sigue siendo 'vsl-writer': está escrita en la base (estado del
// onboarding por tab y capas). Lo que cambió es el nombre y la ruta.
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function VslGeneratorPage() {
  await requireRolWs([], { nav: 'vsl-writer' });
  return <ComingSoon title="VSL Generator" icon="video" />;
}
