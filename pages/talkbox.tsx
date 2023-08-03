// pages/walkie.tsx

import React, { useState } from 'react';

const Talkbox: React.FC = () => {
  // We'll assume there's an input field for search or similar, so we need a state for that.
  const [inputValue, setInputValue] = useState('');

  return (
    <div className="fixed top-5 right-5 z-50 bg-white p-4 rounded-lg shadow-md">
      <label htmlFor="walkieInput" className="block text-sm font-medium text-gray-700">
        Walkie Search:
      </label>
      <div className="mt-1 relative rounded-md shadow-sm">
        <input
          type="text"
          id="walkieInput"
          className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
          placeholder="Search..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          aria-label="Search through the docs"
        />
        <div className="absolute inset-y-0 right-0 flex items-center">
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md"
            aria-label="Search">
            Go
          </button>
        </div>
      </div>
    </div>
  );
};

export default Talkbox;