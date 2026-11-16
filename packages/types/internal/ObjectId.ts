export interface ObjectId {
  toString(): string;
  // toHexString(): string;
  // equals(other: unknown): boolean;
  // Add other methods you might need
  // This is just a type definition - no actual implementation
}

export function newObjectId(id: string = ''): ObjectId {
  return id as unknown as ObjectId;
}

export type ID = string & { __brand: 'stringId' }; //in most cases - an English name in lowercase