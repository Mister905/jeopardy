'use client';

import React from 'react';
import Link from 'next/link';
import type { GameState } from '@/lib/api/types';

interface GameCardProps {
  id: string;
  state: GameState;
  score: number;
  createdAt: string;
  updatedAt: string;
}

export function GameCard({
  id,
  state,
  score,
  createdAt,
  updatedAt,
}: GameCardProps) {
  const formatScore = (score: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(score);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStateBadge = (state: GameState) => {
    const badges = {
      PENDING: { text: 'Not Started', color: 'bg-gray-500' },
      ACTIVE: { text: 'In Progress', color: 'bg-blue-500' },
      FINAL_PENDING: { text: 'Final Jeopardy', color: 'bg-purple-500' },
      FINAL_ACTIVE: { text: 'Final Jeopardy', color: 'bg-purple-500' },
      COMPLETED: { text: 'Completed', color: 'bg-green-500' },
      ELIMINATED: { text: 'Eliminated', color: 'bg-red-500' },
    };

    const badge = badges[state];
    return (
      <span
        className={`px-2 py-1 rounded text-white text-xs font-semibold ${badge.color}`}
      >
        {badge.text}
      </span>
    );
  };

  return (
    <Link
      href={`/games/${id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        {getStateBadge(state)}
        <span className="text-sm text-gray-500">
          {formatDate(updatedAt)}
        </span>
      </div>
      <div className="mt-2">
        <p className="text-lg font-semibold">
          Score: {formatScore(score)}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Created: {formatDate(createdAt)}
        </p>
      </div>
    </Link>
  );
}
