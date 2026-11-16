//Character editor (DM only): raw stored data (formulas included) plus the registry options the form needs.
import {getEvaluatedCharacter, getRawCharacter} from "@frontend/actions/characters"
import {editorOptions} from "@frontend/components/Character/editor/options"
import CharacterEditor from "@frontend/app/(main)/characters/[id]/edit/page.client"
import {requireUser} from "@frontend/_util/session"
import {redirect} from "next/navigation"

export default async function EditCharacterPage({params}: { params: Promise<{ id: string }> }) {
  const {id} = await params
  const [user, {data: character, message}, {data: evaluated}] = await Promise.all([requireUser(), getRawCharacter(id), getEvaluatedCharacter(id)])
  if (user.role !== 'ГМ') redirect(`/characters/${id}`) //raw values are the DM's (Doctrine)
  if (!character) return <div className="container"><div className="alert alert-danger">{message}</div></div>

  return (
    <div className="container">
      <CharacterEditor id={id} initial={character} options={editorOptions(character, user.role === 'ГМ', evaluated)}/>
    </div>
  )
}
