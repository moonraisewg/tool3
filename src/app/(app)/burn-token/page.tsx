"use client";

import { BurnForm } from "@/components/burn/burn-form";
import SuspenseLayout from "@/components/suspense-layout";

export default function BurnTokenPage() {
  return (
    <div className="h-full flex md:items-center mt-10 md:mt-0">
      <div className="container mx-auto px-4 max-h-[calc(100vh-60px)] overflow-y-auto custom-scroll py-10">
        <SuspenseLayout>
          <BurnForm />
        </SuspenseLayout>
      </div>
    </div>
  );
} 