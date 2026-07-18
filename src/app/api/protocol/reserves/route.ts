import { handle } from '@/lib/api-util';
import { reservesView } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(() => reservesView());
}
