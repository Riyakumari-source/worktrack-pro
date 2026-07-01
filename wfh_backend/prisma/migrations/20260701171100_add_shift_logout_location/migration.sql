-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "endAddress" TEXT,
ADD COLUMN     "endLatitude" DOUBLE PRECISION,
ADD COLUMN     "endLocationFetchedAt" TIMESTAMP(3),
ADD COLUMN     "endLongitude" DOUBLE PRECISION;
