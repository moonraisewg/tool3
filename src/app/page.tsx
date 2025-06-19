import ListPools from "@/components/list-pool";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Locked Liquidity Pools",
  description:
    "View and manage all your currently locked liquidity pools in one place. Track LP tokens, lock status, and take control of your decentralized finance positions easily.",
};

export default function Dashboard() {
  return (
    <div className="max-h-[calc(100vh-60px)] overflow-y-auto"> <ListPools /></div>
  );
}
