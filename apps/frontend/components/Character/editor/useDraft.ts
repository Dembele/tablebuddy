'use client'
//Editor draft: an immutable copy of the raw character, changed by dot path; `dirty` until saved.
import {useCallback, useState} from "react"
import type {ICharacter} from "@frontend/deps/interfaces/DB/Character"

export type SetField = (path: string, value: unknown) => void

//copy-on-write of one nested value
function withPath<T>(source: T, path: string, value: unknown): T {
  const copy = structuredClone(source) as Record<string, unknown>
  const parts = path.split('.')
  let current = copy
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== 'object') current[part] = {}
    current = current[part] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
  return copy as T
}

export function useDraft(initial: ICharacter) {
  const [draft, setDraft] = useState(initial)
  const [dirty, setDirty] = useState(false)

  const set: SetField = useCallback((path, value) => {
    setDraft((current) => withPath(current, path, value))
    setDirty(true)
  }, [])

  const markSaved = useCallback(() => setDirty(false), [])
  return {draft, set, dirty, markSaved}
}
