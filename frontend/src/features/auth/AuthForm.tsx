import type { SVGProps } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Eye, EyeOff, LogoCheck } from "./icons"
import type { AuthForm as AuthFormState } from "./useAuthForm"

const inputSizing = "lg:h-12 lg:rounded-[12px] lg:bg-surface-raised lg:text-[14.5px]"

function Spinner(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5 animate-spin" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="mt-[7px] flex items-center gap-1.5 text-[11.5px] text-ink-faint">
      <span className="size-1 rounded-full bg-destructive/70" />
      {msg}
    </p>
  )
}

export function AuthForm({ auth }: { auth: AuthFormState }) {
  const {
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
  } = auth
  const isSignup = mode === "signup"

  return (
    <div className="flex w-full flex-1 flex-col pt-[54px] lg:w-[340px] lg:flex-none lg:pt-0">
      {/* mobile vertical rhythm: push content down ~45% */}
      <div className={cn("lg:hidden", isSignup ? "flex-[0.7]" : "flex-[0.9]")} />

      {/* logo mark — mobile only (desktop logo lives in the brand panel) */}
      <span className="mb-[26px] flex size-[46px] items-center justify-center rounded-[14px] border border-border bg-surface lg:hidden">
        <LogoCheck className="size-[22px] text-pink" />
      </span>

      {/* heading + subtitle (copy differs by breakpoint, per handoff) */}
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink lg:text-[26px]">
        {isSignup ? (
          <>
            <span className="lg:hidden">Get your life on track</span>
            <span className="hidden lg:inline">Create your account</span>
          </>
        ) : (
          "Welcome back"
        )}
      </h1>
      <p className="mt-[7px] text-[14.5px] text-ink-muted">
        {isSignup ? (
          <>
            <span className="lg:hidden">Start with three reminders. Free.</span>
            <span className="hidden lg:inline">No card required.</span>
          </>
        ) : (
          <>
            <span className="lg:hidden">Pick up where you left off.</span>
            <span className="hidden lg:inline">Log in to pick up where you left off.</span>
          </>
        )}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className={cn("flex flex-col gap-3 lg:gap-[14px]", isSignup ? "mt-[28px]" : "mt-[30px]")}
      >
        {isSignup && (
          <div>
            <Label htmlFor="name" className="mb-[7px] block">
              Name
            </Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Alex Rivera"
              className={inputSizing}
              value={name}
              disabled={submitting}
              onChange={(e) => setName(e.target.value)}
            />
            <FieldError msg={errors.name} />
          </div>
        )}

        <div>
          <Label htmlFor="email" className="mb-[7px] block">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            className={inputSizing}
            value={email}
            disabled={submitting}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FieldError msg={errors.email} />
        </div>

        <div>
          <div className="mb-[7px] flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            {!isSignup && (
              <button
                type="button"
                className="text-[12px] text-ink-muted transition-colors hover:text-ink"
              >
                Forgot?
              </button>
            )}
          </div>
          <div className="relative">
            <Input
              id="password"
              type={passwordVisible ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              className={cn(
                inputSizing,
                "pr-[44px]",
                !passwordVisible && password.length > 0 && "tracking-[0.18em]"
              )}
              value={password}
              disabled={submitting}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              onClick={() => setPasswordVisible(!passwordVisible)}
              className="absolute right-[15px] top-1/2 -translate-y-1/2 text-[#555555] transition-colors hover:text-ink-body"
            >
              {passwordVisible ? (
                <EyeOff className="size-[18px]" />
              ) : (
                <Eye className="size-[18px]" />
              )}
            </button>
          </div>
          {isSignup && !errors.password ? (
            <p className="mt-[7px] text-[11.5px] text-ink-faint">At least 8 characters.</p>
          ) : (
            <FieldError msg={errors.password} />
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className={cn(
            "mt-[24px] w-full lg:h-[50px] lg:rounded-[13px] lg:text-[15.5px]",
            isSignup && "mt-[22px]"
          )}
        >
          {submitting ? <Spinner /> : isSignup ? "Create account" : "Log in"}
        </Button>

        {errors.form && (
          <p className="mt-[14px] flex items-center justify-center gap-1.5 text-center text-[12px] text-ink-faint">
            <span className="size-1 rounded-full bg-destructive/70" />
            {errors.form}
          </p>
        )}

        {isSignup && (
          <p className="mt-4 text-center text-[12px] leading-[1.5] text-ink-faint lg:hidden">
            By signing up you agree to our
            <br />
            Terms &amp; Privacy Policy.
          </p>
        )}
      </form>

      {/* mobile: push footer to bottom */}
      <div className="flex-1 lg:hidden" />

      <p className="pb-[34px] text-center text-[14px] text-ink-muted lg:mt-[26px] lg:pb-0">
        {isSignup ? "Already have an account? " : "New here? "}
        <button
          type="button"
          onClick={() => switchMode(isSignup ? "login" : "signup")}
          className="font-medium text-ink-soft transition-colors hover:text-ink"
        >
          {isSignup ? "Log in" : "Create an account"}
        </button>
      </p>
    </div>
  )
}
