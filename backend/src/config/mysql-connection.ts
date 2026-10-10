import './load-env.js';

export type MysqlConnection = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export function getMysqlConnection(): MysqlConnection {
  const host = process.env.MYSQL_HOST;
  const port = Number(process.env.MYSQL_PORT);
  const database = process.env.MYSQL_DATABASE;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error('MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER e MYSQL_PASSWORD são obrigatórios.');
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MYSQL_PORT deve ser um número entre 1 e 65535.');
  }

  return { host, port, database, user, password };
}

export function getMysqlUrl(connection: MysqlConnection): string {
  const host = connection.host.includes(':') && !connection.host.startsWith('[')
    ? `[${connection.host}]`
    : connection.host;

  return `mysql://${encodeURIComponent(connection.user)}:${encodeURIComponent(connection.password)}@${host}:${connection.port}/${encodeURIComponent(connection.database)}`;
}
