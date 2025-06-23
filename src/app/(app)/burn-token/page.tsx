"use client";

import { BurnForm } from "@/components/burn/burn-form";

export default function BurnTokenPage() {
  return (
    <div className="max-h-[calc(100vh-60px)] overflow-y-auto">
      <div className="container mx-auto px-4 py-8">
        <BurnForm />
      </div>
    </div>
  );
} 