//Character REST (Doctrine: players press buttons, the DM edits). The DM reaches every character, a player their own and shared ones.
//Players: profile, rule-bound choices (equip / attune / prepare), builder commits run here. Raw edits (PUT): DM only.
import express, {Response} from 'express'
import {Request} from "@backend/types/Request"
import {Character} from "@backend/models/Character"
import {genericErrorHandler} from "@backend/_util/mongooseErrorHandler"
import {characterManager} from "@backend/services/CharacterManager"
import {defaultPermission} from "@backend/_util/routesProtector"
import {ICharacter} from "@backend/deps/interfaces/DB/Character"
import {Campaign} from "@backend/models/Campaign"
import {processCharacterMediaFields} from "@backend/_util/processImage"
import {evaluator} from "@backend/services/Evaluator"
import {Answers, buildCreation, buildLevelUp} from "@backend/deps/builder/_index"
import {attune, equip, itemActions, Outcome, setPrepared, unequip} from "@backend/deps/rules/choices"
import {getMonster, MonsterId, monsters} from "@backend/deps/data/loader"
import {stampMonster} from "@backend/deps/builder/monster"
import {monsterToken} from "@backend/services/MonsterTokens"

const router = express.Router()
router.use(defaultPermission('Игрок'))

type SessionUser = NonNullable<Request['user']>
const sameId = (left: unknown, right: unknown) => String(left) === String(right)
const isDM = (user: SessionUser) => user.role === 'ГМ'

//DM: anything; player: owner or listed in usableBy
const mayAccess = (user: SessionUser, character: Pick<ICharacter, 'owner' | 'usableBy'>) =>
  isDM(user) || sameId(character.owner, user._id) || character.usableBy.some(id => sameId(id, user._id))

//deleting stays with the DM and the owner
const mayDelete = (user: SessionUser, character: Pick<ICharacter, 'owner'>) => isDM(user) || sameId(character.owner, user._id)

//stored character as plain data, defaults filled, or the HTTP refusal
async function loadFor(req: Request, res: Response): Promise<ICharacter | null> {
  const document = await Character.findById(req.params.id)
  if (!document) return void res.status(404).send('Персонаж не найден'), null
  const character = document.toObject({minimize: false}) as ICharacter
  if (!mayAccess(req.user!, character)) return void res.status(403).send('Запрещено'), null
  return character
}

//whole-document write (DM editor, builder): validated, live wrapper rebuilt, room told
async function commitWhole(id: string, character: Partial<ICharacter>) {
  await Character.updateOne({_id: id}, character, {runValidators: true})
  const updated = await characterManager.revalidateCharacter(id)
  const {getIo} = await import('@backend/server')
  getIo().to(String(updated.pureData.campaign)).emit('update-character', {character: updated.evaluatedData})
}

//one rule-bound choice through the live wrapper (persist + re-evaluate + broadcast via setProperty)
async function choose<T>(req: Request, res: Response, path: string, decide: (character: ICharacter, limit: number) => Outcome<T>) {
  const live = await characterManager.getOrCreateCharacter(String(req.params.id))
  if (!mayAccess(req.user!, live.pureData)) return void res.status(403).send('Запрещено')
  const outcome = decide(structuredClone(live.pureData) as ICharacter, live.evaluatedData.maxAttunements)
  if (!outcome.ok) return void res.status(409).send(outcome.reason)
  const diff = await live.setProperty(path, outcome.value)
  if (path !== 'inventory') return void res.json(diff)
  res.json(await live.setProperty('actions', itemActions(live.pureData as ICharacter, outcome.value as ICharacter['inventory'])))       //items in use bring their actions
}

//summary list for pickers and the character page; ?campaign=<id> narrows. Monster templates and their copies are game-room only
//(the room reads its list over the socket), so lobby lists never show them
router.get('/', async (req: Request, res: Response) => {
  const user = req.user!
  const filter: Record<string, unknown> = isDM(user) ? {} : {$or: [{owner: user._id}, {usableBy: user._id}]}
  if (typeof req.query.campaign === 'string') filter.campaign = req.query.campaign
  filter.isTemplate = {$ne: true}
  filter.templateSource = null                                                                                          //null matches missing too

  try {
    const characters = await Character.find(filter)
      .select('_id name avatar race background classes campaign owner isNPC isTemplate templateSource monster updatedAt')
      .sort({updatedAt: -1})
      .lean()
    res.json(characters)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//evaluated snapshot through the manager (what the sheet renders)
router.get('/evaluated/:id', async (req: Request, res: Response) => {
  try {
    const character = await characterManager.getOrCreateCharacter(String(req.params.id))
    if (!mayAccess(req.user!, character.pureData)) return void res.status(403).send("Запрещено")
    res.json(character.evaluatedData)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//raw stored data with formulas (what the DM editor and the builder preview work on)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const character = await loadFor(req, res)
    if (character) res.json(character)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//ability scores by the dice: 4d6 drop lowest ×6 through the engine, once per character (stored; only the DM clears it)
router.post('/:id/roll-scores', async (req: Request, res: Response) => {
  try {
    const character = await loadFor(req, res)
    if (!character) return
    if (character.rolledScores?.length) return void res.json(character.rolledScores)
    if (character.classes.length) return void res.status(409).send('Персонаж уже создан — характеристики не бросаются')

    const rolled = Array.from({length: 6}, () => {
      const output = evaluator.eval('4d6kh3')
      const dice = output.tokens.dices.flatMap((token) => token.details.type === 'dice' ? token.details.data.map((die) => die.value) : [])
      return {total: output.total, dice}
    })
    await Character.updateOne({_id: req.params.id}, {rolledScores: rolled})
    characterManager.deleteCharacter(String(req.params.id))
    res.json(rolled)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//builder commit: the walk runs here on the stored character, so nothing the client sends but answers is trusted
router.post('/:id/build', async (req: Request, res: Response) => {
  const {mode, answers} = req.body as { mode?: string; answers?: Answers }
  if ((mode !== 'creation' && mode !== 'levelUp') || !answers || typeof answers !== 'object') return void res.status(400).send('Нужны mode и answers')

  try {
    const character = await loadFor(req, res)
    if (!character) return
    if (mode === 'levelUp' && !isDM(req.user!) && !character.levelUpAllowed) return void res.status(403).send('Повышение уровня не разрешено ГМ')

    const built = (mode === 'creation' ? buildCreation : buildLevelUp)(character, answers)
    if (built.missing.length) return void res.status(409).send(`Не на всё ответили: ${built.missing.length}`)
    const {_id, owner, campaign, usableBy, templateSource, ...fields} = built.character
    await commitWhole(String(req.params.id), {...fields, actions: itemActions(fields, fields.inventory), levelUpAllowed: mode === 'levelUp' ? false : fields.levelUpAllowed}) //kit consumables bring their actions
    res.sendStatus(200)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//name, notes, pictures: no mechanics, the player's own
router.patch('/:id/profile', async (req: Request, res: Response) => {
  const allowed = ['name', 'notes', 'avatar', 'image'] as const
  const changes = Object.fromEntries(allowed.filter((key) => key in req.body).map((key) => [key, req.body[key]])) as Partial<ICharacter>
  if (typeof changes.name === 'string' && changes.name.trim().length < 1) return void res.status(400).send('Имя не может быть пустым')

  try {
    const stored = await Character.findById(req.params.id)
    if (!stored) return void res.status(404).send('Персонаж не найден')
    if (!mayAccess(req.user!, stored)) return void res.status(403).send('Запрещено')
    await processCharacterMediaFields(stored, changes, String(req.params.id))
    await commitWhole(String(req.params.id), changes)
    res.sendStatus(200)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

router.post('/:id/equip', async (req: Request, res: Response) => {
  try {
    await choose(req, res, 'inventory', (character) => equip(character, req.body.entryId, req.body.slot))
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

router.post('/:id/unequip', async (req: Request, res: Response) => {
  try {
    await choose(req, res, 'inventory', (character) => unequip(character, req.body.entryId))
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

router.post('/:id/attune', async (req: Request, res: Response) => {
  try {
    await choose(req, res, 'inventory', (character, limit) => attune(character, req.body.entryId, !!req.body.attuned, limit))
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

router.post('/:id/prepare', async (req: Request, res: Response) => {
  try {
    await choose(req, res, 'spellcasting.spells', (character) => setPrepared(character, req.body.spell, req.body.source, !!req.body.prepared))
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//DM switch: the player may level up once
router.patch('/:id/level-up', defaultPermission('ГМ'), async (req: Request, res: Response) => {
  try {
    const live = await characterManager.getOrCreateCharacter(String(req.params.id))
    res.json(await live.setProperty('levelUpAllowed', !!req.body.allowed))
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//DM: who plays the character (owner, shared with) and whether it is an NPC; the people named join the campaign
router.patch('/:id/access', defaultPermission('ГМ'), async (req: Request, res: Response) => {
  const {owner, usableBy, isNPC, isTemplate} = req.body as { owner?: string; usableBy?: string[]; isNPC?: boolean; isTemplate?: boolean }
  if (usableBy !== undefined && !Array.isArray(usableBy)) return void res.status(400).send('usableBy — список пользователей')

  try {
    const stored = await Character.findById(req.params.id)
    if (!stored) return void res.status(404).send('Персонаж не найден')
    const keptOwner = owner ?? String(stored.owner)
    const changes: Record<string, unknown> = {}
    if (owner) changes.owner = owner
    if (usableBy) changes.usableBy = [...new Set(usableBy)].filter((userId) => !sameId(userId, keptOwner))
    if (typeof isNPC === 'boolean') changes.isNPC = isNPC
    if (typeof isTemplate === 'boolean') changes.isTemplate = isTemplate
    if (isTemplate) changes.isNPC = true                                                                                //a template is always an NPC (its drops are copies)
    if (isTemplate && stored.templateSource) return void res.status(400).send('Копия шаблона не может сама стать шаблоном')
    await commitWhole(String(req.params.id), changes as Partial<ICharacter>)
    const players = [owner, ...(usableBy ?? [])].filter(Boolean)
    if (players.length) await Campaign.findByIdAndUpdate(stored.campaign, {$addToSet: {players: {$each: players}}})
    res.sendStatus(200)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//DM: a stat-block template from the Monster Manual (data/monsters), stamped as constants; drops make numbered copies
router.post('/from-monster', defaultPermission('ГМ'), async (req: Request, res: Response) => {
  const {campaign, monster} = req.body as { campaign?: string; monster?: string }
  if (!campaign || typeof campaign !== 'string') return void res.status(400).send('Кампания не указана')
  if (!monster || !(monster in monsters)) return void res.status(400).send('Нет такого монстра')

  try {
    if (!await Campaign.exists({_id: campaign})) return void res.status(404).send('Кампания не найдена')
    const character = await Character.create({owner: req.user!._id, campaign, ...stampMonster(getMonster(monster as MonsterId)), ...monsterToken(monster)}) //the pack token, when one was made
    const {getHub} = await import('@backend/server')                                                                 //lazy: server → app → routes would be circular
    await getHub()?.announceCharacter(campaign, character._id)
    res.status(201).json({_id: character._id})
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//blank character in a campaign; a player creates only for themselves
router.post('/', async (req: Request, res: Response) => {
  const user = req.user!
  const {campaign, name} = req.body
  const owner = isDM(user) && req.body.owner ? req.body.owner : user._id
  if (typeof campaign !== 'string' || !campaign) return void res.status(400).send('Кампания не указана')

  try {
    //players join a campaign only through the DM's player list, never by creating a character in it
    const joined = isDM(user) || await Campaign.exists({_id: campaign, players: user._id})
    if (!joined) return void res.status(403).send('Вы не участник этой кампании')
    const character = await Character.create({owner, campaign, ...(name ? {name} : {})})
    await Campaign.findByIdAndUpdate(campaign, {$addToSet: {players: owner}})
    res.status(201).json({_id: character._id})
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//raw whole-document edit: the DM's direct input, no validation needed (Doctrine)
router.put('/:id', defaultPermission('ГМ'), async (req: Request, res: Response) => {
  const character: Partial<ICharacter> = req.body
  if (!character) return void res.status(400).send('Ошибка данных: персонаж не передался на сервер')

  try {
    const stored = await Character.findById(req.params.id)
    if (!stored) return void res.status(404).send('Персонаж не найден')
    await processCharacterMediaFields(stored, character, String(req.params.id))
    const actions = character.inventory && itemActions({actions: character.actions ?? stored.toObject().actions}, character.inventory) //item actions follow the edited pack
    await commitWhole(String(req.params.id), actions ? {...character, actions} : character)
    res.sendStatus(200)
  } catch (error: unknown) {
    genericErrorHandler(error, res)
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id)

  try {
    const stored = await Character.findById(id).lean<ICharacter>()
    if (!stored) return void res.sendStatus(204)
    if (!mayDelete(req.user!, stored)) return void res.status(403).send("Запрещено")
    await Character.findByIdAndDelete(id)
    characterManager.deleteCharacter(id)
    const {getHub} = await import('@backend/server')                                                                 //lazy: server → app → routes would be circular
    getHub()?.forgetCharacter(stored.campaign, id)
    res.sendStatus(204)
  } catch (error: unknown) {
    genericErrorHandler(error, res)
  }
})

export default router
