import type { Metadata } from "next"
import CreateMeteoraDammPool from "@/components/create-pool/create-meteora-damm-pool";

export const metadata: Metadata = {
    title: "Meteora DAMM",
    description: "Create a new pool with Meteora DAMM",
}

export default function CreatePoolWithMeteoraDamm() {
    return (
        <div className="h-full flex md:items-center mt-10 md:mt-0">
            <div className="container mx-auto px-4">
                <CreateMeteoraDammPool />
            </div>
        </div>
    );
}
