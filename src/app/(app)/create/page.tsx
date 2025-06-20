"use client"
import { TokenCreationForm } from "@/components/token-creation-form"
import SuspenseLayout from "@/components/suspense-layout"

export default function CreateToken() {
  return (
    <div className="max-h-[calc(100vh-60px)] overflow-y-auto">
      <SuspenseLayout>
        <TokenCreationForm />
      </SuspenseLayout>
    </div>
  );
} 