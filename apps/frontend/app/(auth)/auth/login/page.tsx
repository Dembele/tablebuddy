//Login page: guests only; the form reads ?returnTo, so it sits in a Suspense boundary.
import {Suspense} from "react"
import LoginForm from "@frontend/app/(auth)/auth/login/page.client"
import {assertGuest} from "@frontend/_util/session"

export default async function LoginPage() {
  await assertGuest()

  return (
    <div className="container py-5 align-self-center">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-4"><Suspense><LoginForm/></Suspense></div>
      </div>
    </div>
  )
}
