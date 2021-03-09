import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import {
  Contract,
  ContractFactory,
  BigNumber,
  utils,
  BigNumberish,
} from 'ethers';
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json';
import UniswapV2Router from '@uniswap/v2-periphery/build/UniswapV2Router02.json';
import { Provider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { advanceTimeAndBlock } from './shared/utilities';


chai.use(solidity);

const MINUTE = 60;
const DAY = 86400;
const ETH = utils.parseEther('1');
const GOLD_PRICE_ONE = utils.parseEther('1850');
const ZERO = BigNumber.from(0);
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const INITIAL_BSG_AMOUNT = utils.parseEther('50');
const INITIAL_BSGS_AMOUNT = utils.parseEther('10000');
const INITIAL_BSGB_AMOUNT = utils.parseEther('50000');
const INITIAL_MOCKDAI_AMOUNT = utils.parseEther('92500');

async function latestBlocktime(provider: Provider): Promise<number> {
  const { timestamp } = await provider.getBlock('latest');
  return timestamp;
}

async function addLiquidity(
  provider: Provider,
  operator: SignerWithAddress,
  router: Contract,
  tokenA: Contract,
  tokenB: Contract,
  amount: BigNumber
): Promise<void> {
  await router
    .connect(operator)
    .addLiquidity(
      tokenA.address,
      tokenB.address,
      amount,
      amount,
      amount,
      amount,
      operator.address,
      (await latestBlocktime(provider)) + 1800
    );
}

function bigmin(a: BigNumber, b: BigNumber): BigNumber {
  return a.lt(b) ? a : b;
}

describe('StableFund', () => {
  const { provider } = ethers;

  let operator: SignerWithAddress;
  let ant: SignerWithAddress;

  before('provider & accounts setting', async () => {
    [operator, ant] = await ethers.getSigners();
  });

  // core
  let Bond: ContractFactory;
  let Gold: ContractFactory;
  let Share: ContractFactory;
  let StableFund: ContractFactory;
  let Treasury: ContractFactory;
  let SimpleFund: ContractFactory;
  let MockDAI: ContractFactory;
  let MockOracle: ContractFactory;
  let MockBoardroom: ContractFactory;
    // uniswap
    let Factory = new ContractFactory(
      UniswapV2Factory.abi,
      UniswapV2Factory.bytecode
    );
    let Router = new ContractFactory(
      UniswapV2Router.abi,
      UniswapV2Router.bytecode
    );

  before('fetch contract factories', async () => {
    Bond = await ethers.getContractFactory('Bond');
    Gold = await ethers.getContractFactory('Gold');
    Share = await ethers.getContractFactory('Share');
    MockDAI = await ethers.getContractFactory('MockDai')
    Treasury = await ethers.getContractFactory('Treasury');
    SimpleFund = await ethers.getContractFactory('SimpleERCFund');
    StableFund = await ethers.getContractFactory('StableFund');
    MockOracle = await ethers.getContractFactory('MockOracle');
    MockBoardroom = await ethers.getContractFactory('MockBoardroom');
  });

  let bond: Contract;
  let gold: Contract;
  let share: Contract;
  let mockdai: Contract;
  let oracle: Contract;
  let treasury: Contract;
  let boardroom: Contract;
  let fund: Contract;
  let stablefund: Contract;
  let startTime: BigNumber;
  let factory: Contract;
  let router: Contract;

  before('deploy uniswap', async () => {
    factory = await Factory.connect(operator).deploy(operator.address);
    router = await Router.connect(operator).deploy(
      factory.address,
      operator.address
    );
  });

  beforeEach('deploy contracts', async () => {
    gold = await Gold.connect(operator).deploy();
    bond = await Bond.connect(operator).deploy();
    share = await Share.connect(operator).deploy();
    mockdai = await MockDAI.connect(operator).deploy();
    oracle = await MockOracle.connect(operator).deploy();
    boardroom = await MockBoardroom.connect(operator).deploy(gold.address);
    fund = await SimpleFund.connect(operator).deploy();
    startTime = BigNumber.from(await latestBlocktime(provider)).add(DAY);

    stablefund = await StableFund.connect(operator).deploy(
      mockdai.address,
      gold.address,
      factory.address,
      router.address,
      oracle.address,
      90,
      105
    );

    await mockdai.connect(operator).mint(operator.address, ETH.mul(20));
    await mockdai.connect(operator).approve(router.address, ETH.mul(20));
    await gold.connect(operator).mint(operator.address, ETH.mul(10));
    await gold.connect(operator).approve(router.address, ETH.mul(10));

    await addLiquidity(provider, operator, router, gold, mockdai, ETH.mul(10));
 });

  describe('seigniorage', () => {
    describe('#allocateSeigniorage', () => {
        beforeEach('transfer permissions', async () => {
            await gold.mint(stablefund.address, INITIAL_BSG_AMOUNT);
            await mockdai.mint(stablefund.address, INITIAL_MOCKDAI_AMOUNT);
            await gold.mint(ant.address, INITIAL_BSG_AMOUNT);
            for await (const contract of [gold, mockdai]) {
              await contract.connect(operator).transferOperator(stablefund.address);
            }
          });

        it('should be able to sellBSGtoStable', async () => {
            const goldPrice = GOLD_PRICE_ONE.mul(80).div(100);
            await oracle.setPrice(goldPrice);
  
            console.log(goldPrice);
            await gold.connect(ant).approve(stablefund.address, 7);
            await stablefund.connect(ant).sellBSGtoStableFund(7);
  
        });

        it('should fail over 90%, sellBSGtoStable', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(95).div(100);
          await oracle.setPrice(goldPrice);

          console.log(goldPrice);
          await gold.connect(ant).approve(stablefund.address, 7);
          await stablefund.connect(ant).sellBSGtoStableFund(7);

        });

        it('should be able to sellBSGOverPeg', async () => {
            const goldPrice = GOLD_PRICE_ONE.mul(110).div(100);
            await oracle.setPrice(goldPrice);
  
            console.log("goldprice: ", goldPrice);
            const mockdaiBal = await mockdai.balanceOf(stablefund.address);
            const goldBal = await gold.balanceOf(stablefund.address);
            console.log("sfund dai balance before: ", mockdaiBal);
            console.log("sfund gold balance before: ", goldBal);
        
            await stablefund.connect(operator).approveUniSwap(gold.address, 4);
            await stablefund.connect(operator).sellBSGOverPeg(4);
  
            console.log("sfund dai balance after: ", mockdai.balanceOf(stablefund.address));
            console.log("sfund gold balance after: ", gold.balanceOf(stablefund.address));
          });
    });
  });

});
