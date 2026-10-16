import { Suspense } from "react";
import { STORE_NAME } from "@/lib/store-info";
import { LoginForm } from "./login-form";

export default function StaffLoginPage() {
  return (
    <main className="w-full flex-1 bg-white px-4 py-20">
      <div className="mx-auto max-w-xs">
        <p className="text-center text-sm text-ink/50">{STORE_NAME}</p>
        <h1 className="mt-1 mb-6 text-center text-2xl font-bold">직원 로그인</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
