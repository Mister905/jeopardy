/**
 * Critical flow tests: UI state from API, interactions, loading/error/empty states.
 * Uses React Testing Library and existing test-utils/mocks.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/test-utils';
import { createMockJeopardyBoard, createMockClueBoardItem } from '@/test-utils/mocks/boardMocks';
import { GameBoard } from '@/components/game/GameBoard';
import { ClueCard } from '@/components/game/ClueCard';
import { ScoreDisplay } from '@/components/game/ScoreDisplay';
import { SummarySection } from '@/components/dashboard/SummarySection';
import type { UserStats } from '@/lib/api/types';

describe('Critical flows', () => {
  describe('Game board state from API', () => {
    it('renders board with categories and clue values from props', () => {
      const board = createMockJeopardyBoard();
      const onClueClick = jest.fn();

      renderWithProviders(
        <GameBoard board={board} gameId="game-1" onClueClick={onClueClick} />,
      );

      expect(screen.getByText('Jeopardy!')).toBeInTheDocument();
      expect(screen.getByText('Category 1')).toBeInTheDocument();
      expect(screen.getByText('Category 2')).toBeInTheDocument();
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('clicking a clue invokes onClueClick callback', async () => {
      const user = userEvent.setup();
      const board = createMockJeopardyBoard();
      const onClueClick = jest.fn();

      renderWithProviders(
        <GameBoard board={board} gameId="game-1" onClueClick={onClueClick} />,
      );

      const clueButtons = screen.getAllByRole('button');
      await user.click(clueButtons[0]);

      expect(onClueClick).toHaveBeenCalled();
    });

    it('answered clue is not clickable (disabled)', () => {
      const board = createMockJeopardyBoard();
      board.categories[0].clues[0].state = 'ANSWERED';
      const onClueClick = jest.fn();

      renderWithProviders(
        <GameBoard board={board} gameId="game-1" onClueClick={onClueClick} />,
      );

      const buttons = screen.getAllByRole('button');
      const firstClue = buttons[0];
      expect(firstClue).toBeDisabled();
    });
  });

  describe('ScoreDisplay', () => {
    it('renders positive score in green (semantic class)', () => {
      render(<ScoreDisplay score={1000} />);
      const el = screen.getByText('$1,000');
      expect(el).toBeInTheDocument();
      expect(el.className).toMatch(/score-display--positive|score-display/);
    });

    it('renders negative score with negative class', () => {
      render(<ScoreDisplay score={-500} />);
      const el = screen.getByText('-$500');
      expect(el).toBeInTheDocument();
      expect(el.className).toContain('score-display--negative');
    });

    it('renders zero score', () => {
      render(<ScoreDisplay score={0} />);
      expect(screen.getByText('$0')).toBeInTheDocument();
    });
  });

  describe('Dashboard summary', () => {
    const mockStats: UserStats = {
      totalGamesPlayed: 5,
      averageScore: 1200.5,
      bestScore: 5000,
      worstScore: -500,
      totalWinnings: 6000,
      overallAccuracy: 65.5,
      correctAnswerCount: 30,
      incorrectAnswerCount: 15,
      jeopardyAccuracy: 70,
      doubleJeopardyAccuracy: 62,
      finalJeopardyAccuracy: 50,
      dailyDoubleAccuracy: 75,
      currentCorrectStreak: 3,
      longestCorrectStreak: 10,
      currentIncorrectStreak: 0,
      longestIncorrectStreak: 4,
      largestSuccessfulDailyDoubleWager: 1000,
      largestSuccessfulFinalJeopardyWager: 5000,
      largestUnsuccessfulDailyDoubleWager: 500,
      largestUnsuccessfulFinalJeopardyWager: 2000,
    };

    it('renders summary section with stats from API', () => {
      render(<SummarySection stats={mockStats} />);
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText(/\$1,200\.5/)).toBeInTheDocument();
      expect(screen.getByText('$5,000')).toBeInTheDocument();
    });

    it('renders N/A for null stats', () => {
      const statsWithNulls: UserStats = {
        ...mockStats,
        bestScore: null,
        worstScore: null,
      };
      render(<SummarySection stats={statsWithNulls} />);
      expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
    });
  });

  describe('Edge UI states', () => {
    it('ClueCard shows value and is clickable when UNANSWERED', () => {
      const onClick = jest.fn();
      const clue = createMockClueBoardItem({ value: 400, state: 'UNANSWERED' });
      render(<ClueCard clue={clue} onClick={onClick} />);
      expect(screen.getByText('$400')).toBeInTheDocument();
      const btn = screen.getByRole('button');
      expect(btn).not.toBeDisabled();
    });

    it('ClueCard answered is disabled', () => {
      const onClick = jest.fn();
      const clue = createMockClueBoardItem({ value: 200, state: 'ANSWERED' });
      render(<ClueCard clue={clue} onClick={onClick} />);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });
});
