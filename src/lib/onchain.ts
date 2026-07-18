import { createPublicClient, erc20Abi, formatEther, formatUnits, getAddress, http } from 'viem';
import {
  CHAIN,
  OSR_GAME_ADDRESS,
  OSR_TOKEN_ADDRESS,
  OSR_TREASURY_ADDRESS,
  OSR_VAULT_ADDRESS,
  isConfiguredAddress,
} from './config';

const client = createPublicClient({
  transport: http(CHAIN.rpcUrl),
});

export async function onchainReserves() {
  if (!isConfiguredAddress(OSR_TOKEN_ADDRESS)) return [];

  const token = getAddress(OSR_TOKEN_ADDRESS);
  const holders = [
    ['Game Contract', OSR_GAME_ADDRESS],
    ['Vault Contract', OSR_VAULT_ADDRESS],
    ['Treasury', OSR_TREASURY_ADDRESS],
  ] as const;
  const configured = holders.filter((entry) => isConfiguredAddress(entry[1]));
  const [decimals, symbol, tokenBalances, ethBalances] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
    Promise.all(
      configured.map(([, address]) =>
        client.readContract({
          address: getAddress(address),
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [getAddress(address)],
        })
      )
    ),
    Promise.all(configured.map(([, address]) => client.getBalance({ address: getAddress(address) }))),
  ]);

  return configured.flatMap(([walletLabel, walletAddress], index) => [
    {
      walletLabel,
      walletAddress: getAddress(walletAddress),
      assetSymbol: symbol,
      balanceUi: Number(formatUnits(tokenBalances[index], decimals)),
    },
    {
      walletLabel,
      walletAddress: getAddress(walletAddress),
      assetSymbol: 'ETH',
      balanceUi: Number(formatEther(ethBalances[index])),
    },
  ]);
}
