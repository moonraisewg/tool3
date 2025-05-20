'use client';

import { useState } from 'react';
import Withdraw from './withdraw-form';
import Burn from './burn-form';

export default function WithdrawAndBurnTabs() {
  const [activeTab, setActiveTab] = useState<'withdraw' | 'burn'>('withdraw');

  return (
    <div className="rounded-lg border border-gray-500 bg-white p-6 shadow-sm">
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('withdraw')}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors cursor-pointer ${activeTab === 'withdraw'
            ? 'bg-purple-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          Withdraw
        </button>
        <button
          onClick={() => setActiveTab('burn')}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors cursor-pointer ${activeTab === 'burn'
            ? 'bg-red-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          Burn
        </button>
      </div>
      {activeTab === 'withdraw' ? <Withdraw /> : <Burn />}
    </div>
  );
}
