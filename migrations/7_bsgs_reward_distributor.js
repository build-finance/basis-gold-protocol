const {
  bsgsPools,
  INITIAL_BSGS_FOR_DAI_BSG,
  INITIAL_BSGS_FOR_DAI_BSGS,
} = require('./pools');

// Pools
// deployed first
const Share = artifacts.require('Share');
const InitialShareDistributor = artifacts.require('InitialShareDistributor');

// ============ Main Migration ============

async function migration(deployer, network, accounts) {
  const unit = web3.utils.toBN(10 ** 18);
  const totalBalanceForDAIBSG = unit.muln(INITIAL_BSGS_FOR_DAI_BSG)
  const totalBalanceForDAIBSGS = unit.muln(INITIAL_BSGS_FOR_DAI_BSGS)
  const totalBalance = totalBalanceForDAIBSG.add(totalBalanceForDAIBSGS);

  const share = await Share.deployed();

  const lpPoolDAIBSG = artifacts.require(bsgsPools.DAIBSG.contractName);
  const lpPoolDAIBSGS = artifacts.require(bsgsPools.DAIBSGS.contractName);

  await deployer.deploy(
    InitialShareDistributor,
    share.address,
    lpPoolDAIBSG.address,
    totalBalanceForDAIBSG.toString(),
    lpPoolDAIBSGS.address,
    totalBalanceForDAIBSGS.toString(),
  );
  const distributor = await InitialShareDistributor.deployed();

  await share.mint(distributor.address, totalBalance.toString());
  console.log(`Deposited ${INITIAL_BSGS_FOR_DAI_BSG} BSGS to InitialShareDistributor.`);

  console.log(`Setting distributor to InitialShareDistributor (${distributor.address})`);
  await lpPoolDAIBSG.deployed().then(pool => pool.setRewardDistribution(distributor.address));
  await lpPoolDAIBSGS.deployed().then(pool => pool.setRewardDistribution(distributor.address));

  await distributor.distribute();
}

module.exports = migration;
