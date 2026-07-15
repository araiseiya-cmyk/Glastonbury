const { defineConfig } = require('@prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: 'file:./prisma/dev.db',
  },
});