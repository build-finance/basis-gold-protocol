const knownContracts = require('./known-contracts');
const { POOL_START_DATE } = require('../deploy.config.ts');

const Gold = artifacts.require('Gold');
const Share = artifacts.require('Share');
const Oracle = artifacts.require('Oracle');
const MockDai = artifacts.require('MockDai');

const DAIBSGLPToken_BSGSPool = artifacts.require('DAIBSGLPTokenSharePool')
const DAIBSGSLPToken_BSGSPool = artifacts.require('DAIBSGSLPTokenSharePool')

const UniswapV2Factory = artifacts.require('UniswapV2Factory');

module.exports = async (deployer, network, accounts) => {
  const uniswapFactory = ['dev'].includes(network)
    ? await UniswapV2Factory.deployed()
    : await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network]);
  const dai = network === 'mainnet'
    ? await MockDai.at(knownContracts.DAI[network])
    : await MockDai.deployed();

  const oracle = await Oracle.deployed();

  const dai_bac_lpt = await oracle.pairFor(uniswapFactory.address, Gold.address, dai.address);
  const dai_bas_lpt = await oracle.pairFor(uniswapFactory.address, Share.address, dai.address);

  await deployer.deploy(DAIBSGLPToken_BSGSPool, Share.address, dai_bac_lpt, POOL_START_DATE);
  await deployer.deploy(DAIBSGSLPToken_BSGSPool, Share.address, dai_bas_lpt, POOL_START_DATE);
};
