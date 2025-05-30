"use client";

import { Suspense, ReactNode } from "react";

export default function SuspenseLayout({ children }: { children: ReactNode }) {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center h-[300px]">
                    <div className="text-gray-500 text-lg animate-pulse">
                        Loading...
                    </div>
                </div>
            }
        >
            {children}
        </Suspense>
    );
}
