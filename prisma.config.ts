import { defineConfig } from '@prisma/config';

export default defineConfig({
  // スキーマファイルのパスを文字列で指定
  schema: 'prisma/schema.prisma',
  
  // 💡 ここがポイント：datasources ではなく、単数形の datasource です
  datasource: {
    url: 'file:./dev.db',
  },
});