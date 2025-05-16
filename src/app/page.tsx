import { auth, signIn, signOut } from "@/auth"
import React from 'react'

const page =async () => {
  return (
    <div>
      <SignIn />
      <form action={async ()=>{
        "use server"
        signOut()
      }}>
        <button>Sign Out</button>
      </form>
    </div>
  )
}

export default page 

export function SignIn() {
  return (
    <form
      action={async (formData) => {
        "use server"
        await signIn("credentials", formData)
      }}
    >
      <label>
        Email
        <input name="email" type="email" />
      </label>
      <label>
        Password
        <input name="password" type="password" />
      </label>
      <button>Sign In</button>
    </form>
  )
}