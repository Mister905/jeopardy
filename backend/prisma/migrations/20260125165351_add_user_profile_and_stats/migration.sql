/*
  Warnings:

  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- Step 1: Add all statistics columns and username as nullable
ALTER TABLE "User" ADD COLUMN     "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "bestScore" INTEGER,
ADD COLUMN     "currentCorrectStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentIncorrectStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyDoubleCorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyDoubleIncorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "doubleJeopardyCorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "doubleJeopardyIncorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "finalJeopardyCorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "finalJeopardyIncorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "jeopardyCorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "jeopardyIncorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "largestSuccessfulDailyDoubleWager" INTEGER,
ADD COLUMN     "largestSuccessfulFinalJeopardyWager" INTEGER,
ADD COLUMN     "largestUnsuccessfulDailyDoubleWager" INTEGER,
ADD COLUMN     "largestUnsuccessfulFinalJeopardyWager" INTEGER,
ADD COLUMN     "longestCorrectStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "longestIncorrectStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCorrectAnswers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalGamesPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalIncorrectAnswers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalWinnings" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "username" TEXT,
ADD COLUMN     "worstScore" INTEGER;

-- Step 2: Update existing users to set username = email
UPDATE "User" SET "username" = "email" WHERE "username" IS NULL;

-- Step 3: Make username column required (NOT NULL)
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
