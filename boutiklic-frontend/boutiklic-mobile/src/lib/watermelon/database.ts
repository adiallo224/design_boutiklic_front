import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { watermelonSchema } from './schema'
import { watermelonMigrations } from './migrations'
import ProductModel from './models/ProductModel'

const adapter = new SQLiteAdapter({
  schema: watermelonSchema,
  migrations: watermelonMigrations,
  dbName: 'boutiklic',
  jsi: true,
})

export const database = new Database({
  adapter,
  modelClasses: [ProductModel],
})
