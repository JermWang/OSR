import { handle } from '@/lib/api-util';
import { protocolOverview } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(() => protocolOverview());
}
