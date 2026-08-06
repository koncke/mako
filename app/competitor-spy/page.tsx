// Competitor Spy — antes se llamaba «Market Analyst» y vivía entre los Analysts.
// Salió de ahí: no analiza un activo propio como los otros seis (una oferta, un
// anuncio, una landing), sino que VIGILA lo que hacen los demás. La `nav` key
// sigue siendo 'market-an' porque está escrita en la base.
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';

export default async function CompetitorSpyPage() {
  await requireRolWs([], { nav: 'market-an' });
  return <ComingSoon title="Competitor Spy" icon="spy" />;
}
