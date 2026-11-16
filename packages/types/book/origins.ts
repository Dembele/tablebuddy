//What a background and a species (legacy name: race) are. Traits and origin feats are features, referenced by id.

import {ENCreatureType, ENSize} from "../Race"
import {AbilityIncrease, FeatureGrant, Grants} from "./features"
import {StartingEquipment} from "./items"

export interface Background {
  id: string                                                                                                            //IMPORTANT: same as the object key
  name: string
  description: string
  source: string

  abilityScores: AbilityIncrease                                                                                        //+2/+1 or +1/+1/+1 among the three listed
  feat: FeatureGrant                                                                                                    //origin feat, level 1; presetChoices fix what the background decides
  grants: Pick<Grants, 'skillProficiencies' | 'toolProficiencies'>
  equipment: StartingEquipment[]                                                                                        //[A, B]
}

//a frame (type, size, speed) + level-gated trait grants
export interface Race {
  id: string                                                                                                            //IMPORTANT: same as the object key
  name: string
  description: string
  source: string
  lineageOf?: string                                                                                                    //groups lineage entries printed separately (elf, gnome, tiefling)

  type: ENCreatureType
  size: ENSize[]                                                                                                        //several = pick one at creation
  speed: { walk: number }                                                                                               //feet
  features: FeatureGrant[]                                                                                              //senses, resistances, spellcasting… all come from these
}
