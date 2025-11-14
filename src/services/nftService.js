const fetch = require('node-fetch');
const config = require('../config/env');

/**
 * Check if a single address owns the NFT using Alchemy API
 * @param {string} address - Ethereum address to check
 * @returns {Promise<boolean>} True if address owns the NFT
 */
const checkAddressOwnsNFT = async (address) => {
  try {
    if (!address) {
      return false;
    }

    if (!config.alchemyApiKey) {
      console.error('[Alchemy] API key not configured');
      throw new Error('Alchemy API key not configured');
    }

    if (!config.nftContractAddress) {
      console.error('[Alchemy] NFT contract address not configured');
      throw new Error('NFT contract address not configured');
    }

    // Determine the Alchemy base URL based on chain
    const chainMap = {
      base: 'base-mainnet',
      ethereum: 'eth-mainnet',
      polygon: 'polygon-mainnet',
      arbitrum: 'arb-mainnet',
      optimism: 'opt-mainnet',
    };

    const chainName = chainMap[config.nftChain?.toLowerCase()] || 'base-mainnet';
    const baseUrl = `https://${chainName}.g.alchemy.com/nft/v2`;
    const url = `${baseUrl}/${config.alchemyApiKey}/isHolderOfCollection?wallet=${address}&contractAddress=${config.nftContractAddress}`;

    console.log(`[Alchemy] Checking ownership for wallet: ${address}`);

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

      // If rate limited, log but don't throw
      if (response.status === 429) {
        console.warn(`[Alchemy] API rate limited for address ${address}`);
        return false;
      }

      throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const isHolder = data.isHolderOfCollection === true;

    console.log(`[Alchemy] Wallet ${address} ownership: ${isHolder}`);

    return isHolder;
  } catch (error) {
    console.error(`[Alchemy] Error checking NFT for address ${address}:`, error.message);
    return false;
  }
};

/**
 * Check if user owns NFT by checking multiple addresses
 * Checks primary.eth_address first, then verified_addresses.eth_addresses
 * @param {Object} userData - User data from Neynar API
 * @returns {Promise<Object>} { owns: boolean, verifiedAddress: string | null }
 */
const checkNftOwned = async (userData) => {
  try {
    const addressesToCheck = [];
    const checkedAddresses = new Set();

    // First, check primary.eth_address if available
    if (
      userData.verified_addresses?.primary?.eth_address
    ) {
      const primaryAddress =
        userData.verified_addresses.primary.eth_address.toLowerCase();
      addressesToCheck.push(primaryAddress);
      checkedAddresses.add(primaryAddress);
    }

    // Then, check all addresses in verified_addresses.eth_addresses
    if (userData.verified_addresses?.eth_addresses) {
      const ethAddresses = userData.verified_addresses.eth_addresses || [];
      for (const address of ethAddresses) {
        const normalizedAddress = address.toLowerCase();
        if (!checkedAddresses.has(normalizedAddress)) {
          addressesToCheck.push(normalizedAddress);
          checkedAddresses.add(normalizedAddress);
        }
      }
    }

    // If no addresses found, return false
    if (addressesToCheck.length === 0) {
      return {
        owns: false,
        verifiedAddress: null,
      };
    }

    // Check each address sequentially until we find one with NFT
    for (const address of addressesToCheck) {
      const owns = await checkAddressOwnsNFT(address);
      if (owns) {
        return {
          owns: true,
          verifiedAddress: address,
        };
      }
    }

    // No NFT found in any address
    return {
      owns: false,
      verifiedAddress: null,
    };
  } catch (error) {
    throw new Error(`Failed to check NFT ownership: ${error.message}`);
  }
};

/**
 * Re-verify NFT ownership for a user
 * @param {Object} userData - User data (can be from DB or Neynar)
 * @returns {Promise<Object>} { owns: boolean, verifiedAddress: string | null }
 */
const reVerifyNftOwnership = async (userData) => {
  return await checkNftOwned(userData);
};

module.exports = {
  checkNftOwned,
  reVerifyNftOwnership,
  checkAddressOwnsNFT,
};

