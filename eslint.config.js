// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    pnpm: true,
    rules: {
      'pnpm/yaml-enforce-settings': 'off',
    },
    ignores: [
      // 生成物：Prisma 与 GenAPI 的输出，不手改也不按手写规则约束
      'src/database/types.ts',
      'src/client/apis/**',
      'source/**',
    ],
  },
)
