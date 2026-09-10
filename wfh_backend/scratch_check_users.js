const prisma = require('./dist/lib/prisma').default;

async function main() {
  const users = await prisma.regUser.findMany({
    take: 10,
    select: { id: true, employeeId: true, name: true, role: true }
  });
  console.log(JSON.stringify(users, null, 2));

  const migrations = await prisma.$queryRaw`SELECT * FROM "_prisma_migrations" ORDER BY "finished_at" DESC LIMIT 5;`;
  console.log("Applied Migrations:", migrations);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
