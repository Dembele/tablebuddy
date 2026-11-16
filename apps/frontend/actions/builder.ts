'use server'
//Builder server actions: plan (pure walk on the Next server, rulebook stays server-side) and commit (the backend re-runs the walk and saves).
import {Answers, BuildResult, buildCreation, buildLevelUp, Problems, Question} from "@frontend/deps/builder/_index"
import {ICharacter} from "@frontend/deps/interfaces/DB/Character"
import api from "@frontend/_util/api"
import {revalidatePath} from "next/cache"
import {summarize, Summary} from "@frontend/_util/buildSummary"

export type BuildMode = 'creation' | 'levelUp'

export interface Plan {
  questions: Question[]
  missing: string[]
  problems: Problems
  notes: string[]
  summary: Summary
}

const builders: Record<BuildMode, (character: ICharacter, answers: Answers) => BuildResult> = {creation: buildCreation, levelUp: buildLevelUp}

const toPlan = (built: BuildResult): Plan =>
  ({questions: built.questions, missing: built.missing, problems: built.problems, notes: built.notes, summary: summarize(built.character)})

export async function planBuild(mode: BuildMode, base: ICharacter, answers: Answers): Promise<Plan> {
  return toPlan(builders[mode](base, answers))
}

//the backend runs the same walk on the stored character and saves it; only the answers travel
export async function commitBuild(mode: BuildMode, id: string, answers: Answers): Promise<{ ok: boolean; message: string }> {
  const saved = await api<void>('post', `/character/${id}/build`, {mode, answers})
  revalidatePath(`/characters/${id}`)
  return {ok: saved.isSuccess, message: saved.isSuccess ? 'Сохранено' : saved.message}
}
