import { handle } from '@/lib/api-util';
import { NODE_FAMILIES } from '@/lib/economy';

export async function GET() {
  return handle(() => NODE_FAMILIES);
}
