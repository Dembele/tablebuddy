//Map library file handling (services/MapLibrary): only media under public/ is ever copied, whatever path a stored map claims.
import fs from "node:fs"
import path from "node:path"
import {diskPath} from "@backend/services/MapLibrary"

describe('MapLibrary', () => {
  test('a stored /api/ path resolves inside public/; traversal, foreign or missing files resolve to nothing', () => {
    const directory = path.join(process.cwd(), 'public', 'library', 'maps')
    const file = path.join(directory, 'test-map.webp')
    fs.mkdirSync(directory, {recursive: true})
    fs.writeFileSync(file, 'x')
    try {
      expect(diskPath('/api/library/maps/test-map.webp?t=123')).toBe(file)
      expect(diskPath('/api/../package.json')).toBeUndefined()
      expect(diskPath('/api/library/../../package.json')).toBeUndefined()
      expect(diskPath('/library/maps/test-map.webp')).toBeUndefined()
      expect(diskPath('/api/library/maps/missing.webp')).toBeUndefined()
      expect(diskPath(undefined)).toBeUndefined()
    } finally {
      fs.rmSync(file, {force: true})
    }
  })
})
