"use client"

import TokenReviewForm from "@/components/token-review-form"
import SuspenseLayout from "@/components/suspense-layout"

export default function ReviewToken() {
  return (
    <div className="h-full">
      <SuspenseLayout>
        <TokenReviewForm />
      </SuspenseLayout>
      </div>
  )
} 