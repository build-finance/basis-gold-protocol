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

describe('Treasury', () => {
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

    treasury = await Treasury.connect(operator).deploy(
      gold.address,
      bond.address,
      share.address,
      oracle.address,
      boardroom.address,
      fund.address,
      stablefund.address,
      startTime
    );
    await fund.connect(operator).transferOperator(treasury.address);
  });

  describe('governance', () => {
    let newTreasury: Contract;

    beforeEach('deploy new treasury', async () => {
      newTreasury = await Treasury.connect(operator).deploy(
        gold.address,
        bond.address,
        share.address,
        oracle.address,
        boardroom.address,
        fund.address,
        stablefund.address,
        await latestBlocktime(provider)
      );

      for await (const token of [gold, bond, share]) {
        await token.connect(operator).mint(treasury.address, ETH);
        await token.connect(operator).transferOperator(treasury.address);
        await token.connect(operator).transferOwnership(treasury.address);
      }
      await boardroom.connect(operator).transferOperator(treasury.address);
    });

    describe('#initialize', () => {
      it('should works correctly', async () => {
        await treasury.connect(operator).migrate(newTreasury.address);
        await boardroom.connect(operator).transferOperator(newTreasury.address);

        await expect(newTreasury.initialize())
          .to.emit(newTreasury, 'Initialized')
          .to.emit(gold, 'Transfer')
          .withArgs(newTreasury.address, ZERO_ADDR, ETH)
          .to.emit(gold, 'Transfer');

        expect(await newTreasury.getReserve()).to.eq(ZERO);
      });

      it('should fail if newTreasury is not the operator of core contracts', async () => {
        await boardroom.connect(operator).transferOperator(ant.address);
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: need more permission'
        );
      });

      it('should fail if abuser tries to initialize twice', async () => {
        await treasury.connect(operator).migrate(newTreasury.address);
        await boardroom.connect(operator).transferOperator(newTreasury.address);

        await newTreasury.initialize();
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: initialized'
        );
      });
    });

    describe('#migrate', () => {
      it('should works correctly', async () => {
        await expect(treasury.connect(operator).migrate(newTreasury.address))
          .to.emit(treasury, 'Migration')
          .withArgs(newTreasury.address);

        for await (const token of [gold, bond, share]) {
          expect(await token.balanceOf(newTreasury.address)).to.eq(ETH);
          expect(await token.owner()).to.eq(newTreasury.address);
          expect(await token.operator()).to.eq(newTreasury.address);
        }
      });

      it('should fail if treasury is not the operator of core contracts', async () => {
        await boardroom.connect(operator).transferOperator(ant.address);
        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: need more permission');
      });

      it('should fail if already migrated', async () => {
        await treasury.connect(operator).migrate(newTreasury.address);
        await boardroom.connect(operator).transferOperator(newTreasury.address);

        await newTreasury.connect(operator).migrate(treasury.address);
        await boardroom.connect(operator).transferOperator(treasury.address);

        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: migrated');
      });
    });
  });

  describe('seigniorage', () => {
    describe('#allocateSeigniorage', () => {
      beforeEach('transfer permissions', async () => {
        await bond.mint(operator.address, INITIAL_BSGB_AMOUNT);
        await gold.mint(operator.address, INITIAL_BSG_AMOUNT);
        await gold.mint(treasury.address, INITIAL_BSG_AMOUNT);
        await share.mint(operator.address, INITIAL_BSGS_AMOUNT);
        for await (const contract of [gold, bond, share, boardroom]) {
          await contract.connect(operator).transferOperator(treasury.address);
        }
      });

      describe('before startTime', () => {
        it('should fail if not started yet', async () => {
          await expect(treasury.allocateSeigniorage()).to.revertedWith(
            'Epoch: not started yet'
          );
        });
      });

      describe('after startTime', () => {
        beforeEach('advance blocktime', async () => {
          // wait til first epoch
          await advanceTimeAndBlock(
            provider,
            startTime.sub(await latestBlocktime(provider)).toNumber()
          );
        });

        it('should funded correctly', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(210).div(100);
          await oracle.setPrice(goldPrice);

          // calculate with circulating supply
          const treasuryHoldings = await treasury.getReserve();
          const goldSupply = (await gold.totalSupply()).sub(treasuryHoldings);
          const ratio = goldPrice.mul(String(1e18)).div(GOLD_PRICE_ONE).sub(String(1e18))
          const expectedSeigniorage = (goldSupply.mul(ratio)).div(String(1e18));

          // get all expected reserve
          const expectedFundReserve = expectedSeigniorage
            .mul(await treasury.fundAllocationRate())
            .div(100);

          const expectedStableFundReserve = expectedSeigniorage.sub(expectedFundReserve)
            .mul(await treasury.stablefundAllocationRate())
            .div(100);

          const expectedTreasuryReserve = bigmin(
            expectedSeigniorage.sub(expectedFundReserve).sub(expectedStableFundReserve),
            (await bond.totalSupply()).sub(treasuryHoldings)
          );

          const expectedBoardroomReserve = expectedSeigniorage
            .sub(expectedFundReserve)
            .sub(expectedStableFundReserve)
            .sub(expectedTreasuryReserve);

          const allocationResult = await treasury.allocateSeigniorage();

          if (expectedFundReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'ContributionPoolFunded')
              .withArgs(await latestBlocktime(provider), expectedFundReserve);
          }

          if (expectedStableFundReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
            .to.emit(treasury, 'StableFundFunded')
            .withArgs(await latestBlocktime(provider), expectedStableFundReserve);
          }

          if (expectedTreasuryReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'TreasuryFunded')
              .withArgs(
                await latestBlocktime(provider),
                expectedTreasuryReserve
              );
          }

          if (expectedBoardroomReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'BoardroomFunded')
              .withArgs(
                await latestBlocktime(provider),
                expectedBoardroomReserve
              );
          }
      

                expect(await gold.balanceOf(fund.address)).to.eq(expectedFundReserve);
                expect(await gold.balanceOf(stablefund.address)).to.eq(expectedStableFundReserve);
                expect(await treasury.getReserve()).to.eq(expectedTreasuryReserve);
                expect(await gold.balanceOf(boardroom.address)).to.eq(expectedBoardroomReserve);
        });

        it('should funded even fails to call update function in oracle', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(106).div(100);
          await oracle.setRevert(true);
          await oracle.setPrice(goldPrice);

          await expect(treasury.allocateSeigniorage()).to.emit(
            treasury,
            'TreasuryFunded'
          );
        });

        it('should move to next epoch after allocation', async () => {
          const goldPrice1 = ETH.mul(106).div(100);
          await oracle.setPrice(goldPrice1);

          expect(await treasury.getCurrentEpoch()).to.eq(BigNumber.from(0));
          expect(await treasury.nextEpochPoint()).to.eq(startTime);

          await treasury.allocateSeigniorage();
          expect(await treasury.getCurrentEpoch()).to.eq(BigNumber.from(1));
          expect(await treasury.nextEpochPoint()).to.eq(startTime.add(DAY));

          await advanceTimeAndBlock(
            provider,
            Number(await treasury.nextEpochPoint()) -
              (await latestBlocktime(provider))
          );

          const goldPrice2 = ETH.mul(104).div(100);
          await oracle.setPrice(goldPrice2);

          await treasury.allocateSeigniorage();
          expect(await treasury.getCurrentEpoch()).to.eq(BigNumber.from(2));
          expect(await treasury.nextEpochPoint()).to.eq(startTime.add(DAY * 2));
        });

        describe('should fail', () => {
          it('if treasury is not the operator of core contract', async () => {
            const goldPrice = GOLD_PRICE_ONE.mul(106).div(100);
            await oracle.setPrice(goldPrice);

            for await (const target of [gold, bond, share, boardroom]) {
              await target.connect(operator).transferOperator(ant.address);
              await expect(treasury.allocateSeigniorage()).to.revertedWith(
                'Treasury: need more permission'
              );
            }
          });

          it('if seigniorage already allocated in this epoch', async () => {
            const goldPrice = GOLD_PRICE_ONE.mul(106).div(100);
            await oracle.setPrice(goldPrice);
            await treasury.allocateSeigniorage();
            await expect(treasury.allocateSeigniorage()).to.revertedWith(
              'Epoch: not allowed'
            );
          });

          describe('after migration', () => {
            it('should fail if contract migrated', async () => {
              for await (const contract of [gold, bond, share]) {
                await contract
                  .connect(operator)
                  .transferOwnership(treasury.address);
              }
    
              await treasury.connect(operator).migrate(operator.address);
              expect(await treasury.migrated()).to.be.true;
    
              await expect(treasury.allocateSeigniorage()).to.revertedWith(
                'Treasury: migrated'
              );
            });
          });
        });
      });
    });
  });

  describe('bonds', async () => {
    beforeEach('transfer permissions', async () => {
      await gold.mint(operator.address, INITIAL_BSG_AMOUNT);
      await bond.mint(operator.address, INITIAL_BSGB_AMOUNT);
      for await (const contract of [gold, bond, share, boardroom]) {
        await contract.connect(operator).transferOperator(treasury.address);
      }
    });

    describe('after migration', () => {
      it('should fail if contract migrated', async () => {
        for await (const contract of [gold, bond, share]) {
          await contract.connect(operator).transferOwnership(treasury.address);
        }

        await treasury.connect(operator).migrate(operator.address);
        expect(await treasury.migrated()).to.be.true;

        await expect(treasury.buyBonds(ETH, ETH)).to.revertedWith(
          'Treasury: migrated'
        );
        await expect(treasury.redeemBonds(ETH, ETH)).to.revertedWith(
          'Treasury: migrated'
        );
      });
    });

    describe('before startTime', () => {
      it('should fail if not started yet', async () => {
        await expect(treasury.buyBonds(ETH, ETH)).to.revertedWith(
          'Epoch: not started yet'
        );
        await expect(treasury.redeemBonds(ETH, ETH)).to.revertedWith(
          'Epoch: not started yet'
        );
      });
    });

    describe('after startTime', () => {
      beforeEach('advance blocktime', async () => {
        // wait til first epoch
        await advanceTimeAndBlock(
          provider,
          startTime.sub(await latestBlocktime(provider)).toNumber()
        );
      });

      describe('#buyBonds', () => {
        it('should work if gold price below realGoldPrice', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(90).div(100); // GOLD_PRICE_ONE * 0.9
          const goldPriceRatio = goldPrice.mul(ETH).div(GOLD_PRICE_ONE);
          await oracle.setPrice(goldPrice);
          await gold.connect(operator).transfer(ant.address, ETH);
          await gold.connect(ant).approve(treasury.address, ETH);

          await expect(treasury.connect(ant).buyBonds(ETH, goldPrice))
            .to.emit(treasury, 'BoughtBonds')
            .withArgs(ant.address, ETH);

          expect(await gold.balanceOf(ant.address)).to.eq(ZERO);
          expect(await bond.balanceOf(ant.address)).to.eq(
            ETH.mul(ETH).div(goldPriceRatio)
          );
        });

        it('should fail if gold price over realGoldPrice', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(101).div(100); // realGoldPrice * 1.01
          await oracle.setPrice(goldPrice);
          await gold.connect(operator).transfer(ant.address, ETH);
          await gold.connect(ant).approve(treasury.address, ETH);

          await expect(
            treasury.connect(ant).buyBonds(ETH, goldPrice)
          ).to.revertedWith(
            'Treasury: goldPrice not eligible for bond purchase'
          );
        });

        it('should fail if price changed', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(99).div(100); // $0.99
          await oracle.setPrice(goldPrice);
          await gold.connect(operator).transfer(ant.address, ETH);
          await gold.connect(ant).approve(treasury.address, ETH);

          await expect(
            treasury.connect(ant).buyBonds(ETH, ETH)
          ).to.revertedWith('Treasury: gold price moved');
        });

        it('should fail if purchase bonds with zero amount', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(99).div(100); // $0.99
          await oracle.setPrice(goldPrice);

          await expect(
            treasury.connect(ant).buyBonds(ZERO, goldPrice)
          ).to.revertedWith('Treasury: cannot purchase bonds with zero amount');
        });
      });
      describe('#redeemBonds', () => {
        beforeEach('allocate seigniorage to treasury', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(106).div(100);
          await oracle.setPrice(goldPrice);
          await treasury.allocateSeigniorage();
          await advanceTimeAndBlock(
            provider,
            Number(await treasury.nextEpochPoint()) -
              (await latestBlocktime(provider))
          );
        });

        it('should work if gold price exceeds realGoldPrice * 1.05', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(106).div(100);
          await oracle.setPrice(goldPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await expect(treasury.connect(ant).redeemBonds(ETH, goldPrice))
            .to.emit(treasury, 'RedeemedBonds')
            .withArgs(ant.address, ETH);

          expect(await bond.balanceOf(ant.address)).to.eq(ZERO); // 1:1
          expect(await gold.balanceOf(ant.address)).to.eq(ETH);
        });

        it("should drain over seigniorage and even contract's budget", async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(106).div(100);
          await oracle.setPrice(goldPrice);

          await gold.connect(operator).transfer(treasury.address, ETH); // $1002

          const treasuryBalance = await gold.balanceOf(treasury.address);
          await bond.connect(operator).transfer(ant.address, treasuryBalance);
          await bond.connect(ant).approve(treasury.address, treasuryBalance);
          await treasury.connect(ant).redeemBonds(treasuryBalance, goldPrice);

          expect(await bond.balanceOf(ant.address)).to.eq(ZERO);
          expect(await gold.balanceOf(ant.address)).to.eq(treasuryBalance); // 1:1
        });

        it('should fail if price changed', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(106).div(100);
          await oracle.setPrice(goldPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await expect(
            treasury.connect(ant).redeemBonds(ETH, ETH)
          ).to.revertedWith('Treasury: gold price moved');
        });

        it('should fail if redeem bonds with zero amount', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(106).div(100);
          await oracle.setPrice(goldPrice);

          await expect(
            treasury.connect(ant).redeemBonds(ZERO, goldPrice)
          ).to.revertedWith('Treasury: cannot redeem bonds with zero amount');
        });

        it('should fail if gold price is below realGoldPrice+ε', async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(104).div(100);
          await oracle.setPrice(goldPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await expect(
            treasury.connect(ant).redeemBonds(ETH, goldPrice)
          ).to.revertedWith(
            'Treasury: goldPrice not eligible for bond purchase'
          );
        });

        it("should fail if redeem bonds over contract's budget", async () => {
          const goldPrice = GOLD_PRICE_ONE.mul(106).div(100);
          await oracle.setPrice(goldPrice);

          const treasuryBalance = await gold.balanceOf(treasury.address);
          const redeemAmount = treasuryBalance.add(ETH);
          await bond.connect(operator).transfer(ant.address, redeemAmount);
          await bond.connect(ant).approve(treasury.address, redeemAmount);

          await expect(
            treasury.connect(ant).redeemBonds(redeemAmount, goldPrice)
          ).to.revertedWith('Treasury: treasury has no more budget');
        });
      });
    });
  });
});
