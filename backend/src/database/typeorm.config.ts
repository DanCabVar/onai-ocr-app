import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

type EnvMap = NodeJS.ProcessEnv;

function resolveSynchronize(env: EnvMap): boolean {
  if (env.TYPEORM_SYNCHRONIZE === 'true') {
    return true;
  }

  if (env.TYPEORM_SYNCHRONIZE === 'false') {
    return false;
  }

  return env.NODE_ENV !== 'production';
}

function resolveLogging(env: EnvMap): boolean {
  return env.TYPEORM_LOGGING === 'true';
}

function resolvePort(env: EnvMap): number {
  return Number(env.DATABASE_PORT || 5432);
}

export function buildTypeOrmOptions(
  env: EnvMap,
  baseDir: string,
  entitiesDir: string,
  migrationsDir: string,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DATABASE_HOST,
    port: resolvePort(env),
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    entities: [join(baseDir, entitiesDir, '*.entity{.ts,.js}')],
    migrations: [join(baseDir, migrationsDir, '*{.ts,.js}')],
    migrationsTableName: 'typeorm_migrations',
    migrationsRun: false,
    synchronize: resolveSynchronize(env),
    logging: resolveLogging(env),
  };
}

export function getNestTypeOrmOptions(baseDir: string): TypeOrmModuleOptions {
  return buildTypeOrmOptions(
    process.env,
    baseDir,
    'database/entities',
    'database/migrations',
  ) as TypeOrmModuleOptions;
}
