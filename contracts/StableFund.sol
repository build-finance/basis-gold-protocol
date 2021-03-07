pragma solidity ^0.6.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import './interfaces/IOracle.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IUniswapV2Router02.sol';

import './lib/UniswapV2Library.sol';
import './owner/Operator.sol';

contract StableFund is Operator {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;
    
    IUniswapV2Pair public pair;
    IERC20 public dai;
    IERC20 public bsg;
    address[] public path;
    IUniswapV2Router02 public router;
    bool public migrated = false;
    IOracle public goldOracle;
    uint256 public goldBuyPercentage; //90%
    uint256 public goldSellPercentage; //105%
    mapping(address => mapping (address => uint256)) allowed;
    
    constructor(
        address _dai,  //DAI
        address _bsg, //BSG
        address _factory,
        address _router,
        IOracle _goldOracle,
        uint256 _goldBuyPercentage,
        uint256 _goldSellPercentage
        
    ) public {
        pair = IUniswapV2Pair(
            UniswapV2Library.pairFor(_factory, _dai, _bsg)
        );
        path = [_dai, _bsg];
        dai = IERC20(_dai);
        bsg = IERC20(_bsg);
        router = IUniswapV2Router02(_router);
        goldOracle = _goldOracle;
        goldBuyPercentage = _goldBuyPercentage;
        goldSellPercentage = _goldSellPercentage;
    }

    modifier checkMigration {
        require(!migrated, 'StableFund: migrated');
        _;
    }

    //Pricing Functions 

    function getGoldPrice() internal view returns (uint256) {
        try goldOracle.price1Last() returns (uint256 price) {
            return price;
        } catch {
            revert('StableFund: failed to consult gold price from the oracle');
        }
    }

    // set to 90% of goldOracle Price
    function goldPriceCeiling() internal view returns(uint256) {
        return goldOracle.goldPriceOne().mul(uint256(goldBuyPercentage)).div(100);
    }

    function goldPriceFloor() internal view returns(uint256) {
        return goldOracle.goldPriceOne().mul(uint256(goldSellPercentage)).div(100);
    }

    //Selling Functions - Seller must be approved before calling sellBSGtoStableFund
    
    function approveSeller(address delegate, uint256 numTokens) public returns (bool) {
        allowed[msg.sender][delegate] = numTokens;
        emit Approval(msg.sender, delegate, numTokens);
        return true;
    }

    function sellBSGtoStableFund(uint256 numTokens) public checkMigration
    {
        require(numTokens > 0, 'Stable FUnd: cannot purchase BSG with zero amount');

        uint256 goldPrice = getGoldPrice();
    
        require(
            goldPrice < goldPriceCeiling(),
            'StableFund: BSG not eligible for purchase > 90%'
        );
   
        require(
            numTokens.mul(goldPriceCeiling()) < IERC20(dai).balanceOf(address(this)),
            'StableFund: Not enough DAI for buy'
        );
   
        //Outside my capabilities here lets make sure we test the math...
        uint256 allowance = bsg.allowance(msg.sender, address(this));
        require(allowance >= numTokens, "Check the token allowance - Call approveSeller");
        bsg.transferFrom(msg.sender, address(this), numTokens);
        dai.transferFrom(address(this), msg.sender, numTokens.mul(goldPriceCeiling()).div(goldOracle.price0Last()));
        
        emit StableFundBoughtBSG(msg.sender, numTokens);
    }

    // Stable Fund selling BSG when above peg. - must call approveUniSwap before calling sellBSGOverPeg

    function approveUniSwap(address token, uint256 numTokens)
        public
        checkMigration
        returns (bool)
    {
        if (token == address(dai)) {
            return dai.approve(address(router), numTokens);
        } else {
            require(
                token == address(bsg),
                'StableFund: token should match either dai or bsg'
            );
            return bsg.approve(address(router), numTokens);
        }
    }

    // Can only sell 5 BSG at a time, must have Gold Over 1.05 Peg
    function sellBSGOverPeg(uint256 numTokens) public  checkMigration 
    {
        require(numTokens > 0, 'Stable Fund: cannot sell BSG with zero amount');
        require(numTokens <= 5, 'Stable Fund: cannot sell more than 5 BSG at a time');

        uint256 goldPrice = getGoldPrice();
    
        require(
            goldPrice > goldPriceFloor(),
            'StableFund: BSG not eligible for sale < 105%'
        );
   
        require(
            numTokens <= IERC20(bsg).balanceOf(address(this)),
            'StableFund: Not enough BSG to sell'
        );

        uint256 allowance = bsg.allowance(address(this), address(router));
        require(allowance >= numTokens, "Check the token allowance - Call approveUniSwap");

        uint deadline = block.timestamp + 30;

        router.swapExactTokensForTokens(
            numTokens,
            0,
            path,
            address(this),
            deadline
        );

        emit StableFundSoldBSG(msg.sender, numTokens);
    }



    /* ========== OWNER ========== */

    function setGoldBuyBackPercentage(uint256 _setBSGPercent) public onlyOperator checkMigration {
        goldBuyPercentage = _setBSGPercent;
    }

    function setGoldSellPercentage(uint256 _setBSGPercent) public onlyOperator checkMigration {
        goldSellPercentage = _setBSGPercent;
    }

    function migrate(address target) public onlyOperator checkMigration {
        IERC20(dai).transfer(
            target,
            IERC20(dai).balanceOf(address(this))
        );

        IERC20(bsg).transfer(
            target,
            IERC20(bsg).balanceOf(address(this))
        );

        migrated = true;
        emit Migration(target);
    }

    event Migration(address indexed target);
    event StableFundBoughtBSG(address indexed from, uint256 amount);
    event StableFundSoldBSG(address indexed from, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
