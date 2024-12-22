// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title Math
 * @notice This library contains somewhat common math functions
 */
library Math {
  // Allows (0,1), (1,1), and (1,0) to all be the same distance from (0,0)
  function chebyshevDistance(uint256 x1, uint256 y1, uint256 x2, uint256 y2) public pure returns (uint16) {
    return uint16(_max(_absDiff(x1, x2), _absDiff(y1, y2)));
  }

  function _absDiff(uint256 a, uint256 b) internal pure returns (uint256) {
    return a > b ? a - b : b - a;
  }

  function _max(uint256 a, uint256 b) internal pure returns (uint256) {
    return a >= b ? a : b;
  }
}
