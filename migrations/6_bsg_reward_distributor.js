const { bsgPools, lpPool, INITIAL_BSG_FOR_POOLS } = require('./pools');

// Pools
// deployed first
const Gold = artifacts.require('Gold')
const InitialGoldDistributor = artifacts.require('InitialGoldDistributor');

// ============ Main Migration ============

module.exports = async (deployer, network, accounts) => {
  const unit = web3.utils.toBN(10 ** 18);
  const initialGoldAmount = unit.muln(INITIAL_BSG_FOR_POOLS).toString();

  const gold = await Gold.deployed();
  const pools = bsgPools.map(({contractName}) => artifacts.require(contractName));
  const LPPool = artifacts.require(lpPool['contractName']);
  const bsgLPPool = await LPPool.deployed();
  console.log(`address: ${bsgLPPool.address}`)

  await deployer.deploy(
    InitialGoldDistributor,
    gold.address,
    pools.map(p => p.address),
    bsgLPPool.address,
    initialGoldAmount,
  );
  const distributor = await InitialGoldDistributor.deployed();

  console.log(`Setting distributor to InitialGoldDistributor (${distributor.address})`);
  for await (const poolInfo of pools) {
    const pool = await poolInfo.deployed()
    await pool.setRewardDistribution(distributor.address);
  }

  bsgLPPool.setRewardDistribution(distributor.address);

  await gold.mint(distributor.address, initialGoldAmount);
  console.log(`Deposited ${INITIAL_BSG_FOR_POOLS} BSG to InitialGoldDistributor.`);

  await distributor.distribute();
}
