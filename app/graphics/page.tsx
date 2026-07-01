import { redirect } from 'next/navigation';

// "Graphics" en el sidebar entra por Marketing; Comercial es la otra sub-tab.
export default function GraphicsPage() {
  redirect('/marketing');
}
