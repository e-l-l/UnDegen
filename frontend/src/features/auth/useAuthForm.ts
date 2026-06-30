import { useState } from "react"

import { supabase } from "@/utils/supabase"

export type AuthMode = "login" | "signup"

type FieldErrors = {
  name?: string
  email?: string
  password?: string
  form?: string
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// All auth behaviour, no JSX — both the mobile and desktop layouts consume this
// single hook so there is zero duplicated logic. Session changes are picked up
// by useSession (onAuthStateChange), which flips the app out of the auth screen.
export function useAuthForm(initialMode: AuthMode = "login") {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  function switchMode(next: AuthMode) {
    setMode(next)
    setErrors({})
  }

  function validate(): boolean {
    const next: FieldErrors = {}
    if (mode === "signup" && !name.trim()) next.name = "Required"
    if (!EMAIL_RE.test(email)) next.email = "Enter a valid email"
    if (password.length < 8) next.password = "At least 8 characters"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit() {
    if (submitting || !validate()) return
    setSubmitting(true)
    try {
      const { error } =
        mode === "signup"
          ? await supabase.auth.signUp({
              email,
              password,
              // name is display-only metadata — never used for authorization
              options: { data: { name: name.trim() } },
            })
          : await supabase.auth.signInWithPassword({ email, password })
      if (error) setErrors({ form: error.message })
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : "Something went wrong. Try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return {
    mode,
    switchMode,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    passwordVisible,
    setPasswordVisible,
    submitting,
    errors,
    submit,
  }
}

export type AuthForm = ReturnType<typeof useAuthForm>
