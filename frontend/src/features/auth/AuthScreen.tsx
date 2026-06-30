import { AuthForm } from "./AuthForm"
import { BrandPanel } from "./BrandPanel"
import { useAuthForm } from "./useAuthForm"

// Responsive shell. < lg: single column (the form fills the screen, spacers do
// the vertical rhythm). >= lg: two-pane split — brand panel + centred 340px form.
// useAuthForm lives here so form state survives a resize across the breakpoint.
export function AuthScreen() {
  const auth = useAuthForm("login")

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <BrandPanel mode={auth.mode} className="hidden lg:flex" />
      <main className="flex flex-1 flex-col px-7.5 lg:items-center lg:justify-center lg:px-10">
        <AuthForm auth={auth} />
      </main>
    </div>
  )
}
