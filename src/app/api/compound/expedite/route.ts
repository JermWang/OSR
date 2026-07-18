import { handle, requireSettlementReady } from '@/lib/api-util';

export async function POST() {
  return handle(() => requireSettlementReady());
}
