pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

import './interfaces/IOracle.sol';
import './interfaces/IBoardroom.sol';
import './interfaces/IBasisAsset.sol';
import './interfaces/ISimpleERCFund.sol';
import './lib/Babylonian.sol';
import './lib/FixedPoint.sol';
import './lib/Safe112.sol';
import './owner/Operator.sol';
import './utils/Epoch.sol';
import './utils/ContractGuard.sol';

/**
 * @title Basis Gold Treasury contract
 * @notice Monetary policy logic to adjust supplies of basis gold assets
 * @author Summer Smith & Rick Sanchez
 */
contract Treasury is ContractGuard, Epoch {
    using FixedPoint for *;
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;
    using Safe112 for uint112;

    /* ========== STATE VARIABLES ========== */

    // ========== FLAGS
    bool public migrated = false;
    bool public initialized = false;

    // ========== CORE
    address public devfund;
    address public stablefund;
    address public fund;
    address public gold;
    address public bond;
    address public share;
    address public boardroom;

    IOracle public goldOracle;

    // ========== PARAMS
    uint256 private accumulatedSeigniorage = 0;
    uint256 public fundAllocationRate = 2; // %Build FUND
    uint256 public devfundAllocationRate = 2; // %BASIS GOLD DEV
    uint256 public stablefundAllocationRate = 50; // %STABLIZATION

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _gold,
        address _bond,
        address _share,
        IOracle _goldOracle,
        address _boardroom,
        address _fund,
        address _devfund,
        address _stablefund,
        uint256 _startTime
    ) public Epoch(8 hours, _startTime, 0) {
        gold = _gold;
        bond = _bond;
        share = _share;
        goldOracle = _goldOracle;

        boardroom = _boardroom;
        fund = _fund;
        devfund = _devfund;
        stablefund = _stablefund;
    }

    /* =================== Modifier =================== */

    modifier checkMigration {
        require(!migrated, 'Treasury: migrated');

        _;
    }

    modifier checkOperator {
        require(
            IBasisAsset(gold).operator() == address(this) &&
                IBasisAsset(bond).operator() == address(this) &&
                IBasisAsset(share).operator() == address(this) &&
                Operator(boardroom).operator() == address(this),
            'Treasury: need more permission'
        );

        _;
    }

    /* ========== VIEW FUNCTIONS ========== */

    // budget
    function getReserve() public view returns (uint256) {
        return accumulatedSeigniorage;
    }

    function getGoldPrice() public view returns (uint256) {
        try goldOracle.price1Last() returns (uint256 price) {
            return price;
        } catch {
            revert('Treasury: failed to consult gold price from the oracle');
        }
    }

    function goldPriceCeiling() public view returns(uint256) {
        return goldOracle.goldPriceOne().mul(uint256(105)).div(100);
    }

    /* ========== GOVERNANCE ========== */

    function initialize() public checkOperator {
        require(!initialized, 'Treasury: initialized');

        // burn all of it's balance
        IBasisAsset(gold).burn(IERC20(gold).balanceOf(address(this)));

        // set accumulatedSeigniorage to it's balance
        accumulatedSeigniorage = IERC20(gold).balanceOf(address(this));

        initialized = true;
        emit Initialized(msg.sender, block.number);
    }

    function migrate(address target) public onlyOperator checkOperator {
        require(!migrated, 'Treasury: migrated');

        // gold
        Operator(gold).transferOperator(target);
        Operator(gold).transferOwnership(target);
        IERC20(gold).transfer(target, IERC20(gold).balanceOf(address(this)));

        // bond
        Operator(bond).transferOperator(target);
        Operator(bond).transferOwnership(target);
        IERC20(bond).transfer(target, IERC20(bond).balanceOf(address(this)));

        // share
        Operator(share).transferOperator(target);
        Operator(share).transferOwnership(target);
        IERC20(share).transfer(target, IERC20(share).balanceOf(address(this)));

        migrated = true;
        emit Migration(target);
    }

    function setFund(address newFund) public onlyOperator {
        fund = newFund;
        emit ContributionPoolChanged(msg.sender, newFund);
    }

    function setFundAllocationRate(uint256 rate) public onlyOperator {
        fundAllocationRate = rate;
        emit ContributionPoolRateChanged(msg.sender, rate);
    }
    
    function setDevFund(address newFund) public onlyOperator {
        devfund = newFund;
        emit DevFundChanged(msg.sender, newFund);
    }

    function setDevFundAllocationRate(uint256 rate) public onlyOperator {
        devfundAllocationRate = rate;
        emit DevFundRateChanged(msg.sender, rate);
    }

    function setStableFund(address newFund) public onlyOperator {
        stablefund = newFund;
        emit StableFundChanged(msg.sender, newFund);
    }

    function setStableFundAllocationRate(uint256 rate) public onlyOperator {
        stablefundAllocationRate = rate;
        emit StableFundRateChanged(msg.sender, rate);
    }

    /* ========== MUTABLE FUNCTIONS ========== */

    function _updateGoldPrice() internal {
        try goldOracle.update() {} catch {}
    }

    function buyBonds(uint256 amount, uint256 targetPrice)
        external
        onlyOneBlock
        checkMigration
        checkStartTime
        checkOperator
    {
        require(amount > 0, 'Treasury: cannot purchase bonds with zero amount');

        uint256 goldPrice = getGoldPrice();

        require(goldPrice == targetPrice, 'Treasury: gold price moved');
        require(
            goldPrice < goldOracle.goldPriceOne(),
            'Treasury: goldPrice not eligible for bond purchase'
        );

        uint256 priceRatio = goldPrice.mul(1e18).div(goldOracle.goldPriceOne());
        IBasisAsset(gold).burnFrom(msg.sender, amount);
        IBasisAsset(bond).mint(msg.sender, amount.mul(1e18).div(priceRatio));
        _updateGoldPrice();

        emit BoughtBonds(msg.sender, amount);
    }

    function redeemBonds(uint256 amount, uint256 targetPrice)
        external
        onlyOneBlock
        checkMigration
        checkStartTime
        checkOperator
    {
        require(amount > 0, 'Treasury: cannot redeem bonds with zero amount');

        uint256 goldPrice = getGoldPrice();
        require(goldPrice == targetPrice, 'Treasury: gold price moved');
        require(
            goldPrice > goldPriceCeiling(), // price > realGoldPrice * 1.05
            'Treasury: goldPrice not eligible for bond purchase'
        );
        require(
            IERC20(gold).balanceOf(address(this)) >= amount,
            'Treasury: treasury has no more budget'
        );

        accumulatedSeigniorage = accumulatedSeigniorage.sub(
            Math.min(accumulatedSeigniorage, amount)
        );

        IBasisAsset(bond).burnFrom(msg.sender, amount);
        IERC20(gold).safeTransfer(msg.sender, amount);
        _updateGoldPrice();

        emit RedeemedBonds(msg.sender, amount);
    }

    function allocateSeigniorage()
        external
        onlyOneBlock
        checkMigration
        checkStartTime
        checkEpoch
        checkOperator
    {
        _updateGoldPrice();
        uint256 goldPrice = getGoldPrice();
        if (goldPrice <= goldPriceCeiling()) {
            return; // just advance epoch instead revert
        }

        // circulating supply
        uint256 goldSupply = IERC20(gold).totalSupply().sub(
            accumulatedSeigniorage
        );
        uint256 percentage = (goldPrice.mul(1e18).div(goldOracle.goldPriceOne())).sub(1e18);
        uint256 seigniorage = goldSupply.mul(percentage).div(1e18);
        IBasisAsset(gold).mint(address(this), seigniorage);

        // ======================== BIP-3 BUILD FUND
        uint256 fundReserve = seigniorage.mul(fundAllocationRate).div(100);
        if (fundReserve > 0) {
            IERC20(gold).safeApprove(fund, fundReserve);
            ISimpleERCFund(fund).deposit(
                gold,
                fundReserve,
                'Treasury: Seigniorage Allocation'
            );
            emit ContributionPoolFunded(now, fundReserve);
        }

        seigniorage = seigniorage.sub(fundReserve);
        
        // ======================= BIP-1 DEV FUND
              uint256 devfundReserve =
            seigniorage.mul(devfundAllocationRate).div(100);
        if (devfundReserve > 0) {
            IERC20(kbtc).safeApprove(devfund, devfundReserve);
            ISimpleERCFund(devfund).deposit(
                kbtc,
                devfundReserve,
                'Treasury: Seigniorage Allocation'
            );
            emit DevFundFunded(now, devfundReserve);
        }

        seigniorage = seigniorage.sub(devfundReserve);

        // ======================== BIP-4
        uint256 treasuryReserve = Math.min(
            seigniorage,
            IERC20(bond).totalSupply().sub(accumulatedSeigniorage)
        );
        if (treasuryReserve > 0) {
            accumulatedSeigniorage = accumulatedSeigniorage.add(
                treasuryReserve
            );
            emit TreasuryFunded(now, treasuryReserve);
        }

        seigniorage = seigniorage.sub(treasuryReserve);
        
        // ======================== BIP-1 STAB FUND
        uint256 stablefundReserve =
            seigniorage.mul(stablefundAllocationRate).div(100);
        if (stablefundReserve > 0) {
            IERC20(kbtc).safeTransfer(stablefund, stablefundReserve);
            emit StableFundFunded(now, stablefundReserve);
        }
        seigniorage = seigniorage.sub(stablefundReserve);
        
        // boardroom
        uint256 boardroomReserve = seigniorage;
        if (boardroomReserve > 0) {
            IERC20(gold).safeApprove(boardroom, boardroomReserve);
            IBoardroom(boardroom).allocateSeigniorage(boardroomReserve);
            emit BoardroomFunded(now, boardroomReserve);
        }
    }

    // GOV
    event Initialized(address indexed executor, uint256 at);
    event Migration(address indexed target);
    event ContributionPoolChanged(address indexed operator, address newFund);
    event ContributionPoolRateChanged(
        address indexed operator,
        uint256 newRate
    );
    event DevFundChanged(address indexed operator, address newFund);
    event DevFundRateChanged(address indexed operator, uint256 newRate);
    event StableFundChanged(address indexed operator, address newFund);
    event StableFundRateChanged(address indexed operator, uint256 newRate);

    // CORE
    event RedeemedBonds(address indexed from, uint256 amount);
    event BoughtBonds(address indexed from, uint256 amount);
    event TreasuryFunded(uint256 timestamp, uint256 seigniorage);
    event BoardroomFunded(uint256 timestamp, uint256 seigniorage);
    event ContributionPoolFunded(uint256 timestamp, uint256 seigniorage);
    event DevFundFunded(uint256 timestamp, uint256 seigniorage);
    event StableFundFunded(uint256 timestamp, uint256 seigniorage);
}
