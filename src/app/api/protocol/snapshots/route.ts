import { handle } from '@/lib/api-util';
import { genesisMs } from '@/lib/game';
import { emissionRateAt, GENESIS_RATE_PER_SEC, HALVING_PERIOD_MS, EMISSION_RESERVE } from '@/lib/economy';

export const dynamic = 'force-dynamic';

// Emission curve series: past (actual timeline) + projected halving schedule.
export async function GET() {
  return handle(() => {
    const g = genesisMs();
    const now = Date.now();
    const points: Array<{ t: number; ratePerSec: number; distributedPct: number }> = [];
    let distributed = 0;
    for (let cycle = 0; cycle < 12; cycle++) {
      const start = g + cycle * HALVING_PERIOD_MS;
      const rate = GENESIS_RATE_PER_SEC / 2 ** cycle;
      distributed += (rate * HALVING_PERIOD_MS) / 1000;
      points.push({
        t: start,
        ratePerSec: rate,
        distributedPct: Math.min(100, (distributed / EMISSION_RESERVE) * 100),
      });
    }
    return { genesisMs: g, now, currentRatePerSec: emissionRateAt(g, now), points };
  });
}
