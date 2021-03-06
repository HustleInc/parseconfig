// @flow

import axios from 'axios';

import type { Schema } from './schema';

import {
  AddIndex,
  UpdateIndex,
  DeleteIndex,
  UpdateColumn,
  DeleteColumn,
  AddCollection,
  prettyPrintCommand,
} from './command';

import { plan } from './planner';
import { execute } from './executor';
import { verifySchema } from './verifier';
import {
  OutOfSyncError,
  InvalidSchemaError,
  DisallowedCommandError,
} from './errors';
import type { Logger } from './logger';

export type Options = {
  applicationId: string,
  key: string,
  hookUrl: ?string,
  ignoreIndexes: boolean,
  disallowColumnRedefine: boolean,
  disallowIndexRedefine: boolean
}

const getPlan = async (
  newSchema: Schema,
  parseUrl: string,
  options: Options,
  logger: Logger,
) => {
  const applicationId = options.applicationId;
  const key = options.key;
  const hookUrl = options.hookUrl;

  const validationErrors = verifySchema(newSchema);
  if (validationErrors.length > 0) {
    throw new InvalidSchemaError(validationErrors);
  }
  const oldSchema = await getLiveSchema(parseUrl, applicationId, key, logger);
  let commands = plan(newSchema, oldSchema, hookUrl);
  if (options.ignoreIndexes) {
    commands = commands.filter(c => (
      c.type !== AddIndex.type
        && c.type !== UpdateIndex.type
        && c.type !== DeleteIndex.type
    ));
    commands.forEach(c => {
      if (c.type === AddCollection.type) {
        c.definition.indexes = {};
      }
    });
  }
  if (options.disallowColumnRedefine) {
    commands.forEach(c => {
      if (c.type !== UpdateColumn.type
          || c.type !== DeleteColumn.type) {
        throw new DisallowedCommandError(c);
      }
    });
  }
  if (options.disallowIndexRedefine) {
    commands.forEach(c => {
      if (c.type !== UpdateIndex.type
          || c.type !== DeleteIndex.type) {
        throw new DisallowedCommandError(c);
      }
    });
  }
  return commands;
};

const check = async (
  newSchema: Schema,
  parseUrl: string,
  options: Options,
  logger: Logger
) => {
  const commands = await getPlan(newSchema, parseUrl, options, logger)
  
  if (commands.length === 0) {
    return;
  }
  throw new OutOfSyncError(commands);
};

const getLiveSchema = async (
  parseUrl: string,
  applicationId: string,
  key: string,
  logger: Logger,
): Promise<Schema> => {

  const httpClient = axios.create({
    baseURL: parseUrl,
    headers: {
      ['X-Parse-Application-Id']: applicationId,
      ['X-Parse-Master-Key']: key
    }
  });
  
  const collections = await httpClient({
    method: 'get',
    url: '/schemas'
  }).then(response => response.data.results)
    .catch((e) => {
      logger.error('Unable to retrieve collections from Parse.');
      return Promise.reject(e);
    });
  
  const functions = await httpClient({
    method: 'get',
    url: '/hooks/functions'
  }).then(response => response.data)
    .catch((e) => {
      logger.error('Unable to retrieve functions from Parse.');
      return Promise.reject(e);
    });
  
  const triggers = await httpClient({
    method: 'get',
    url: '/hooks/triggers'
  }).then(response => response.data)
    .catch((e) => {
      logger.error('Unable to retrieve triggers from Parse.');
      return Promise.reject(e);
    });

  return {
    collections,
    functions,
    triggers,
  };
};

export {
  getPlan,
  check,
  execute,
  getLiveSchema,
}
