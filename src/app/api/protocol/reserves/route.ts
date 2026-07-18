import { handle } from '@/lib/api-util';
import { onchainReserves } from '@/lib/onchain';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(() => onchainReserves());
}
