import LpLockForm from '@/components/lp-lock-form';
import { Suspense } from "react";

export default function LockLpPage() {
  return (
    <div className="h-full flex md:items-center mt-10 md:mt-0">
      <div className="container mx-auto px-4">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-gray-500 text-lg animate-pulse">
                Loading...
              </div>
            </div>
          }
        >
          <LpLockForm />
        </Suspense>
      </div>
    </div>
  );
}
