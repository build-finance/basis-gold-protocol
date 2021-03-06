# Basis Gold

[![Twitter Follow](https://img.shields.io/twitter/follow/basisgold?label=Follow)](https://twitter.com/GoldBasis)
[![License](https://img.shields.io/github/license/Basis-Gold/basisgoldprotocol)](https://github.com/build-finance/basis-gold-protocol/blob/master/LICENSE)
[![Coverage Status](https://coveralls.io/repos/github/Basis-Gold/basisgold-protocol/badge.svg?branch=master)](https://coveralls.io/github/Basis-Gold/basisgold-protocol?branch=master)

Basis Gold is a lightweight implementation of the [Basis Protocol](basis.io) on Ethereum. 

## Addresses

- BSG: `0xB34Ab2f65c6e4F764fFe740ab83F982021Faed6d`
- BSGS: `0xA9d232cC381715aE791417B624D7C4509D2c28DB`
- BSGB: `0x940c7ccD1456b29A6F209B641fB0edAa96a15C2D`
- BUILD: `0x6e36556b3ee5aa28def2a8ec3dae30ec2b208739`

## History of Basis 

Basis is an algorithmic stablecoin protocol where the money supply is dynamically adjusted to meet changes in money demand.  

- When demand is rising, the blockchain will create more Basis Gold. The expanded supply is designed to bring the Basis price back down.
- When demand is falling, the blockchain will buy back Basis Gold. The contracted supply is designed to restore Basis price.
- The Basis protocol is designed to expand and contract supply similarly to the way central banks buy and sell fiscal debt to stabilize purchasing power. For this reason, we refer to Basis Gold as having an algorithmic central bank.

Read the [Basis Whitepaper](http://basis.io/basis_whitepaper_en.pdf) for more details into the protocol. 

Basis was shut down in 2018, due to regulatory concerns its Bond and Share tokens have security characteristics. The project team opted for compliance, and shut down operations, returned money to investors and discontinued development of the project. 

## The Basis Gold Protocol

Basis Gold differs from the original Basis Project in several meaningful ways: 

1. **Rationally simplified** - several core mechanisms of the Basis protocol has been simplified, especially around bond issuance and seigniorage distribution. We've thought deeply about the tradeoffs for these changes, and believe they allow significant gains in UX and contract simplicity, while preserving the intended behavior of the original monetary policy design. 
2. **Censorship resistant** - we launch this project anonymously, protected by the guise of characters from the popular SciFi series Rick and Morty. We believe this will allow the project to avoid the censorship of regulators that scuttled the original Basis Protocol, but will also allow Basis Gold to avoid founder glorification & single points of failure that have plagued so many other projects. 
3. **Fairly distributed** - both Basis Gold Shares and Basis Gold has zero premine and no investors - community members can earn the initial supply of both assets by helping to contribute to bootstrap liquidity & adoption of Basis Gold. 

### A Three-token System

There exists three types of assets in the Basis Gold system. 

- **Basis Gold ($BSG)**: a stablecoin, which the protocol aims to keep value-pegged the price of gold.
- **Basis Gold Bonds ($BSGB)**: IOUs issued by the system to buy back Basis Gold when price($BSG) < realGoldPrice. Bonds are sold at a meaningful discount to price($BSG), and redeemed at realGoldPrice when price($BSG) normalizes to realGoldPrice. 
- **Basis Gold Shares ($BSGS)**: receives surplus seigniorage (seigniorage left remaining after all the bonds have been redeemed).

### Stability Mechanism

- **Contraction**: When the price($BSG) < (realGoldPrice - epsilon), users can trade in $BSG for $BSGB at the BSGBBSG exchange rate of price($BSG). This allows bonds to be always sold at a discount to gold during a contraction.
- **Expansion**: When the price($BSG) > (realGoldPrice + epsilon), users can trade in 1 $BSGB for 1 $BSG. This allows bonds to be redeemed always at a premium to the purchase price. 
- **Seigniorage Allocation**: If there are no more bonds to be redeemed, (i.e. bond Supply is negligibly small), more $BSG is minted totalSupply($BSG) * (price($BSG) - 1), and placed in a pool for $BSGS holders to claim pro-rata in a 24 hour period. 

Read the official [Basis Gold Documentation](docs.basis.gold) for more details.

## Motivation

We, the core developers of Basis Gold, were early supporters & observers of Basis when it first launched, and to this day believe that it is one of the best ideas to have ever been put forward in crypto. While Bitcoin first got us interested in blockchain's use cases, it was Basis that first truly inspired us, by painting a picture of a world that runs entirely on decentralized digital dollars the policies for which cannot be corrupted or politicized. Basis is more relevant now today than it ever was in 2017/2018 - with regulators striking back against the decentralized movement by cracking down on Telegram and Libra, while their governments are printing money faster than ever before in human history. 

This is not a DeFi project. We are simply leveraging the industry's excitement in the category to bring much deserved attention and engagement to the Basis Protocol, and to use this opportunity to distribute ownership in the protocol fairly.

Our only motivation is to bring the Basis Protocol into the world, and to serve its community in implementing Basis' vision to become the first widely adopted decentralized dollar. To that end, we are committed to take no financial upside in Basis Gold's success - we will raise no money and premine no tokens. Instead, when we feel that the protocol has found reasonable product market fit, we will ask the Basis Gold Shares DAO for donations to keep contributing to the protocol. 

## How to Contribute

To chat with us & stay up to date, join our [Telegram](https://t.me/GoldBasis).

Join us on [Discord](https://discord.gg/XfBwghzfTq)

[Website](https://basis.gold)

[Twitter](https://twitter.com/goldbasis)

By [BUILD Finance](http://build.finance/)

Contribution guidelines are [here](./CONTRIBUTING.md)

For security concerns, please submit an issue [here](https://github.com/build-finance/basis-gold-protocol/issues/new).


_© Copyright 2020, Basis Gold_
