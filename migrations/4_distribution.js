const knownContracts = require('./known-contracts');
const { bsgPools, lpPool } = require('./pools');
const { POOL_START_DATE } = require('../deploy.config.ts');

// Tokens
// deployed first
const Gold = artifacts.require('Gold');
const MockDai = artifacts.require('MockDai');

// ============ Main Migration ============
module.exports = async (deployer, network, accounts) => {
  for await (const { contractName, token } of bsgPools) {
    const tokenAddress = knownContracts[token][network] || MockDai.address;
    if (!tokenAddress) {
      // network is mainnet, so MockDai is not available
      throw new Error(`Address of ${token} is not registered on migrations/known-contracts.js!`);
    }

    const contract = artifacts.require(contractName);
    await deployer.deploy(contract, Gold.address, tokenAddress, POOL_START_DATE);
  }

  // LP token, using MockDai during testing instead of the actual uniswap LP token
  const tokenAddress = knownContracts[lpPool['token']][network] || MockDai.address;
  const contract = artifacts.require(lpPool['contractName']);
  await deployer.deploy(contract, Gold.address, tokenAddress, POOL_START_DATE);
};
