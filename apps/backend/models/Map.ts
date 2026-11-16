//A campaign map: background image, grid alignment, tokens and fog (the canvas layer reads them; no game logic does).
//A library map (isTemplate, no campaign) holds monster placements instead of tokens — see services/MapLibrary.
import mongoose, {Model, model, Schema, SchemaDefinition} from 'mongoose'
import {IMap} from "@backend/deps/interfaces/DB/Map"

const MapDef: SchemaDefinition<IMap> = {
  campaign: {type: Schema.Types.ObjectId, ref: 'Campaign', index: true},
  name: {type: String, required: true, trim: true},
  description: {type: String, default: ''},
  backgroundImagePath: {type: String, required: true},
  thumbnailPath: String,
  gridType: {type: String, enum: ['square', 'none'], default: 'square'},
  gridConfig: {
    size: {
      x: {type: Number, default: 20, min: 1},
      y: {type: Number, default: 20, min: 1}
    },
    color: {type: String, default: '#000000'},
    offset: {
      top: {type: Number, default: 0},
      bottom: {type: Number, default: 0},
      right: {type: Number, default: 0},
      left: {type: Number, default: 0}
    },
    cellSize: {
      x: {type: Number, default: 50, min: 5},
      y: {type: Number, default: 50, min: 5}
    },
    feats: {type: Number, default: 5},
    opacity: {type: Number, min: 0, max: 1, default: 0.8}
  },
  tokens: [{
    character: {type: Schema.Types.ObjectId, ref: 'Character', required: true},
    position: {
      x: {type: Number, required: true},
      y: {type: Number, required: true}
    },
    visible: {type: Boolean, default: true},
  }],
  isTemplate: Boolean,
  placements: {
    type: [{
      monster: {type: String, required: true},
      position: {x: {type: Number, required: true}, y: {type: Number, required: true}},
      visible: {type: Boolean, default: false}
    }],
    default: undefined
  },
  fogOfWar: {
    enabled: {type: Boolean, default: false},
    exploredAreas: {type: String, default: ''}
  }
}

//plain Schema, not createSchema: gridConfig / fogOfWar must exist on every map (nested defaults applied on insert)
const MapSchema = new Schema<IMap>(MapDef, {timestamps: true, minimize: false})

MapSchema.index({name: 'text', campaign: 1})

export const Map: Model<IMap> = mongoose.models.Map || model<IMap>('Map', MapSchema)