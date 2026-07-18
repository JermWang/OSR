const network = {
  name: 'Robinhood Chain',
  chainId: 4663,
  rpc: process.env.NEXT_PUBLIC_RH_RPC || 'https://rpc.mainnet.chain.robinhood.com',
};

async function rpc(url, method) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`${method}: ${payload.error.message}`);
  return payload.result;
}

const [chainHex, blockHex] = await Promise.all([
  rpc(network.rpc, 'eth_chainId'),
  rpc(network.rpc, 'eth_blockNumber'),
]);
const chainId = Number.parseInt(chainHex, 16);
const blockNumber = Number.parseInt(blockHex, 16);
if (chainId !== network.chainId) {
  throw new Error(`${network.name}: expected chain ${network.chainId}, received ${chainId}`);
}
if (!Number.isSafeInteger(blockNumber) || blockNumber <= 0) {
  throw new Error(`${network.name}: invalid latest block ${blockHex}`);
}
console.log(`${network.name}: chain ${chainId}, latest block ${blockNumber}`);
