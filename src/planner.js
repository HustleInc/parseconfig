// @flow

import deepEquals from 'lodash.isequal';
import omit from 'lodash.omit';

import type {
  Schema,
  CollectionDefinition,
  FunctionDefinition,
  ColumnDefinition,
  IndexDefinition,
  TriggerDefinition,
} from './schema';

import {
  AddCollection,
  DeleteCollection,
  AddColumn,
  DeleteColumn,
  UpdateColumn,
  AddIndex,
  DeleteIndex,
  UpdateIndex,
  AddFunction,
  DeleteFunction,
  UpdateFunction,
  AddTrigger,
  DeleteTrigger,
  UpdateTrigger,
  UpdateCollectionPermissions,
} from './command';

import type {
  Command
} from './command';

const plan = (
  newSchema: Schema,
  oldSchema: Schema,
  hookUrl: ?string,
): Array<Command> => {
  return planCollections(
    newSchema.collections,
    oldSchema.collections,
  ).concat(
    planFunctions(newSchema.functions, oldSchema.functions, hookUrl),
    planTriggers(newSchema.triggers, oldSchema.triggers, hookUrl)
  );
};

const planCollections = (
  newSchema: Array<CollectionDefinition>,
  oldSchema: Array<CollectionDefinition>,
): Array<Command> => {
  const oldColMap = new Map(oldSchema.map(c => [c.className, c]));
  const newColMap = new Map(newSchema.map(c => [c.className, c]));

  // TODO consolidate loops to improve performance

  const newCollections = (() => {
    const oc = oldColMap;
    const nc = [];
    newSchema.forEach(collection => {
      if (!oc.has(collection.className)) {
        nc.push(AddCollection(collection));
      }
    });
    return nc;
  })();
  const deletedCollections = (() => {
    const nc = newColMap;
    const dc = [];
    oldSchema.forEach(collection => {
      if (!nc.has(collection.className)) {
        dc.push(DeleteCollection(collection.className));
      }
    });
    return dc;
  })();
  const updatedPermissions = (() => {
    const oc = oldColMap;
    const nc = [];
    newSchema.forEach(collection => {
      const old = oc.get(collection.className);
      if (old === undefined) {
        return; // New Collection, handled above
      }

      // NOTE: parse-server#3.x adds two default class level
      // permissions: count and protectedFields. For now, ignore these
      // fields until we're on v3 everywhere
      const version3CLP = ['count', 'protectedFields'];
      const newPerms = omit(collection.classLevelPermissions, version3CLP);
      const oldPerms = omit(old.classLevelPermissions, version3CLP);
      if (!deepEquals(newPerms, oldPerms)) {
        nc.push(UpdateCollectionPermissions(collection.className, newPerms, oldPerms));
      }
    });
    return nc;
  })();
  const newColumns = (() => {
    const oc = oldColMap;
    const nc = [];
    newSchema.forEach(collection => {
      const old = oc.get(collection.className);
      if (old === undefined) {
        return; // New Collection, handled above
      }
      const fields: { [string]: ColumnDefinition } = collection.fields;
      Object.keys(fields).forEach((name) => {
        const oldField = old.fields[name];
        if (oldField === undefined) {
          nc.push(AddColumn(collection.className, name, fields[name]));
        } else if (!deepEquals(oldField, fields[name])) {
          nc.push(UpdateColumn(collection.className, name, fields[name]));
        }
      });
    });
    return nc;
  })();
  // TODO handle changes to column definition
  const deletedColumns = (() => {
    const nc = newColMap;
    const dc = [];
    oldSchema.forEach(collection => {
      const newC = nc.get(collection.className);
      if (newC === undefined) {
        return; // Deleted Collection, handled above
      }
      const fields: { [string]: ColumnDefinition } = collection.fields;
      Object.keys(fields).forEach((name) => {
        const newField = newC.fields[name];
        if (newField === undefined) {
          dc.push(DeleteColumn(collection.className, name));
        }
      });
    });
    return dc;
  })();
  const newIndexes = (() => {
    const oc = oldColMap;
    const ni = [];
    newSchema.forEach(collection => {
      const old = oc.get(collection.className);
      if (old === undefined) {
        return; // New Collection, handled above
      }
      const indexes: { [string]: IndexDefinition } = (collection.indexes || {});
      Object.keys(indexes).forEach((name) => {
        const oldIndex = (old.indexes || {})[name];
        if (oldIndex === undefined) {
          ni.push(AddIndex(collection.className, name, indexes[name]));
        } else if (!deepEquals(oldIndex, indexes[name])) {
          ni.push(UpdateIndex(collection.className, name, indexes[name]));
        }
      });
    });
    return ni;
  })();
  // TODO handle changes to index definition
  const deletedIndexes = (() => {
    const nc = newColMap;
    const di = [];
    oldSchema.forEach(collection => {
      const newC = nc.get(collection.className);
      if (newC === undefined) {
        return; // Deleted Collection, handled above
      }
      const indexes: { [string]: IndexDefinition } = collection.indexes || {};
      Object.keys(indexes).forEach((name) => {
        const newIndex = (newC.indexes || {})[name];
        if (newIndex === undefined) {
          di.push(DeleteIndex(collection.className, name));
        }
      });
    });
    return di;
  })();

  // Order matters here. New columns must be added before
  // indices which use them
  return newCollections.concat(
    deletedCollections,
    updatedPermissions,
    deletedIndexes,
    deletedColumns,
    newColumns,
    newIndexes,
  )
};

const planFunctions = (
  newSchema: Array<FunctionDefinition>,
  oldSchema: Array<FunctionDefinition>,
  hookUrl: ?string
): Array<Command> => {
  const oldFuncMap = new Map(oldSchema.map(c => [c.functionName, c]));
  const newFuncMap = new Map(newSchema.map(c => [c.functionName, c]));

  const newFunctions = (() => {
    const newFuncs = [];
    newSchema.forEach(func => {
      const actualFunc = Object.assign({}, func);
      if (hookUrl) {
        actualFunc.url = hookUrl + func.url;
      }
      const oldFunc = oldFuncMap.get(actualFunc.functionName);
      if (oldFunc === undefined) {
        newFuncs.push(AddFunction(actualFunc));
      } else if (oldFunc.url !== actualFunc.url) {
        newFuncs.push(UpdateFunction(actualFunc));
      }
    });
    return newFuncs;
  })();
  const deletedFunctions = (() => {
    const delFuncs = [];
    oldSchema.forEach(func => {
      const newFunc = newFuncMap.get(func.functionName);
      if (newFunc === undefined) {
        delFuncs.push(DeleteFunction(func.functionName));
      }
    });
    return delFuncs;
  })();

  return deletedFunctions.concat(newFunctions);
};

// TODO triggers can e directly updated via PUT
const planTriggers = (
  newSchema: Array<TriggerDefinition>,
  oldSchema: Array<TriggerDefinition>,
  hookUrl: ?string
): Array<Command> => {
  const triggerKey = (t: TriggerDefinition): string => `${t.triggerName}-${t.className}`;

  const oldTriggerMap = new Map(oldSchema.map(t => [triggerKey(t), t]));
  const newTriggerMap = new Map(newSchema.map(t => [triggerKey(t), t]));

  const newTriggers = (() => {
    const newTriggers = [];
    newSchema.forEach(trigger => {
      const actualTrigger = Object.assign({}, trigger);
      if (hookUrl) {
        actualTrigger.url = hookUrl + trigger.url;
      }
      const oldTrigger = oldTriggerMap.get(triggerKey(actualTrigger));
      if (oldTrigger === undefined) {
        newTriggers.push(AddTrigger(actualTrigger));
      } else if (oldTrigger.url !== actualTrigger.url) {
        newTriggers.push(UpdateTrigger(actualTrigger));
      }
    });
    return newTriggers;
  })();
  const deletedTriggers = (() => {
    const delTriggers = [];
    oldSchema.forEach(trigger => {
      const newTrigger = newTriggerMap.get(triggerKey(trigger));
      if (newTrigger === undefined) {
        delTriggers.push(DeleteTrigger(trigger.className, trigger.triggerName));
      }
    });
    return delTriggers;
  })();

  return deletedTriggers.concat(newTriggers);
};

export {
  plan,
  planCollections,
  planFunctions,
  planTriggers,
}
