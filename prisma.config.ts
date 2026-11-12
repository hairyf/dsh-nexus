import { definePrismaConfig } from 'prisma/config'

export default definePrismaConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seeds/index.ts' },
  datasource: { url: 'file:prisma/database/main.db' },
})
