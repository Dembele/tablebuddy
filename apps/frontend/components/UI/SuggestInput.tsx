'use client'
//Type-ahead picker for long lists (the editor's «add item»): type part of a name, pick from the top matches with the mouse or
//arrows + Enter. Every typed word must appear; names starting with the text come first, then word starts, then the rest.
import {KeyboardEvent, useId, useMemo, useState} from "react"

interface SuggestOption { id: string; name: string }

interface SuggestInputProps {
  options: SuggestOption[]
  onPick: (id: string) => void
  label: string                                                                                                         //aria label; the placeholder too unless given
  placeholder?: string
  limit?: number                                                                                                        //suggestions shown at once
  className?: string
}

const fold = (text: string) => text.toLowerCase().replace(/ё/g, 'е')

//0 = the name starts with the query, 1 = some word does, 2 = it only contains it; null = a typed word is missing
function rank(name: string, query: string, words: string[]): number | null {
  const folded = fold(name)
  if (!words.every((word) => folded.includes(word))) return null
  if (folded.startsWith(query)) return 0
  return folded.split(/[\s(«"-]+/).some((part) => part.startsWith(words[0])) ? 1 : 2
}

export default function SuggestInput({options, onPick, label, placeholder, limit = 12, className = ''}: SuggestInputProps) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()

  const matches = useMemo(() => {
    const query = fold(text.trim())
    if (!query) return []
    const words = query.split(/\s+/)
    return options.flatMap((option) => {
      const score = rank(option.name, query, words)
      return score === null ? [] : [{option, score}]
    }).sort((a, b) => a.score - b.score || a.option.name.localeCompare(b.option.name)).slice(0, limit).map((match) => match.option)
  }, [options, text, limit])

  const pick = (id: string) => {
    onPick(id)
    setText('')
    setActive(0)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((current) => Math.min(current + 1, matches.length - 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)) }
    else if (event.key === 'Enter' && matches[active]) { event.preventDefault(); pick(matches[active].id) }
    else if (event.key === 'Escape') { setText(''); setOpen(false) }
  }

  const shown = open && matches.length > 0
  return (
    <div className={`position-relative ${className}`}>
      <input className="form-control form-control-sm" type="search" role="combobox" aria-label={label} aria-expanded={shown} aria-controls={listId}
             aria-autocomplete="list" placeholder={placeholder ?? label} value={text} autoComplete="off"
             onChange={(event) => { setText(event.target.value); setActive(0); setOpen(true) }}
             onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}/>
      {shown && (
        <ul id={listId} role="listbox" className="dropdown-menu show w-100 mt-1">
          {matches.map((option, index) => (
            <li key={option.id} role="option" aria-selected={index === active}>
              {/* mousedown, not click: the input's blur would close the list before a click lands */}
              <button type="button" className={`dropdown-item small ${index === active ? 'active' : ''}`}
                      onMouseDown={(event) => { event.preventDefault(); pick(option.id) }} onMouseEnter={() => setActive(index)}>
                {option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && text.trim() && !matches.length && <div className="small text-muted mt-1">Ничего не нашлось</div>}
    </div>
  )
}
