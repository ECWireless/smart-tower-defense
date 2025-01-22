// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title ProjectileHelpers
 * @notice This library contains helper functions for projectile calculations
 */
library ProjectileHelpers {
  function getActualCoordinates(int16 x, int16 y) public pure returns (int16 actualX, int16 actualY) {
    if (x == 0) {
      actualX = 5;
    } else {
      actualX = (x / 10) * 10 + 5;
    }

    if (y == 0) {
      actualY = 5;
    } else {
      actualY = (y / 10) * 10 + 5;
    }

    return (actualX, actualY);
  }

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
