-- CreateIndex
-- Index for efficient duplicate detection during clue ingestion
-- Optimizes queries that check for existing clues by (round, category, question, answer)
CREATE INDEX "Clue_round_category_question_answer_idx" ON "Clue"("round", "category", "question", "answer");
