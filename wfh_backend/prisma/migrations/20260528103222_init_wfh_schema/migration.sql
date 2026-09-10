-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
        CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLOYEE');
    END IF;
END
$$;

-- CreateTable "reg_users"
CREATE TABLE IF NOT EXISTS "reg_users" (
    "id" SERIAL NOT NULL,
    "employeeId" TEXT,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reg_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable "Screenshot"
CREATE TABLE IF NOT EXISTS "Screenshot" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "activeWindow" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'Uploaded',

    CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable "Shift"
CREATE TABLE IF NOT EXISTS "Shift" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "shiftStartTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shiftEndTime" TIMESTAMP(3),
    "shiftStartLocation" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "pdfReportName" TEXT,
    "pdfReportSize" TEXT,
    "pdfReportUploadedAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "startAddress" TEXT,
    "locationFetchedAt" TIMESTAMP(3),

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable "Break"
CREATE TABLE IF NOT EXISTS "Break" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Used',

    CONSTRAINT "Break_pkey" PRIMARY KEY ("id")
);

-- CreateTable "Task"
CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable "TelemetryLog"
CREATE TABLE IF NOT EXISTS "TelemetryLog" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "isMoving" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "reg_users_employeeId_key" ON "reg_users"("employeeId");

-- Create unique index for active shifts
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_shift" ON "Shift"("userId") WHERE "status" = 'Active';

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Screenshot_userId_fkey') THEN
        ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "reg_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Shift_userId_fkey') THEN
        ALTER TABLE "Shift" ADD CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "reg_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Break_shiftId_fkey') THEN
        ALTER TABLE "Break" ADD CONSTRAINT "Break_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_shiftId_fkey') THEN
        ALTER TABLE "Task" ADD CONSTRAINT "Task_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TelemetryLog_shiftId_fkey') THEN
        ALTER TABLE "TelemetryLog" ADD CONSTRAINT "TelemetryLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- Seed Data using ON CONFLICT DO NOTHING
INSERT INTO "reg_users" ("id", "employeeId", "name", "password", "role") VALUES
(1, 'WFH1', 'Aarav Sharma', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'ADMIN'),
(2, 'WFH2', 'Priya Verma', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'ADMIN'),
(3, 'WFH3', 'Rohan Patel', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(4, 'WFH4', 'Ananya Gupta', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(5, 'WFH5', 'Aditya Singh', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(6, 'WFH6', 'Neha Sharma', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(7, 'WFH7', 'Kavya Nair', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(8, 'WFH8', 'Siddharth Joshi', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(9, 'WFH9', 'Pooja Iyer', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(10, 'WFH10', 'Vikram Malhotra', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(11, 'WFH11', 'Sneha Reddy', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(12, 'WFH12', 'Amitabh Roy', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(13, 'WFH13', 'Meera Pillai', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(14, 'WFH14', 'Aryan Sonar', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(15, 'WFH15', 'Rishikesh Kulkarni', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(16, 'WFH16', 'Niyati Wadekar', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(17, 'WFH17', 'Shivshankar Sawant', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(18, 'WFH18', 'Rohit Kadam', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(19, 'WFH19', 'Varun Rao', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(20, 'WFH20', 'Avantika Bhadke', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(21, 'WFH21', 'Vineet Pingale', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(22, 'WFH22', 'RIYA KUMARI', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(23, 'WFH23', 'Deepali Mudgal', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(24, 'WFH24', 'Rutuja Shitole', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(25, 'WFH25', 'Dipti Waghmare', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(26, 'WFH26', 'Madhav More', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(27, 'WFH27', 'Sakshi Suralkar', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(28, 'WFH28', 'Krunal Jayale', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(29, 'WFH29', 'Ankita Gholap', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(30, 'WFH30', 'Arjun Mehta', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(31, 'WFH31', 'Harshada More', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(32, 'WFH32', 'Namrata Gaonkar', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(33, 'WFH33', 'Pranjal Rankhambe', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(34, 'WFH34', 'Tanaya Gaikwad', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(35, 'WFH35', 'Nikita Devkar', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(36, 'WFH36', 'Rajeshwari Shinde', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE')
ON CONFLICT ("employeeId") DO NOTHING;
