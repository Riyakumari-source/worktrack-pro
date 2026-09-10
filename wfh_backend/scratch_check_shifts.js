const prisma = require('./dist/lib/prisma').default;

async function main() {
  const shifts = await prisma.shift.findMany({
    take: 10,
    orderBy: { shiftStartTime: 'desc' },
    include: {
      user: {
        select: { name: true, employeeId: true }
      }
    }
  });
  console.log(JSON.stringify(shifts, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
