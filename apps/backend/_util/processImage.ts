import path from "node:path"
import fs from "node:fs"
import {ObjectId} from "@backend/deps/types/internal/ObjectId"
import sharp, {ResizeOptions} from "sharp"
import {ICharacter} from "@backend/deps/interfaces/DB/Character"

// ========== CONSTANTS ==========
const COVER_IMAGE = {
  WIDTH: 1920,
  HEIGHT: 1080,
  QUALITY: 85,
  FILENAME: 'cover.webp'
} as const

const MAP_IMAGE = {
  MAX_MAIN_SIZE_MB: 2,
  MAX_THUMBNAIL_SIZE_MB: 0.2,
  THUMBNAIL: {
    WIDTH: 400,
    HEIGHT: 300,
    INITIAL_QUALITY: 75
  },
  MAIN: {
    INITIAL_QUALITY: 85
  }
} as const

const SHARP_OPTIONS = {
  FORMAT: 'webp' as const,
  ALPHA_QUALITY: 0,
  LOSSLESS: false,
  FORCE: true,
  MIN_QUALITY: 10,
  QUALITY_STEP: 5,
  FLATTEN: { background: { r: 255, g: 255, b: 255 } }
} as const

const ALLOWED_MIME_TYPES = ['jpeg', 'png', 'webp']

// ========== INTERFACES ==========
interface ImageProcessingOptions {
  image: string;
  campaignId?: string; // Optional for non-campaign maps
  mapId?: ObjectId;    // Required for map-type images
  type: 'cover' | 'map'; // 'cover' for fixed-size campaign covers; 'map' for main + thumbnail
  validateMime?: boolean; // Whether to check allowed MIME types (default: true for cover)
}

// ========== HELPER FUNCTIONS ==========
const getCharacterMediaDir = (campaignId: string, characterId: string): string => {
  return path.join(process.cwd(), 'public', 'campaigns', campaignId, 'characters', characterId)
}

const getCharacterMediaPublicPath = (campaignId: string, characterId: string, filename: 'avatar.webp' | 'image.webp'): string => {
  return `/api/campaigns/${campaignId}/characters/${characterId}/${filename}?v=${Date.now()}` //same file name each save: the version busts browser caches
}

const isLocalCharacterImage = (pathStr: string | undefined): boolean => {
  return typeof pathStr === 'string' &&
    pathStr.startsWith('/api/campaigns/') &&
    pathStr.includes('/characters/')
}

const isExistingImagePath = (image: unknown): boolean => {
  return typeof image === 'string' && (image.startsWith('/') || !image.startsWith('data:image/'))
}

const extractBase64Data = (image: string): Buffer => {
  const base64Data = image.split(',')[1]
  if (!base64Data) {
    throw new Error('Invalid base64 image format')
  }
  return Buffer.from(base64Data, 'base64')
}

const validateMimeType = async (imageBuffer: Buffer): Promise<void> => {
  const fileType = await sharp(imageBuffer).metadata()
  if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.format)) {
    throw new Error('Invalid image format. Only JPEG, PNG, and WebP are allowed')
  }
}

const createUploadDirectory = (uploadDir: string): void => {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const processWithAdaptiveQuality = async (
  buffer: Buffer,
  maxSizeMB: number,
  initialQuality: number,
  resizeOptions?: ResizeOptions
): Promise<Buffer> => {
  let quality = initialQuality

  while (quality >= SHARP_OPTIONS.MIN_QUALITY) {
    let sharpInstance = sharp(buffer).toFormat(SHARP_OPTIONS.FORMAT, {
      quality,
      alphaQuality: SHARP_OPTIONS.ALPHA_QUALITY,
      lossless: SHARP_OPTIONS.LOSSLESS
    })

    if (resizeOptions) {
      sharpInstance = sharpInstance.resize(resizeOptions)
    }

    const processedBuffer = await sharpInstance.toBuffer()
    const sizeMB = processedBuffer.length / (1024 * 1024)

    if (sizeMB <= maxSizeMB) {
      return processedBuffer
    }

    quality -= SHARP_OPTIONS.QUALITY_STEP
  }

  // Fallback: Use lowest quality
  let fallbackInstance = sharp(buffer).toFormat(SHARP_OPTIONS.FORMAT, {
    quality: SHARP_OPTIONS.MIN_QUALITY,
    alphaQuality: SHARP_OPTIONS.ALPHA_QUALITY,
    lossless: SHARP_OPTIONS.LOSSLESS
  })

  if (resizeOptions) {
    fallbackInstance = fallbackInstance.resize(resizeOptions)
  }

  return fallbackInstance.toBuffer()
}

const getUploadDirectory = (type: 'cover' | 'map', campaignId?: string): string => {
  const baseUploadDir = path.join(process.cwd(), 'public')

  if (type === 'cover') {
    if (!campaignId) throw new Error('campaignId is required for cover images')
    return path.join(baseUploadDir, 'campaigns', campaignId)
  } else {
    return campaignId
      ? path.join(baseUploadDir, 'campaigns', campaignId, 'maps')
      : path.join(baseUploadDir, 'library', 'maps')                                                                    //library maps (services/MapLibrary)
  }
}

const getPublicPath = (type: 'cover' | 'map', campaignId?: string, mapId?: ObjectId, fileName?: string): string => {
  const timestamp = type === 'map' ? `?t=${Date.now()}` : ''

  if (type === 'cover') {
    return `/api/campaigns/${campaignId}/${fileName}${timestamp}`
  } else {
    const publicBasePath = campaignId ? `/api/campaigns/${campaignId}/maps` : '/api/library/maps'
    return `${publicBasePath}/${fileName}${timestamp}`
  }
}

// ========== MAIN FUNCTION ==========
export const processAndSaveImage = async (options: ImageProcessingOptions): Promise<{ imagePath: string; thumbnailPath?: string }> => {
  const { image, campaignId, mapId, type, validateMime = type === 'cover' } = options

  // Return early if it's an existing path
  if (isExistingImagePath(image)) {
    return { imagePath: image }
  }

  // Extract and validate image buffer
  const imageBuffer = extractBase64Data(image)

  // Optional MIME validation
  if (validateMime) {
    await validateMimeType(imageBuffer)
  }

  // Validate required IDs
  if (type === 'cover' && !campaignId) {
    throw new Error('campaignId is required for cover images')
  }
  if (type === 'map' && !mapId) {
    throw new Error('mapId is required for map images')
  }

  // Create upload directory
  const uploadDir = getUploadDirectory(type, campaignId)
  createUploadDirectory(uploadDir)

  let imagePath: string
  let thumbnailPath: string | undefined

  if (type === 'cover') {
    // Process cover image
    const processedImage = await sharp(imageBuffer)
      .toFormat(SHARP_OPTIONS.FORMAT, {
        quality: COVER_IMAGE.QUALITY,
        alphaQuality: SHARP_OPTIONS.ALPHA_QUALITY,
        lossless: SHARP_OPTIONS.LOSSLESS
      })
      .resize({
        width: COVER_IMAGE.WIDTH,
        height: COVER_IMAGE.HEIGHT,
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer()

    const filePath = path.join(uploadDir, COVER_IMAGE.FILENAME)
    fs.writeFileSync(filePath, processedImage)

    imagePath = getPublicPath('cover', campaignId, undefined, COVER_IMAGE.FILENAME)
  } else {
    // Process map image (main + thumbnail)
    const mainImageBuffer = await processWithAdaptiveQuality(
      imageBuffer,
      MAP_IMAGE.MAX_MAIN_SIZE_MB,
      MAP_IMAGE.MAIN.INITIAL_QUALITY
    )

    const mainImageFileName = `${mapId}.webp`
    const mainImagePath = path.join(uploadDir, mainImageFileName)
    fs.writeFileSync(mainImagePath, mainImageBuffer)

    // Generate thumbnail
    const thumbnailBuffer = await processWithAdaptiveQuality(
      imageBuffer,
      MAP_IMAGE.MAX_THUMBNAIL_SIZE_MB,
      MAP_IMAGE.THUMBNAIL.INITIAL_QUALITY,
      {
        width: MAP_IMAGE.THUMBNAIL.WIDTH,
        height: MAP_IMAGE.THUMBNAIL.HEIGHT,
        fit: 'cover' as const
      }
    )

    const thumbnailFileName = `${mapId}_thumbnail.webp`
    const thumbnailPathFull = path.join(uploadDir, thumbnailFileName)
    fs.writeFileSync(thumbnailPathFull, thumbnailBuffer)

    // Set public paths
    imagePath = getPublicPath('map', campaignId, mapId, mainImageFileName)
    thumbnailPath = getPublicPath('map', campaignId, mapId, thumbnailFileName)
  }

  return {
    imagePath,
    ...(thumbnailPath && { thumbnailPath })
  }
}

export const processCharacterMediaFields = async (
  oldCharacter: ICharacter,
  updates: Partial<ICharacter>,
  characterId: string
): Promise<void> => {
  const oldCampaignId = oldCharacter.campaign?.toString()
  const newCampaignId = updates.campaign?.toString() || oldCampaignId

  if (!newCampaignId) {
    throw new Error('Персонаж должен быть привязан к кампании для загрузки изображений')
  }

  const fields: Array<'avatar' | 'image'> = ['avatar', 'image']
  const filesToDelete: string[] = []

  // Final upload directory
  const uploadDir = getCharacterMediaDir(newCampaignId, characterId)
  await fs.promises.mkdir(uploadDir, { recursive: true })

  for (const field of fields) {
    const oldPath = oldCharacter[field] as string | undefined
    const incoming = updates[field] as string | undefined

    // 1. No change → skip
    if (isExistingImagePath(incoming) && incoming === oldPath || incoming === undefined) {
      continue
    }

    // 2. Already a valid path (e.g. from previous upload or campaign move)
    if (isExistingImagePath(incoming)) {
      updates[field] = incoming
      continue
    }

    // 3. New base64 image → process and save with fixed name
    if (incoming.startsWith('data:image/')) {
      const buffer = extractBase64Data(incoming)
      await validateMimeType(buffer)

      const width = field === 'avatar' ? 400 : 1200
      const height = field === 'avatar' ? 400 : undefined
      const fit: ResizeOptions["fit"] = field === 'avatar' ? 'cover' : 'inside'

      const processedBuffer = await sharp(buffer)
        .flatten(SHARP_OPTIONS.FLATTEN)
        .resize({ width, height, fit, withoutEnlargement: true })
        .webp({
          quality: 85,
          alphaQuality: 0,
          lossless: false,
          force: true
        })
        .toBuffer()

      const filename = `${field}.webp` as const
      const tempPath = path.join(uploadDir, `${filename}.tmp`)
      const finalPath = path.join(uploadDir, filename)

      // Atomic write: write → rename
      await fs.promises.writeFile(tempPath, processedBuffer)
      await fs.promises.rename(tempPath, finalPath)

      updates[field] = getCharacterMediaPublicPath(newCampaignId, characterId, filename)

      // Queue old file for deletion (if existed and was local)
      if (oldPath && isLocalCharacterImage(oldPath) && !oldPath.includes('default') && !oldPath.split('?')[0].endsWith(`/${filename}`)) { //same name = just overwritten, keep it
        const oldFileAbs = path.join(process.cwd(), 'public', oldPath.slice(1))
        filesToDelete.push(oldFileAbs)
      }
    }
  }

  // === Campaign changed → move entire character folder ===
  if (oldCampaignId && newCampaignId && oldCampaignId !== newCampaignId) {
    const oldDir = getCharacterMediaDir(oldCampaignId, characterId)

    try {
      await fs.promises.access(oldDir)
      await fs.promises.rename(oldDir, uploadDir)
      console.log(`Character media moved: ${oldCampaignId} → ${newCampaignId} (${characterId})`)
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.warn('Failed to move character folder:', err.message)
      }
      // Folder doesn't exist → nothing to move → all good
    }
  }

  // === Delete replaced old files ===
  await Promise.all(
    filesToDelete.map(async (filePath) => {
      try {
        await fs.promises.unlink(filePath)
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.warn('Failed to delete old image:', filePath)
        }
      }
    })
  )
}