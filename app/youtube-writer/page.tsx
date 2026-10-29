// Content Machine · YouTube. Todavía sin backend: sale con el chip «pronto».
//
// 28/10/2026, el Copywriter (docs/diseno-copywriter.md, D7): YouTube Writer no tenía nada; el Copywriter escribe guiones
// de YouTube. Quien ya puede usar el Copywriter (hoy, sólo el super admin) va derecho ahí, con el tipo YouTube elegido.
// Los demás siguen viendo «pronto» hasta que Martín lo valide (y ese día esta fila sale de la barra: SIN_FILA).
import { redirect } from 'next/navigation';
import { ComingSoon } from '../_components/ComingSoon';
import { requireRolWs } from '@/lib/tab-access';
import { rutaConWs } from '@/lib/workspace';
import { veCopywriter } from '../copywriter/acceso';

export default async function Page() {
  await requireRolWs([], { nav: 'youtube-writer' });
  if (await veCopywriter()) redirect(await rutaConWs('/copywriter?nuevo=youtube'));
  return <ComingSoon title="YouTube Writer" icon="youtube" />;
}
