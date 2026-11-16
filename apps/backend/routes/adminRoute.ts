//Admin summary of DB data (campaigns, maps, characters); rulebook content is static data, not listed here.
import express from "express"
import {Campaign} from "@backend/models/Campaign"
import {Map} from "@backend/models/Map"
import {typedKeys, typedValues} from "@backend/deps/_util/translationMap"
import {Character} from "@backend/models/Character"
import {defaultPermission} from "@backend/_util/routesProtector"

const router = express.Router()

router.get("/", defaultPermission(), async (req: express.Request, res: express.Response) => {

  const queries = {
    campaigns: Campaign.find().select("_id name").sort({name: "asc"}),
    maps:  Map.find().select("_id name").sort({name: "asc"}),
    characters: Character.find().select('_id name owner').populate({
      path: 'owner',
      select: 'username',
      transform: (doc) => doc ? doc.username : null
    }).sort({name: "asc"}),
  } as const

  const results = await Promise.all(typedValues(queries))

  const data = Object.fromEntries(
    typedKeys(queries).map((key, index) => [key, results[index]])
  )

  res.json(data)
})

export default router