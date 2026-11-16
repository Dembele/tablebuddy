//Initiative order of a campaign room: a list the DM keeps by hand (Doctrine: display state, like conditions — nothing reads it,
//nothing ticks). Stored on the campaign; every client gets it whole and hides what its user may not see (see rules/turns.ts).

export interface TurnEntry {
  id: string
  characterId?: string                                                                                                  //a character of the campaign; absent = a free line (lair action, trap, «подкрепление»)
  name?: string                                                                                                         //free lines only: characters show their live name
  initiative: number | null                                                                                             //null = not rolled / typed yet, sorts last
  hidden: boolean                                                                                                       //DM's eye switch: players do not see the line
}

export interface TurnOrder {
  round: number                                                                                                         //from 1
  current: string | null                                                                                                //entry id whose turn it is; null = not started
  entries: TurnEntry[]
}
