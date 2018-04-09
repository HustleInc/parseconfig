// @flow

import axios from 'axios';

import type { Schema } from './schema';

import {
  AddIndex,
  UpdateIndex,
  DeleteIndex,
  prettyPrintCommand,
} from './command';

import { plan } from './planner';
import { execute } from './executor';
import { verifySchema } from './verifier';
import {
  OutOfSyncError,
  InvalidSchemaError,
} from './errors';

export type Options = {
  applicationId: string,
  key: string,
  hookUrl: ?string,
  ignoreIndexes: boolean
}

const getPlan = async (newSchema: Schema, parseUrl: string, options: Options) => {
  const applicationId = options.applicationId;
  const key = options.key;
  const hookUrl = options.hookUrl;

  const validationErrors = verifySchema(newSchema);
  if (validationErrors.length > 0) {
    throw new InvalidSchemaError(validationErrors);
  }
  const oldSchema = await getLiveSchema(parseUrl, applicationId, key);
  let commands = plan(newSchema, oldSchema, hookUrl);
  if (options.ignoreIndexes) {
    commands = commands.filter(c => (
      c.type !== AddIndex.type
        && c.type !== UpdateIndex.type
        && c.type !== DeleteIndex.type
    ));
  }
  return commands;
};

const check = async (newSchema: Schema, parseUrl: string, options: Options) => {
  const commands = getPlan(newSchema, parseUrl, options)
  
  if (commands.length === 0) {
    return;
  }
  throw new OutOfSyncError();
};

const getLiveSchema = async (
  parseUrl: string,
  applicationId: string,
  key: string
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
      console.log('Unable to retrieve collections from Parse.', e);
      process.exit();
      return Promise.reject(); // satisfy flow
    });
  
  const functions = await httpClient({
    method: 'get',
    url: '/hooks/functions'
  }).then(response => response.data)
    .catch(() => {
      console.log('Unable to retrieve functions from Parse.');
      process.exit();
      return Promise.reject(); // satisfy flow
    });
  
  const triggers = await httpClient({
    method: 'get',
    url: '/hooks/triggers'
  }).then(response => response.data)
    .catch(() => {
      console.log('Unable to retrieve triggers from Parse.');
      process.exit();
      return Promise.reject(); // satisfy flow
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
}