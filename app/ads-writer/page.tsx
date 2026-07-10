import { requireRolWs } from '@/lib/tab-access';
import { AdsWriterApp } from './AdsWriterApp';

export default async function AdsWriterPage() {
  await requireRolWs([]);
  return <AdsWriterApp />;
}
