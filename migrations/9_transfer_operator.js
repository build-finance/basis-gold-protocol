const Boardroom = artifacts.require('Boardroom');
const Treasury = artifacts.require('Treasury');
const Gold = artifacts.require('Gold');
const Bond = artifacts.require('Bond');
const Share = artifacts.require('Share');
const Timelock = artifacts.require('Timelock');

const DAY = 86400;

module.exports = async (deployer, network, accounts) => {
  const gold = await Gold.deployed();
  const share = await Share.deployed();
  const bond = await Bond.deployed();
  const treasury = await Treasury.deployed();
  const boardroom = await Boardroom.deployed();
  const timelock = await deployer.deploy(Timelock, accounts[0], 2 * DAY);

  for await (const contract of [ gold, share, bond ]) {
    await contract.transferOperator(treasury.address);
    await contract.transferOwnership(treasury.address);
  }
  await boardroom.transferOperator(treasury.address);
  await boardroom.transferOwnership(timelock.address);
  await treasury.transferOperator(timelock.address);
  await treasury.transferOwnership(timelock.address);

  console.log(`Transferred the operator role from the deployer (${accounts[0]}) to Treasury (${Treasury.address})`);
}
