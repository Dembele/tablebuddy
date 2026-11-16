//Signed-in area: session checked on the server, user handed to the header.
import {ReactNode} from "react"
import Header from "@frontend/components/Layout/Header"
import {requireUser} from "@frontend/_util/session"

export default async function MainLayout({children}: { children: ReactNode }) {
  const user = await requireUser()

  return (
    <>
      <Header user={user}/>
      <main className="flex-grow-1 py-4">{children}</main>
    </>
  )
}
