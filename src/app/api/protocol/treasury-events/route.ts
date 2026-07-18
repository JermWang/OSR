import { handle } from '@/lib/api-util';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Treasury events must come from indexed and verified mainnet contract logs.
  return handle(() => []);
}
