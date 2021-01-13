// https://docs.basis.gold/mechanisms/yield-farming
const INITIAL_BSG_FOR_POOLS = 50;
const INITIAL_BSGS_FOR_DAI_BSG = 750000;
const INITIAL_BSGS_FOR_DAI_BSGS = 250000;

const bsgPools = [
  { contractName: 'BSGDAIPool', token: 'DAI' },
  { contractName: 'BSGBACPool', token: 'BAC' },
  { contractName: 'BSGESDPool', token: 'ESD' },
  { contractName: 'BSGDSDPool', token: 'DSD' },
  { contractName: 'BSGSXAUPool', token: 'SXAU' },
];

const bsgsPools = {
  DAIBSG: { contractName: 'DAIBSGLPTokenSharePool', token: 'DAI_BSG-LPv2' },
  DAIBSGS: { contractName: 'DAIBSGSLPTokenSharePool', token: 'DAI_BSGS-LPv2' },
}

const lpPool = { contractName: 'BSGBUILDETHPool', token: 'BUILDETH' }

module.exports = {
  INITIAL_BSG_FOR_POOLS,
  INITIAL_BSGS_FOR_DAI_BSG,
  INITIAL_BSGS_FOR_DAI_BSGS,
  bsgPools,
  bsgsPools,
  lpPool
};
