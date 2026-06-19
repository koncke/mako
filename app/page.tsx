import { redirect } from 'next/navigation';

// La "home" del rediseño es la Vista General.
export default function Home() {
  redirect('/general');
}
