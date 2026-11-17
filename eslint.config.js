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
      'soruce/*',
      'docs/specs/plugin.host.md',
      'docs/specs/plugin.host.service.md',
      'src/database/migrations.ts',
      'src/database/types.ts',
    ],
  },
)
