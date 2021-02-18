/* eslint-disable no-console */
// 代码来源自 https://github.com/timqian/gql-generator，做了部分调整
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { Source, buildSchema } = require('graphql');
const del = require('del');

function gqlGenerator(
  schemaFilePath,
  destDirPath,
  schemaNames,
  depthLimit = 10,
  includeDeprecatedFields = false
) {
  /****************************** 工具函数 start *************************/
  /**
   * Compile arguments dictionary for a field
   * @param field current field object
   * @param duplicateArgCounts map for deduping argument name collisions
   * @param allArgsDict dictionary of all arguments
   */
  const getFieldArgsDict = (field, duplicateArgCounts, allArgsDict = {}) =>
    field.args.reduce((o, arg) => {
      if (arg.name in duplicateArgCounts) {
        const index = duplicateArgCounts[arg.name] + 1;
        duplicateArgCounts[arg.name] = index;
        o[`${arg.name}${index}`] = arg;
      } else if (allArgsDict[arg.name]) {
        duplicateArgCounts[arg.name] = 1;
        o[`${arg.name}1`] = arg;
      } else {
        o[arg.name] = arg;
      }
      return o;
    }, {});

  /**
   * Generate variables string
   * @param dict dictionary of arguments
   */
  const getArgsToVarsStr = dict =>
    Object.entries(dict)
      .map(([varName, arg]) => `${arg.name}: $${varName}`)
      .join(', ');

  /**
   * Generate types string
   * @param dict dictionary of arguments
   */
  const getVarsToTypesStr = dict =>
    Object.entries(dict)
      .map(([varName, arg]) => `$${varName}: ${arg.type}`)
      .join(', ');

  /**
   * Generate the query for the specified field
   * @param curName name of the current field
   * @param curParentType parent type of the current field
   * @param curParentName parent name of the current field
   * @param argumentsDict dictionary of arguments from all fields
   * @param duplicateArgCounts map for deduping argument name collisions
   * @param crossReferenceKeyList list of the cross reference
   * @param curDepth current depth of field
   */
  const generateQuery = (
    curName,
    curParentType,
    curParentName,
    argumentsDict = {},
    duplicateArgCounts = {},
    crossReferenceKeyList = [], // [`${curParentName}To${curName}Key`]
    curDepth = 1
  ) => {
    const field = gqlSchema.getType(curParentType).getFields()[curName];
    const curTypeName = field.type.inspect().replace(/[[\]!]/g, '');
    const curType = gqlSchema.getType(curTypeName);
    let queryStr = '';
    let childQuery = '';

    if (curType.getFields) {
      const crossReferenceKey = `${curParentName}To${curName}Key`;
      if (
        crossReferenceKeyList.indexOf(crossReferenceKey) !== -1 ||
        curDepth > depthLimit
      )
        return '';
      crossReferenceKeyList.push(crossReferenceKey);
      const childKeys = Object.keys(curType.getFields());
      childQuery = childKeys
        .filter(fieldName => {
          /* Exclude deprecated fields */
          const fieldSchema = gqlSchema.getType(curType).getFields()[fieldName];
          return includeDeprecatedFields || !fieldSchema.isDeprecated;
        })
        .map(
          cur =>
            generateQuery(
              cur,
              curType,
              curName,
              argumentsDict,
              duplicateArgCounts,
              crossReferenceKeyList,
              curDepth + 1
            ).queryStr
        )
        .filter(cur => cur)
        .join('\n');
    }

    if (!(curType.getFields && !childQuery)) {
      queryStr = `${'    '.repeat(curDepth)}${field.name}`;
      if (field.args.length > 0) {
        const dict = getFieldArgsDict(field, duplicateArgCounts, argumentsDict);
        Object.assign(argumentsDict, dict);
        queryStr += `(${getArgsToVarsStr(dict)})`;
      }
      if (childQuery) {
        queryStr += `{\n${childQuery}\n${'    '.repeat(curDepth)}}`;
      }
    }

    /* Union types */
    if (curType.astNode && curType.astNode.kind === 'UnionTypeDefinition') {
      const types = curType.getTypes();
      if (types && types.length) {
        const indent = `${'    '.repeat(curDepth)}`;
        const fragIndent = `${'    '.repeat(curDepth + 1)}`;
        queryStr += '{\n';

        for (let i = 0, len = types.length; i < len; i++) {
          const valueTypeName = types[i];
          const valueType = gqlSchema.getType(valueTypeName);
          const unionChildQuery = Object.keys(valueType.getFields())
            .map(
              cur =>
                generateQuery(
                  cur,
                  valueType,
                  curName,
                  argumentsDict,
                  duplicateArgCounts,
                  crossReferenceKeyList,
                  curDepth + 2
                ).queryStr
            )
            .filter(cur => cur)
            .join('\n');
          queryStr += `${fragIndent}... on ${valueTypeName} {\n${unionChildQuery}\n${fragIndent}}\n`;
        }
        queryStr += `${indent}}`;
      }
    }

    return { queryStr, argumentsDict };
  };

  /**
   * Generate the query for the specified field
   * @param obj one of the root objects(Query, Mutation, Subscription)
   * @param description description of the current object
   */
  const generateFile = (obj, description) => {
    const writeFolder = destDirPath;
    try {
      fs.mkdirSync(writeFolder);
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
    Object.keys(obj).forEach(type => {
      if (_.isEmpty(schemaNames) || _.includes(schemaNames, type)) {
        const field = gqlSchema.getType(description).getFields()[type];
        /* Only process non-deprecated queries/mutations: */
        if (includeDeprecatedFields || !field.isDeprecated) {
          const queryResult = generateQuery(type, description);
          const varsToTypesStr = getVarsToTypesStr(queryResult.argumentsDict);
          let query = queryResult.queryStr;
          query = `${description.toLowerCase()} ${type}${
            varsToTypesStr ? `(${varsToTypesStr})` : ''
          }{\n${query}\n}`;
          fs.writeFileSync(path.join(writeFolder, `./${type}.gql`), query);
        }
      }
    });
  };

  /***************************** 工具函数 end *****************************/

  const typeDef = fs.readFileSync(schemaFilePath, 'utf-8');
  const source = new Source(typeDef);
  const gqlSchema = buildSchema(source);
  del.sync(destDirPath);
  path
    .resolve(destDirPath)
    .split(path.sep)
    .reduce((before, cur) => {
      const pathTmp = path.join(before, cur + path.sep);
      if (!fs.existsSync(pathTmp)) {
        fs.mkdirSync(pathTmp);
      }
      return path.join(before, cur + path.sep);
    }, '');

  if (gqlSchema.getMutationType()) {
    generateFile(gqlSchema.getMutationType().getFields(), 'Mutation');
  }

  if (gqlSchema.getQueryType()) {
    generateFile(gqlSchema.getQueryType().getFields(), 'Query');
  }

  if (gqlSchema.getSubscriptionType()) {
    generateFile(gqlSchema.getSubscriptionType().getFields(), 'Subscription');
  }
}

module.exports = gqlGenerator;
