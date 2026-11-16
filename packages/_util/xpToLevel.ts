import {XPTableMap} from "../types/Character";

export function getLevelFromXP(totalXP: number): number {
  let currentLevel = 1;
  let xpNeededSoFar = 0;

  // Loop from level 1 to level 19 (since level 20 has no next level)
  for (let level = 1; level < 20; level++) {
    // Get the cost to level up FROM this level
    const costForThisLevel = XPTableMap[level];

    // If the player's XP is less than the total needed for the next level,
    // they are still at the current level.
    if (totalXP < xpNeededSoFar + costForThisLevel) {
      return currentLevel;
    }

    // Otherwise, add the cost and move to the next level.
    xpNeededSoFar += costForThisLevel;
    currentLevel = level + 1;
  }

  // If they have more XP than the total cost for 1-19, they are level 20.
  return 20;
}