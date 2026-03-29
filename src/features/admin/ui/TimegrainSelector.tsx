import React from 'react';

interface TimegrainSelectorProps {
  timegrain: string;
  setTimegrain: (tg: string) => void;
}

export const TimegrainSelector = ({ timegrain, setTimegrain }: TimegrainSelectorProps) => (
  <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
    {['week', 'month', 'year'].map((tg) => (
      <button
        key={tg}
        onClick={() => setTimegrain(tg)}
        className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
          timegrain === tg ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        {tg}
      </button>
    ))}
  </div>
);
