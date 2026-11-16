//Inventory entries with equip / attunement state, and coins; a magic item reads through its base («Длинный меч +1»).
import {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {equipmentSlotMap} from "@frontend/deps/types/book/items"
import {itemOf} from "@frontend/_util/rulebook"
import {entryEquipment, entryName} from "@frontend/deps/rules/items"
import {EntryButtons} from "@frontend/components/Character/sheet/SheetButtons"
import Block from "@frontend/components/Character/sheet/Block"
import Link from "next/link"

const coins = [['platinum', 'ПМ'], ['gold', 'ЗМ'], ['electrum', 'ЭМ'], ['silver', 'СМ'], ['copper', 'ММ']] as const

export default function Inventory({character}: { character: EvaluatedCharacter }) {
  const attuned = character.inventory.filter((entry) => entry.attuned).length

  return (
    <Block title="Снаряжение">
      <div className="small mb-1">{coins.map(([coin, label]) => `${character.currency[coin]} ${label}`).join(' · ')}</div>
      <div className="small text-muted mb-2">Настройка: {attuned}/{character.maxAttunements}</div>
      <ul className="list-unstyled small mb-0">
        {character.inventory.map((entry) => (
          <li key={entry.id}>
            <Link href={`/compendium/items/${entry.item}`} className="text-reset">{entryName(entry)}</Link>{(entry.quantity > 1 || entry.spent) && ` ×${entry.quantity}`}{!!entry.spent && <span className="text-muted small"> · выпущено {entry.spent}</span>}
            {entry.equipped && <span className="badge text-bg-primary ms-1">{equipmentSlotMap[entry.equipped]}</span>}
            {entry.attuned && <span className="badge text-bg-info ms-1">настроен</span>}
            {entry.charges !== undefined && <span className="text-muted"> · зарядов {entry.charges}</span>}
            {entry.note && <span className="text-muted"> · {entry.note}</span>}
            <EntryButtons characterId={String(character._id)} entryId={entry.id} equipped={!!entry.equipped} attuned={!!entry.attuned}
                          canEquip={!!entryEquipment(entry)?.defaultSlot} needsAttunement={!!itemOf(entry.item)?.attunement}/>
          </li>
        ))}
        {character.inventory.length === 0 && <li className="text-muted">Пусто.</li>}
      </ul>
    </Block>
  )
}
