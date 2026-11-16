//Register page: guests only.
import RegisterForm from "@frontend/app/(auth)/auth/register/page.client"
import {assertGuest} from "@frontend/_util/session"

export default async function RegisterPage() {
  await assertGuest()

  return (
    <div className="container py-5 align-self-center">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-4"><RegisterForm/></div>
      </div>
    </div>
  )
}
