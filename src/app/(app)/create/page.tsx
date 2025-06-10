"use client"
import TokenCreationForm from "@/components/token-creation-form"
import SuspenseLayout from "@/components/suspense-layout"

export default function CreateToken() {
  return (
    <div className="h-full">
      <SuspenseLayout>
        <TokenCreationForm />
      </SuspenseLayout>
                            </div>
  );
} 