const contract = require('@truffle/contract');

const { ORACLE_START_DATE, TREASURY_START_DATE } = require('../deploy.config.ts');
const knownContracts = require('./known-contracts');

const Gold = artifacts.require('Gold');
const Bond = artifacts.require('Bond');
const Share = artifacts.require('Share');
const IERC20 = artifacts.require('IERC20');
const MockDai = artifacts.require('MockDai');
const MockLinkOracle = artifacts.require('MockLinkOracle');

const Oracle = artifacts.require('Oracle')
const Boardroom = artifacts.require('Boardroom')
const Treasury = artifacts.require('Treasury')
const SimpleERCFund = artifacts.require('SimpleERCFund')

const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');

const DAY = 86400;

async function migration(deployer, network, accounts) {
  let uniswap, uniswapRouter;
  if (['dev'].includes(network)) {
    console.log('Deploying uniswap on dev network.');
    await deployer.deploy(UniswapV2Factory, accounts[0]);
    uniswap = await UniswapV2Factory.deployed();

    await deployer.deploy(UniswapV2Router02, uniswap.address, accounts[0]);
    uniswapRouter = await UniswapV2Router02.deployed();
  } else {
    uniswap = await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network]);
    uniswapRouter = await UniswapV2Router02.at(knownContracts.UniswapV2Router02[network]);
  }

  const dai = network === 'mainnet'
    ? await IERC20.at(knownContracts.DAI[network])
    : await MockDai.deployed();

  // 2. provide liquidity to BSG-DAI and BSGS-DAI pair
  // if you don't provide liquidity to BSG-DAI and BSGS-DAI pair after step 1 and before step 3,
  //  creating Oracle will fail with NO_RESERVES error.
  const unit = web3.utils.toBN(10 ** 18).toString();
  const gold_one_usd = unit / 1000;
  const max = web3.utils.toBN(10 ** 18).muln(10000).toString();

  const gold = await Gold.deployed();
  const share = await Share.deployed();

  console.log('Approving Uniswap on tokens for liquidity');
  await Promise.all([
    approveIfNot(gold, accounts[0], uniswapRouter.address, max),
    approveIfNot(share, accounts[0], uniswapRouter.address, max),
    approveIfNot(dai, accounts[0], uniswapRouter.address, max),
  ]);

  // WARNING: msg.sender must hold enough DAI to add liquidity to BSG-DAI & BSGS-DAI pools
  // otherwise transaction will revert
  console.log('Adding liquidity to pools');
  await uniswapRouter.addLiquidity(
    gold.address, dai.address, gold_one_usd, unit, unit, unit, accounts[0], deadline(),
  );
  await uniswapRouter.addLiquidity(
    share.address, dai.address, unit, unit, unit, unit, accounts[0], deadline(),
  );

  console.log(`DAI-BSG pair address: ${await uniswap.getPair(dai.address, gold.address)}`);
  console.log(`DAI-BSGS pair address: ${await uniswap.getPair(dai.address, share.address)}`);

  // Deploy boardroom
  await deployer.deploy(Boardroom, gold.address, share.address);

  const linkOracle = network !== 'mainnet'
    ? await deployer.deploy(MockLinkOracle)
    : await MockLinkOracle.at(knownContracts.LINK_ORACLE[network]);
  
  await deployer.deploy(
    Oracle,
    uniswap.address,
    gold.address,
    dai.address,
    DAY,
    ORACLE_START_DATE,
    linkOracle.address
  );

  await deployer.deploy(SimpleERCFund);

  await deployer.deploy(
    Treasury,
    gold.address,
    Bond.address,
    Share.address,
    Oracle.address,
    Boardroom.address,
    SimpleERCFund.address,
    TREASURY_START_DATE
  );
}

async function approveIfNot(token, owner, spender, amount) {
  const allowance = await token.allowance(owner, spender);
  if (web3.utils.toBN(allowance).gte(web3.utils.toBN(amount))) {
    return;
  }
  await token.approve(spender, amount);
  console.log(` - Approved ${token.symbol ? (await token.symbol()) : token.address}`);
}

function deadline() {
  // 30 minutes
  return Math.floor(new Date().getTime() / 1000) + 1800;
}

module.exports = migration;