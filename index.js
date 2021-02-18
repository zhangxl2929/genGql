#!/usr/bin/env node

const minimist = require('minimist');
const _ = require('lodash');
const { mergeTypes } = require('merge-graphql-schemas');
const { clear, writeToFile, gen, loadFile } = require('./lib/core');

function getAndSaveSchema(origin, dist) {
  const types = loadFile(origin);
  const allTypes = mergeTypes(types);
  writeToFile(dist, allTypes);
}

const run = async () => {
  // 清除上一次生成的结果
  const schemaTempDir = './schema';
  clear(schemaTempDir);

  const argv = minimist(process.argv.slice(2));
  let { schema = '../graphql/schema', dist = './output', schemaNames } = argv;
  schemaNames = _.isArray(schemaNames) ? schemaNames : [schemaNames];
  getAndSaveSchema(schema, schemaTempDir);
  gen(schemaTempDir, dist, schemaNames);
};

run();
