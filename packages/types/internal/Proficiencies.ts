export interface Proficiencies<T> {
  fixed?: T[],
  choose?: {
    amount: number,
    from: T[]
  }
}