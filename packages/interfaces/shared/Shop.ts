//A campaign's shop: opened by the DM («в городе», «перед кампанией»), stock rolled by the server once per opening (rules/shop).
//Stored on the campaign, sent whole to the room; entries carry their name and price so clients need no rulebook.
import {ENItemRarity, ENItemType} from "../../types/book/items"
import {ItemId} from "../../data/loader"

export interface ShopEntry {
  id: string                                                                                                            //stable within one roll
  item: ItemId
  base?: ItemId                                                                                                         //magic weapon / armor: the mundane item it is built on
  name: string                                                                                                          //«Длинный меч +1», resolved on the server
  type: ENItemType
  rarity: ENItemRarity
  magic: boolean
  price: number                                                                                                         //copper, per piece
  stock: number | null                                                                                                  //null = as many as wanted (mundane); magic = 1
}

export interface ShopSettings {
  magicLimit: number                                                                                                    //at most this many magic items on the shelf
  maxRarity: ENItemRarity                                                                                               //rarest a magic item may be
}

export interface ShopState extends ShopSettings {
  open: boolean
  entries: ShopEntry[]
}
