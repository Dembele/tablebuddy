//Loader: merges every installed book (data/books.ts, written by `node packages/data/books.js`) into one set of registries and serves
//them with their ids and getters. Ids are the keys of the installed books, so a typo in an id still fails type-checking.
//Shapes of the entries live in types/book; mechanics (slot tables, formula templates) in rules/.

import type {Book} from "../types/book/book"
import {books} from "./books"

type Installed = (typeof books)[number]
//one book's registry, or the intersection of all of them when several books are installed
type Merge<Part> = (Part extends unknown ? (part: Part) => void : never) extends (part: infer Whole) => void ? Whole : never

const merge = <Part extends object>(parts: Part[]): Merge<Part> => Object.assign({}, ...parts) as Merge<Part>
const installed: readonly Book[] = books                                                                                //every installed book must have the Book shape

// ───────────── Items ─────────────

export const armor = merge(books.map((book: Installed) => book.items.armor))
export const weapon = merge(books.map((book: Installed) => book.items.weapons))
export const basicWeapon = weapon                                                                                        //mundane weapons: their ids are the weapon types
export const tools = merge(books.map((book: Installed) => book.items.tools))
export const ammo = merge(books.map((book: Installed) => book.items.ammo))
export const miscItems = {
  ...ammo,
  ...merge(books.map((book: Installed) => book.items.consumables)),
  ...merge(books.map((book: Installed) => book.items.focus)),
  ...merge(books.map((book: Installed) => book.items.gear)),
  ...merge(books.map((book: Installed) => book.items.junk))
}
export const magicItems = merge(books.map((book: Installed) => book.items.magic))
export const bundles = merge(books.map((book: Installed) => book.bundles))
export const items = {...armor, ...weapon, ...tools, ...miscItems, ...magicItems}

export type ArmorIds = keyof typeof armor
export type WeaponIds = keyof typeof weapon
export type ENWeaponType = keyof typeof basicWeapon
export type ToolIds = keyof typeof tools
export type ENTool = ToolIds
export type AmmoIds = keyof typeof ammo
export type AmmoType = AmmoIds
export type MiscItemIds = keyof typeof miscItems
export type MagicItemIds = keyof typeof magicItems
export type BundleIds = keyof typeof bundles
export type ItemId = keyof typeof items

// ───────────── Everything else ─────────────

export const spells = merge(books.map((book: Installed) => book.spells))
export const features = merge(books.map((book: Installed) => book.features))
export const classes = merge(books.map((book: Installed) => book.classes))
export const subclasses = merge(books.map((book: Installed) => book.subclasses))
export const backgrounds = merge(books.map((book: Installed) => book.backgrounds))
export const races = merge(books.map((book: Installed) => book.races))
export const monsters = merge(books.map((book: Installed) => book.monsters))

export type SpellId = keyof typeof spells
export type FeatureId = keyof typeof features
export type ClassId = keyof typeof classes
export type SubclassId = keyof typeof subclasses
export type BackgroundId = keyof typeof backgrounds
export type RaceId = keyof typeof races
export type MonsterId = keyof typeof monsters

//the installed books, for listing sources
export const bookList = installed.map((book) => ({id: book.id, name: book.name}))

// ───────────── Getters ─────────────

export const getItem = <I extends ItemId>(id: I): (typeof items)[I] => items[id]
export const getSpell = <I extends SpellId>(id: I): (typeof spells)[I] => spells[id]
export const getFeature = <I extends FeatureId>(id: I): (typeof features)[I] => features[id]
export const getClass = <I extends ClassId>(id: I): (typeof classes)[I] => classes[id]
export const getSubclass = <I extends SubclassId>(id: I): (typeof subclasses)[I] => subclasses[id]
export const getBackground = <I extends BackgroundId>(id: I): (typeof backgrounds)[I] => backgrounds[id]
export const getRace = <I extends RaceId>(id: I): (typeof races)[I] => races[id]
export const getMonster = <I extends MonsterId>(id: I): (typeof monsters)[I] => monsters[id]
