import LpLockForm from '@/components/lp-lock-form';
import SuspenseLayout from "@/components/suspense-layout";

export default function LockLpPage() {
  return (
    <div className="h-full flex md:items-center mt-10 md:mt-0">
      <div className="container mx-auto px-4">
        <SuspenseLayout>
          <LpLockForm />
        </SuspenseLayout>
      </div>
    </div>
  );
}
