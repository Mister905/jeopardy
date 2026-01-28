'use client';

import React from 'react';
import { ClueCard } from './ClueCard';
import type { JeopardyBoard } from '@/lib/api/types';
import '@/styles/components/GameBoard.scss';

interface GameBoardProps {
  board: JeopardyBoard;
  gameId: string;
  onClueClick: (clueId: string, gameClueId: string) => void;
  username?: string;
}

export function GameBoard({ board, gameId, onClueClick, username }: GameBoardProps) {
  return (
    <div className="game-board w-full p-4 rounded-lg">
      <h2 className="text-2xl font-bold mb-4 text-center text-white">
        {username || (board.round === 'JEOPARDY' ? 'Jeopardy!' : 'Double Jeopardy!')}
      </h2>
      <div className="grid grid-cols-6 gap-1">
        {/* Category headers */}
        {board.categories.map((category, categoryIndex) => (
          <div
            key={categoryIndex}
            className="game-board__category h-20 flex items-center justify-center text-white text-center font-bold text-sm rounded-sm"
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
