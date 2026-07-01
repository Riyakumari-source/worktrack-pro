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
(1, 'IA00001', 'RAHUL ASHOK KANGANE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'ADMIN'),
(2, 'IA00002', 'RAJESH PARKHI', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'ADMIN'),
(3, 'IA00003', 'PRAVIN MARATHE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(4, 'IA00004', 'ASHWINI BHIMRAO KAMBLE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(5, 'IA00005', 'SHWETA AJAY DALVI', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(6, 'IA00014', 'VRUSHALI U HIRVE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(7, 'IA00019', 'ROHAN SANDEEP TAPDIYA', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(8, 'IA00022', 'AKANKSHA GANPAT PHADATARE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(9, 'IA00026', 'RITESH ASHOK PARDESHI', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(10, 'IA00029', 'RAKHI SHUKRANT RAUT', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(11, 'IA00088', 'SMRUTI ROKADE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(12, 'IA00090', 'PRASAD VASANT MALI', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(13, 'IA00092', 'MEENA LONDHE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(14, 'IA00093', 'AARYAN SONAR', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(15, 'IA00096', 'RISHIKESH SAHASRABUDHE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(16, 'IA00104', 'NIYATI PANDHARINATH WADEKAR', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(17, 'IA00107', 'SHIVSHANKAR SURYKANT SAWARIKAR', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(18, 'IA00108', 'ROHIT PRALHAD KADAM', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(19, 'IA00110', 'ADITYA PATIL', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(20, 'IA00111', 'AVANTIKA AJAY BHADKE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(21, 'IA00112', 'VINEET PINGALE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(22, 'IA00113', 'RIYA KUMARI', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(23, 'IA00114', 'DIPALI MUDABE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(24, 'IA00115', 'RUTUJA DIPAK SHITOLE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(25, 'IA00116', 'DIPTI WAGHMARE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(26, 'IA00117', 'MADHAV ANGAD MORE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(27, 'IA00119', 'SAKSHI BHAGWAN SURALKAR', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(28, 'IA00141', 'KRUNAL VIJAY JAYALE', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(29, 'IA00142', 'ANKITA SAMBHAJI GHOLAP', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(30, 'IA00143', 'Aditya Patil', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(31, 'IA00145', 'Harshada More', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(32, 'IA00146', 'Mrs. Namarata gaonkar', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(33, 'IA00147', 'Ms. Pranjal Sandeep Rankhambe', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(34, 'IA00148', 'Ms. Tanaya Shirish Gaikwad', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(35, 'IA00149', 'Mrs. Nikita Devkar', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE'),
(36, 'IA00151', 'Rajeshwari Shinde', '$2b$10$zV67Htz1Te/tGaDQK8zrrugDdcZpz59bkblxYPXr63gAP24gA8gbW', 'EMPLOYEE')
ON CONFLICT ("employeeId") DO NOTHING;
