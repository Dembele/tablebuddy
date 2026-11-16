import {Formula} from "../../types/internal/Formula"
import {ENReset} from "../../types/Reset"

export interface Resource {
  name: string;
  max: Formula
  current?: number //runtime only
  resetsOn: ENReset
}