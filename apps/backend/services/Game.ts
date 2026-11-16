/*
* TODO: This is a class that will query characters, map and init this for use-ready frontend
*  plus, this will store and drive events
*/

import {ICampaign} from "@backend/deps/interfaces/DB/Campaign";
import {Campaign} from "@backend/models/Campaign";

export class Game {
  private gamesData = new Map<string, ICampaign>

  public async get(id: string): Promise<ICampaign> {
    try {
      if (this.gamesData.has(id))
        return this.gamesData.get(id)!


      const campaign = await Campaign.findById(id)
      if (!campaign) throw new Error(`Failed to find campaign with _id: ${id}`)

      this.gamesData.set(id, campaign)
      return this.gamesData.get(id)!
    }
    catch (error) {
      this.gamesData.delete(id)
      console.error('Failed to initialize campaign:', error)
      throw error
    }
  }
}