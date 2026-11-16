//Monster token pack: hand-made round tokens per bestiary id in public/monsters/ (<id>.webp 256 px, <id>.full.webp source ≤1200 px).
//Served as /api/monsters/… through the frontend rewrite; kept out of git (art copyright). Templates from a monster start with it.
import fs from "fs"
import path from "path"
import sharp from "sharp"

const directory = path.join(process.cwd(), 'public', 'monsters')
const tokenSide = 256
const sourceSide = 1200
const allowedFormats = ['jpeg', 'png', 'webp']

const files = (monsterId: string) => ({token: path.join(directory, `${monsterId}.webp`), source: path.join(directory, `${monsterId}.full.webp`)})
const publicPath = (file: string) => `/api/monsters/${path.basename(file)}?v=${Math.round(fs.statSync(file).mtimeMs)}`

//data URL → buffer of an allowed raster format
async function decode(dataUrl: string): Promise<Buffer> {
  const base64 = dataUrl.startsWith('data:image/') ? dataUrl.split(',')[1] : undefined
  if (!base64) throw new Error('Ожидается картинка (data URL)')
  const buffer = Buffer.from(base64, 'base64')
  const {format} = await sharp(buffer).metadata()
  if (!format || !allowedFormats.includes(format)) throw new Error('Только JPEG, PNG или WebP')
  return buffer
}

//write via a temp file, so a reader never sees half a picture
async function write(file: string, buffer: Buffer) {
  await fs.promises.writeFile(`${file}.tmp`, buffer)
  await fs.promises.rename(`${file}.tmp`, file)
}

//paths of a monster's token and source, when they exist
export function monsterToken(monsterId: string): { avatar: string; image?: string } | null {
  const {token, source} = files(monsterId)
  if (!fs.existsSync(token)) return null
  return {avatar: publicPath(token), ...(fs.existsSync(source) ? {image: publicPath(source)} : {})}
}

//every id that has a token
export function monsterTokenIds(): string[] {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory).filter((name) => name.endsWith('.webp') && !name.endsWith('.full.webp')).map((name) => name.slice(0, -'.webp'.length))
}

//save the round token (transparent corners kept) and, when given, the source picture for re-cropping
export async function saveMonsterToken(monsterId: string, avatar: string, image?: string) {
  await fs.promises.mkdir(directory, {recursive: true})
  const {token, source} = files(monsterId)
  await write(token, await sharp(await decode(avatar)).resize({width: tokenSide, height: tokenSide, fit: 'cover'}).webp({quality: 90, alphaQuality: 90}).toBuffer())
  if (image?.startsWith('data:')) await write(source, await sharp(await decode(image)).resize({width: sourceSide, height: sourceSide, fit: 'inside', withoutEnlargement: true}).webp({quality: 85}).toBuffer())
  return monsterToken(monsterId)!
}

export async function deleteMonsterToken(monsterId: string) {
  const {token, source} = files(monsterId)
  await Promise.all([token, source].map((file) => fs.promises.rm(file, {force: true})))
}
