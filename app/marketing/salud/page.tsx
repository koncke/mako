import { redirect } from 'next/navigation';

// "Estado de Meta" se renombró y amplió a "Integraciones".
export default function SaludMetaPage() {
  redirect('/integraciones');
}
