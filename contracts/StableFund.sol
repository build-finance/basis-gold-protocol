pragma solidity ^0.6.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import './interfaces/IOracle.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IUniswapV2Router02.sol';

import './lib/UniswapV2Library.sol';
import './owner/Operator.sol';

contract StableFund is Operator {
    IUniswapV2Pair public pair;
    IERC20 public tokenA;
    IERC20 public tokenB;
    IUniswapV2Router02 public router;
    address public trader;
    bool public migrated = false;
    IOracle public goldOracle;
    
    constructor(
        address _tokenA,  //DAI
        address _tokenB, //BSG
        address _factory,
        address _router,
        address _trader,
        IOracle _goldOracle
    ) public {
        pair = IUniswapV2Pair(
            UniswapV2Library.pairFor(_factory, _tokenA, _tokenB)
        );
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
        router = IUniswapV2Router02(_router);
        trader = _trader;
        goldOracle = _goldOracle;
    }

    modifier onlyAllowedTokens(address[] calldata path) {
        require(
            (path[0] == address(tokenA) &&
                path[path.length - 1] == address(tokenB)) ||
                (path[0] == address(tokenB) &&
                    path[path.length - 1] == address(tokenA)),
            'StableFund: tokens are not allowed'
        );
        _;
    }

    modifier onlyTrader() {
        require(msg.sender == trader, 'sender is not trader');
        _;
    }

    modifier checkMigration {
        require(!migrated, 'StableFund: migrated');
        _;
    }

    /* ========== TRADER ========== */
    function getGoldPrice() public view returns (uint256) {
        try goldOracle.price1Last() returns (uint256 price) {
            return price;
        } catch {
            revert('StableFund: failed to consult gold price from the oracle');
        }
    }

    // set to 90% of goldOracle Price
    function goldPriceCeiling() public view returns(uint256) {
        return goldOracle.goldPriceOne().mul(uint256(90)).div(100);
    }
    
    function approve(address delegate, uint256 numTokens) public override returns (bool) {
        allowed[msg.sender][delegate] = numTokens;
        emit Approval(msg.sender, delegate, numTokens);
        return true;
    }

    function buyBSGUnderPeg(uint256 numTokens)
        external
        onlyOneBlock
        checkMigration
        checkStartTime
        checkOperator
    {
        require(numTokens > 0, 'Stable FUnd: cannot purchase BSG with zero amount');

        uint256 goldPrice = getGoldPrice();
    
        require(
            goldPrice < goldPriceCeiling(),
            'StableFund: BSG not eligible for purchase > 90%'
        );
   
        require(
            numTokens.mul(goldPriceCeiling()) < IERC20(tokenA).balanceOf(address(this)),
            'StableFund: Not enough DAI for buy'
        );
   
        //Outside my capabilities here to calculate the amount of DAI that needs to be transfered back 
        uint256 allowance = tokenB.allowance(msg.sender, address(this));
        require(allowance >= numTokens, "Check the token allowance");
        tokenB.transferFrom(msg.sender, address(this), numTokens);
        tokenA.transferFrom(address(this), msg.sender, numTokens.mul(goldPriceCeiling()).div(goldOracle.price0Current()));
        
        emit StableFundBoughtBSG(msg.sender, numTokens);
    }


    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        uint256 deadline
    ) public onlyAllowedTokens(path) onlyTrader checkMigration {
        router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            deadline
        );
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        uint256 deadline
    ) public onlyAllowedTokens(path) onlyTrader checkMigration {
        router.swapTokensForExactTokens(
            amountOut,
            amountInMax,
            path,
            address(this),
            deadline
        );
    }

    function approve(address token, uint256 amount)
        public
        onlyTrader
        checkMigration
        returns (bool)
    {
        if (token == address(tokenA)) {
            return tokenA.approve(address(router), amount);
        } else {
            require(
                token == address(tokenB),
                'StableFund: token should match either tokenA or tokenB'
            );
            return tokenB.approve(address(router), amount);
        }
    }

    /* ========== OPERATOR ========== */

    function setTrader(address _trader) public onlyOperator checkMigration {
        trader = _trader;
    }

    /* ========== OWNER ========== */

    function migrate(address target) public onlyOwner checkMigration {
        IERC20(tokenA).transfer(
            target,
            IERC20(tokenA).balanceOf(address(this))
        );

        IERC20(tokenB).transfer(
            target,
            IERC20(tokenB).balanceOf(address(this))
        );

        migrated = true;
        emit Migration(target);
    }

    event Migration(address indexed target);
    event StableFundBoughtBSG(address indexed from, uint256 amount);
}
