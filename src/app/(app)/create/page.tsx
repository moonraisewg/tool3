"use client"
import { TokenCreationForm } from "@/components/token-creation-form"
import SuspenseLayout from "@/components/suspense-layout"


export default function CreateToken() {
  return (
    <div className="h-full flex md:items-center mt-10 md:mt-0">
      <div className="container mx-auto px-4 max-h-[calc(100vh-60px)] overflow-y-auto custom-scroll py-10">
        <SuspenseLayout>
          <TokenCreationForm />
        </SuspenseLayout>
      </div>
    </div>
  );
} 