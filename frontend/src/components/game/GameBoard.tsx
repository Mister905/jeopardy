'use client';

import React, { useState } from 'react';
import { ClueCard } from './ClueCard';
import type { JeopardyBoard } from '@/lib/api/types';

interface GameBoardProps {
  board: JeopardyBoard;
  gameId: string;
  onClueClick: (clueId: string, gameClueId: string) => void;
}

export function GameBoard({ board, gameId, onClueClick }: GameBoardProps) {
  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-4 text-center">
        {board.round === 'JEOPARDY' ? 'Jeopardy!' : 'Double Jeopardy!'}
      </h2>
      <div className="grid grid-cols-6 gap-2">
        {/* Category headers */}
        {board.categories.map((category, categoryIndex) => (
          <div
            key={categoryIndex}
            className="bg-blue-800 text-white p-2 rounded text-center font-bold text-sm"
          >
            {category.name}
          </div>
        ))}

        {/* Clue cards */}
        {board.categories[0]?.clues.map((_, clueIndex) =>
          board.categories.map((category, categoryIndex) => {
            const clue = category.clues[clueIndex];
            if (!clue) return null;

            return (
              <ClueCard
                key={`${categoryIndex}-${clueIndex}`}
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
