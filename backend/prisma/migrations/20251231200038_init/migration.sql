-- CreateEnum
CREATE TYPE "GameState" AS ENUM ('PENDING', 'ACTIVE', 'FINAL_PENDING', 'FINAL_ACTIVE', 'ELIMINATED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ClueState" AS ENUM ('UNANSWERED', 'ANSWERED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "Round" AS ENUM ('JEOPARDY', 'DOUBLE_JEOPARDY', 'FINAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" "GameState" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clue" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "round" "Round" NOT NULL,
    "value" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "dailyDouble" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameClue" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "clueId" TEXT NOT NULL,
    "state" "ClueState" NOT NULL DEFAULT 'UNANSWERED',
    "wager" INTEGER,
    "scoreDelta" INTEGER,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "GameClue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalJeopardy" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "clueId" TEXT NOT NULL,
    "wager" INTEGER NOT NULL,
    "correct" BOOLEAN,
    "scoreDelta" INTEGER,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "FinalJeopardy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAudit" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FinalJeopardy_gameId_key" ON "FinalJeopardy"("gameId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameClue" ADD CONSTRAINT "GameClue_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameClue" ADD CONSTRAINT "GameClue_clueId_fkey" FOREIGN KEY ("clueId") REFERENCES "Clue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalJeopardy" ADD CONSTRAINT "FinalJeopardy_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalJeopardy" ADD CONSTRAINT "FinalJeopardy_clueId_fkey" FOREIGN KEY ("clueId") REFERENCES "Clue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAudit" ADD CONSTRAINT "GameAudit_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
