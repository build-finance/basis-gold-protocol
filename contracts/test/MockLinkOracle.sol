pragma solidity ^0.6.0;

contract MockLinkOracle {
    
  function latestAnswer() external view returns (int256) {
    return int256(1850e8);
  }
}
