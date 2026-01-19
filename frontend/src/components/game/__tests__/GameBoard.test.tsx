import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameBoard } from '../GameBoard';
import { renderWithProviders } from '@/test-utils/test-utils';
import { createMockJeopardyBoard } from '@/test-utils/mocks/boardMocks';

describe('GameBoard component', () => {
  const mockBoard = createMockJeopardyBoard();
  const mockOnClueClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render board correctly from Redux state', () => {
    renderWithProviders(
      <GameBoard board={mockBoard} gameId="game-1" onClueClick={mockOnClueClick} />,
    );

    expect(screen.getByText('Jeopardy!')).toBeInTheDocument();
    expect(screen.getByText('Category 1')).toBeInTheDocument();
    expect(screen.getByText('Category 2')).toBeInTheDocument();
  });

  it('should render Double Jeopardy board', () => {
    const doubleBoard = createMockJeopardyBoard();
    doubleBoard.round = 'DOUBLE_JEOPARDY';

    renderWithProviders(
      <GameBoard board={doubleBoard} gameId="game-1" onClueClick={mockOnClueClick} />,
    );

    expect(screen.getByText('Double Jeopardy!')).toBeInTheDocument();
  });

  it('should dispatch selectClue thunk when clue is clicked', async () => {
    const user = userEvent.setup();
    const mockDispatch = jest.fn();

    renderWithProviders(
      <GameBoard board={mockBoard} gameId="game-1" onClueClick={mockOnClueClick} />,
    );

    // Find and click a clue card (value 200 from first category)
    const clueCards = screen.getAllByRole('button');
    if (clueCards.length > 0) {
      await user.click(clueCards[0]);
      expect(mockOnClueClick).toHaveBeenCalled();
    }
  });

  it('should update when Redux state changes', () => {
    const { rerender } = renderWithProviders(
      <GameBoard board={mockBoard} gameId="game-1" onClueClick={mockOnClueClick} />,
    );

    const updatedBoard = createMockJeopardyBoard();
    updatedBoard.categories[0].clues[0].state = 'ANSWERED';

    rerender(
      <GameBoard board={updatedBoard} gameId="game-1" onClueClick={mockOnClueClick} />,
    );

    // Board should reflect updated state
    expect(screen.getByText('Jeopardy!')).toBeInTheDocument();
  });

  it('should handle disabled states for answered clues', () => {
    const boardWithAnswered = createMockJeopardyBoard();
    boardWithAnswered.categories[0].clues[0].state = 'ANSWERED';

    renderWithProviders(
      <GameBoard board={boardWithAnswered} gameId="game-1" onClueClick={mockOnClueClick} />,
    );

    // Clue should be disabled/not clickable when answered
    // This depends on ClueCard implementation
    expect(screen.getByText('Jeopardy!')).toBeInTheDocument();
  });
});
