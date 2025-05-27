"use client";

import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col ">
      {/* Main Content */}
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Image */}
            <div className="bg-gradient-to-br from-purple-900/40 to-purple-600/20 rounded-xl p-2 flex items-center justify-center">
              <div className="relative w-full max-w-sm aspect-[4/3]">
                <Image
                  src="/atm.svg"
                  alt="ATM Machine"
                  width={400}
                  height={400}
                  className="object-contain"
                />
              </div>
            </div>

            {/* Right Column - Stats */}
            <div className="bg-gray-900/50 rounded-xl p-4 max-w-[100vw]">
              <div>diptszyx</div>
              <span className="truncate block">AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
