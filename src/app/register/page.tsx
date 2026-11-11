import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "ثبت‌نام | تسک منیجر" };

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
