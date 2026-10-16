import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function StaffLoginPage() {
  return (
    <main className="mx-auto w-full max-w-xs flex-1 px-4 py-20">
      <h1 className="mb-6 text-center text-2xl font-bold">직원 로그인</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
