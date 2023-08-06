// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.3;

contract ToyContract {
  uint256 public value;
  address public deployer;

  constructor() {
    deployer = msg.sender;
    value = 5;
  }

  function setter(uint256 _val) public returns (bool) {
    value = _val;

    if (_val % 2 == 0) {
      return true;
    } else {
      return false;
    }
  }

  function acceptBalance() external payable returns(bool){
    // React to receiving ether
    return true;
  }
}
