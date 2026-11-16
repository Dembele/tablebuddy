export const updateTile = (fog: string, width: number, x: number, y: number, show: boolean): string => {
  const index = y * width + x;
  const padded = fog.padEnd(index + 1, '0');

  const newChar = show ? '1' : '0';
  if (padded[index] === newChar) return fog; // no change

  const updated = padded.substring(0, index) + newChar + padded.substring(index + 1);

  const lastOne = updated.lastIndexOf('1');
  return lastOne === -1 ? '' : updated.substring(0, lastOne + 1);
};
