-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "parent_id" INTEGER,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);
