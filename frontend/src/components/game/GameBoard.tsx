'use client';

import React, { useState } from 'react';
import { ClueCard } from './ClueCard';
import type { JeopardyBoard } from '@/lib/api/types';

interface GameBoardProps {
  board: JeopardyBoard;
  gameId: string;
  onClueClick: (clueId: string, gameClueId: string) => void;
  userEmail?: string;
}

export function GameBoard({ board, gameId, onClueClick, userEmail }: GameBoardProps) {
  // Ensure we have exactly 6 categories (no duplicates)
  const uniqueCategories = board.categories.filter(
    (category, index, self) => 
      index === self.findIndex((c) => c.name === category.name)
  );

  if (uniqueCategories.length !== board.categories.length) {
    console.warn('[GameBoard] Duplicate categories detected:', {
      original: board.categories.length,
      unique: uniqueCategories.length,
      categories: board.categories.map(c => c.name),
    });
  }

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-4 text-center text-white">
        {userEmail || (board.round === 'JEOPARDY' ? 'Jeopardy!' : 'Double Jeopardy!')}
      </h2>
      <div 
        className="grid grid-cols-6 gap-2 p-4 rounded-lg"
        style={{
          border: '4px solid #3F3A3E',
          backgroundColor: '#081856',
        }}
      >
        {/* Category headers */}
        {uniqueCategories.map((category, categoryIndex) => (
          <div
            key={`category-${categoryIndex}-${category.name}`}
            className="text-white h-20 flex items-center justify-center rounded-lg text-center font-bold text-sm border-2"
            style={{
              backgroundColor: '#001AA5',
              borderColor: '#00188C',
            }}
          >
            {category.name}
          </div>
        ))}

        {/* Clue cards */}
        {uniqueCategories[0]?.clues.map((_, clueIndex) =>
          uniqueCategories.map((category, categoryIndex) => {
            const clue = category.clues[clueIndex];
            if (!clue) return null;

            return (
              <ClueCard
                key={`clue-${categoryIndex}-${clueIndex}-${clue.gameClueId}`}
                clue={clue}
                onClick={() => onClueClick(clue.clueId, clue.gameClueId)}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
