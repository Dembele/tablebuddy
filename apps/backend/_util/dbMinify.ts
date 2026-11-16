import {Schema} from 'mongoose'
import {typedEntries} from "@backend/deps/_util/translationMap"

// Helper to check if a value is a plain field definition (e.g., { type: String, required: true })
function isPlainFieldDef(value: any): boolean {
  return value && typeof value === 'object' && !Array.isArray(value) && 'type' in value;
}

// Helper to check if a value is a subschema definition (plain object without 'type')
function isSubSchemaDef(value: any): boolean {
  return value && typeof value === 'object' && !Array.isArray(value) && !('type' in value);
}

// Helper to check if a value is a Schema instance
function isSchemaInstance(value: any): boolean {
  return value instanceof Schema;
}

// Recursive function to create the schema
// - Processes plain defs, wrapping nested objects/arrays appropriately
// - Handles pre-built Schema instances (e.g., from reusable functions like proficiencySchema)
// - Adds default: undefined to nested fields unless already specified
// - Sets _id: false for nested schemas
// - Supports custom options (e.g., { timestamps: true }) at top level
export function createSchema<T = any>(def: any, options: any = {}, isNested: boolean = false): Schema<T> {
  const processed: any = {};

  for (const [key, value] of typedEntries(def)) {
    if (isPlainFieldDef(value)) {
      // Already a field def (e.g., { type: String, required: true }) - copy as is
      // If no default and it's a nested type (Schema or [Schema]), add default: undefined
      const fieldDef = { ...value };
      if (!('default' in fieldDef) && (isSchemaInstance(fieldDef.type) || (Array.isArray(fieldDef.type) && fieldDef.type.length === 1 && isSchemaInstance(fieldDef.type[0])))) {
        fieldDef.default = undefined;
      }
      processed[key] = fieldDef;
    } else if (isSchemaInstance(value)) {
      console.warn('Using Pre-built schema instance, are you sure this is intended?')
      // Pre-built schema instance - wrap with default: undefined (moved before isSubSchemaDef to avoid recursion)
      processed[key] = {
        type: value,
        default: undefined,
      };
    } else if (isSubSchemaDef(value)) {
      // Plain nested object - recurse to create sub-schema
      const subSchema = createSchema(value, {}, true);
      processed[key] = {
        type: subSchema,
        default: undefined,
        // You can add required here if needed, e.g., based on a flag in value, but since it's optional, assume user specifies in def
      };
    } else if (Array.isArray(value) && value.length === 1) {
      const item = value[0];
      if (isSchemaInstance(item)) {
        // Array of pre-built schemas (moved before isSubSchemaDef to avoid recursion)
        processed[key] = {
          type: [item],
          default: undefined,
        };
      } else if (isSubSchemaDef(item)) {
        // Array of plain nested objects - recurse
        const subSchema = createSchema(item, {}, true);
        processed[key] = {
          type: [subSchema],
          default: undefined,
        };
      } else {
        // Other array (e.g., [String])
        processed[key] = value;
      }
    } else {
      // Fallback: simple types or other - copy as is
      processed[key] = value;
    }
  }

  // Apply schema options
  const schemaOptions = { ...options };
  if (isNested && !('_id' in schemaOptions)) {
    schemaOptions._id = false;
  }

  return new Schema<T>(processed, schemaOptions);
}