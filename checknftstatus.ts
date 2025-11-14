/**
 * Alchemy NFT Service
 *
 * Service for interacting with Alchemy's NFT API to check NFT ownership
 */

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const ALCHEMY_BASE_URL = 'https://base-mainnet.g.alchemy.com/nft/v2';

/**
 * Check if a wallet address holds any NFT from a specific collection
 *
 * @param walletAddress - The wallet address to check
 * @param contractAddress - The NFT contract address
 * @returns Promise<boolean> - True if the wallet owns at least one NFT from the collection
 */
export async function isHolderOfCollection(
  walletAddress: string,
  contractAddress: string
): Promise<boolean> {
  if (!ALCHEMY_API_KEY) {
    console.error('[Alchemy] API key not configured');
    throw new Error('Alchemy API key not configured');
  }

  try {
    const url = `${ALCHEMY_BASE_URL}/${ALCHEMY_API_KEY}/isHolderOfCollection?wallet=${walletAddress}&contractAddress=${contractAddress}`;

    console.log(`[Alchemy] Checking ownership for wallet: ${walletAddress}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Alchemy] API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const isHolder = data.isHolderOfCollection === true;

    console.log(`[Alchemy] Wallet ${walletAddress} ownership:`, isHolder);

    return isHolder;
  } catch (error) {
    console.error('[Alchemy] Error checking NFT ownership:', error);
    throw error;
  }
}
