import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

// "Estado de Meta" se renombró y amplió a "Integraciones".
export default async function SaludMetaPage() {
  redirect(await rutaConWs('/integraciones'));
}
