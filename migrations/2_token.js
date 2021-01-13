// ============ Contracts ============

// Token
// deployed first
const Gold = artifacts.require('Gold')
const Bond = artifacts.require('Bond')
const Share = artifacts.require('Share')
const MockDai = artifacts.require('MockDai');

// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await Promise.all([deployToken(deployer, network, accounts)])
}

module.exports = migration

// ============ Deploy Functions ============

async function deployToken(deployer, network, accounts) {
  await deployer.deploy(Gold);
  await deployer.deploy(Bond);
  await deployer.deploy(Share);

  if (network !== 'mainnet') {
    const dai = await deployer.deploy(MockDai);
    console.log(`MockDAI address: ${dai.address}`);
  }
}
