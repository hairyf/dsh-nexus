import type { Kysely } from 'kysely'
import type { DB } from '../types'
import { Model } from 'kysely-model'

export class Thread extends Model<DB, 'thread'> {
  constructor(db: Kysely<DB>) {
    super(db, 'thread', 'id')
  }
}
