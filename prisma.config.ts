import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: 'file:prisma/database/main.db' },
})
