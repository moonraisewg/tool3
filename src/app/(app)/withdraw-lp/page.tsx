import SuspenseLayout from "@/components/suspense-layout";
import Withdraw from "@/components/withdraw-form";

export default function WithdrawLP() {
  return (
    <div className="h-full flex md:items-center mt-10 md:mt-0">
      <div className="container mx-auto px-4">
        <SuspenseLayout>
          <Withdraw />
        </SuspenseLayout>

      </div>
    </div>
  );
}
