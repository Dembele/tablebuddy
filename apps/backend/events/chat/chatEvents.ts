//Chat: plain messages from anyone; `/roll <formula>` posts at once for the DM only (their own input needs no verdict, Doctrine) —
//players roll through a request (sheet buttons / the dock's free roll) so the DM rules on it.
import {GameHub} from "@backend/events/main"
import {evaluator} from "@backend/services/Evaluator"
import {handleMessage} from "@backend/events/_utils/handleMessage"

const maxLength = 2000

export function registerChatEvents(hub: GameHub) {
  hub.procedure("chat-message", async ({data, room, user, campaign, $all, $self}) => {
    const message = typeof data.message === 'string' ? data.message.trim().slice(0, maxLength) : ''
    if (!message) return

    if (message.startsWith("/")) {
      const [command, ...rest] = message.slice(1).split(" ")
      const formula = rest.join(" ").trim()

      if (command === "roll" || command === "r") {
        if (user.role !== 'ГМ') return $self("system-message", {message: {type: "system", content: "Игроки бросают через запрос: кнопки листа или «Свободный бросок»"}})
        if (!formula) return $self("system-message", {message: {type: "system", content: "Формат: /roll 2d6+3"}})
        const posted = await handleMessage({
          type: "roll",
          campaignId: campaign._id.toString(),
          sender: user,
          content: {formula, title: formula, rolls: [{label: "roll", output: evaluator.eval(formula)}]}
        })
        room.addMessage(posted)
        return $all("chat-message", {message: posted})
      }

      return $self("system-message", {message: {type: "system", content: "Неизвестная команда"}})
    }

    const posted = await handleMessage({campaignId: campaign._id.toString(), sender: user, content: message, type: 'chat'})
    room.addMessage(posted)
    $all("chat-message", {message: posted})
  })
}
