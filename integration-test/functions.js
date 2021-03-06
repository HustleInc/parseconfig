import assert from 'assert';

import { reset, getSchema, apply, emptySchema } from './util';
import { consoleLogger } from '../dist/logger';

const deepCopy = (any) => JSON.parse(JSON.stringify(any));

const defaultSchema = {
  collections: [
    {
      className: 'Foo',
      fields: {
        objectId: {
          type: 'String'
        },
        createdAt: {
          type: 'Date'
        },
        updatedAt: {
          type: 'Date'
        },
        ACL: {
          type: 'ACL'
        },
        'AAA': {
          type: 'String'
        },
        'AAB': {
          type: 'String'
        }
      },
      indexes: {
        AAA_index: {
          AAA: 1
        },
        AAB_index: {
          AAB: 1
        }
      },
      classLevelPermissions: {
        find: {
          ['role:user']: true
        },
        get: {},
        create: {},
        update: {},
        delete: {},
        addField: {}
      }
    },
    {
      className: 'Bar',
      fields: {
        objectId: {
          type: 'String'
        },
        createdAt: {
          type: 'Date'
        },
        updatedAt: {
          type: 'Date'
        },
        ACL: {
          type: 'ACL'
        },
        'BAA': {
          type: 'String'
        },
        'BAB': {
          type: 'String'
        }
      },
      classLevelPermissions: {
        find: {},
        get: {},
        create: {},
        update: {},
        delete: {},
        addField: {}
      }
    }
  ],
  functions: [
    {
      functionName: 'getFoobar',
      url: '/getFoobar'
    },
    {
      functionName: 'addFoobar',
      url: '/addFoobar'
    }
  ],
  triggers: [
    {
      className: 'Foo',
      triggerName: 'beforeSave',
      url: '/foo/beforeSave'
    },
    {
      className: 'Bar',
      triggerName: 'afterSave',
      url: '/bar/afterSave'
    }
  ]
};

describe('functions', () => {
  it('should be added correctly', async () => {
    const oldSchema = deepCopy(defaultSchema);
    const newSchema = deepCopy(defaultSchema);

    newSchema.functions.push({
      functionName: 'launchMissiles',
      url: '/launchMissiles'
    });

    await reset();
    const s1 = await getSchema();
    assert.deepEqual(s1, emptySchema);

    await apply(oldSchema);
    const s2 = await getSchema();
    assert.deepEqual(s2, oldSchema);

    await apply(newSchema);
    const s3 = await getSchema();
    assert.deepEqual(s3, newSchema);
  });
  it('should be removed correctly', async () => {
    const oldSchema = deepCopy(defaultSchema);
    const newSchema = deepCopy(defaultSchema);

    newSchema.functions = newSchema.functions.slice(0, 1);

    await reset();
    const s1 = await getSchema();
    assert.deepEqual(s1, emptySchema);

    await apply(oldSchema);
    const s2 = await getSchema();
    assert.deepEqual(s2, oldSchema);

    await apply(newSchema);
    const s3 = await getSchema();
    assert.deepEqual(s3, newSchema);
  });
  it('should be updated correctly', async () => {
    const oldSchema = deepCopy(defaultSchema);
    const newSchema = deepCopy(defaultSchema);

    newSchema.functions[0].url = '/smoosh';

    await reset();
    const s1 = await getSchema();
    assert.deepEqual(s1, emptySchema);

    await apply(oldSchema);
    const s2 = await getSchema();
    assert.deepEqual(s2, oldSchema);

    await apply(newSchema);
    const s3 = await getSchema();
    assert.deepEqual(s3, newSchema);
  });
  describe('with hookUrl', () => {
    it('should be added correctly', async () => {
      const oldSchema = deepCopy(defaultSchema);
      const newSchema = deepCopy(defaultSchema);

      newSchema.functions.push({
        functionName: 'launchMissiles',
        url: '/launchMissiles'
      });

      await reset();
      const s1 = await getSchema();
      assert.deepEqual(s1, emptySchema);

      await apply(oldSchema, { hookUrl: '/the-hooks' });
      const s2 = await getSchema();
      const oldFuncs = oldSchema.functions.map(f => ({
        functionName: f.functionName,
        url: '/the-hooks' + f.url
      }));
      assert.deepEqual(s2.functions, oldFuncs);

      await apply(newSchema, { hookUrl: '/the-hooks' });
      const s3 = await getSchema();
      const newFuncs = newSchema.functions.map(f => ({
        functionName: f.functionName,
        url: '/the-hooks' + f.url
      }));
      assert.deepEqual(s3.functions, newFuncs);
    });
    it('should be removed correctly', async () => {
      const oldSchema = deepCopy(defaultSchema);
      const newSchema = deepCopy(defaultSchema);

      newSchema.functions = newSchema.functions.slice(0, 1);

      await reset();
      const s1 = await getSchema();
      assert.deepEqual(s1, emptySchema);

      await apply(oldSchema, { hookUrl: '/the-hooks' });
      const s2 = await getSchema();
      const oldFuncs = oldSchema.functions.map(f => ({
        functionName: f.functionName,
        url: '/the-hooks' + f.url
      }));
      assert.deepEqual(s2.functions, oldFuncs);

      await apply(newSchema, { hookUrl: '/the-hooks' });
      const s3 = await getSchema();
      const newFuncs = newSchema.functions.map(f => ({
        functionName: f.functionName,
        url: '/the-hooks' + f.url
      }));
      assert.deepEqual(s3.functions, newFuncs);
    });
    it('should be updated correctly', async () => {
      const oldSchema = deepCopy(defaultSchema);
      const newSchema = deepCopy(defaultSchema);

      newSchema.functions[0].url = '/smoosh';

      await reset();
      const s1 = await getSchema();
      assert.deepEqual(s1, emptySchema);

      await apply(oldSchema, { hookUrl: '/the-hooks' });
      const s2 = await getSchema();
      const oldFuncs = oldSchema.functions.map(f => ({
        functionName: f.functionName,
        url: '/the-hooks' + f.url
      }));
      assert.deepEqual(s2.functions, oldFuncs);

      await apply(newSchema, { hookUrl: '/the-hooks' });
      const s3 = await getSchema();
      const newFuncs = newSchema.functions.map(f => ({
        functionName: f.functionName,
        url: '/the-hooks' + f.url
      }));
      assert.deepEqual(s3.functions, newFuncs);
    });
  });
});
