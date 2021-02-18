/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const colors = require('colors/safe');
const gqlGenerator = require('./gql-generator');
const { fileLoader } = require('merge-graphql-schemas');

function getAbsolutePath(originPath) {
  if (path.isAbsolute(originPath)) {
    return originPath;
  } else {
    return path.join(__dirname, originPath);
  }
}

function loadFile(origin) {
  const path = getAbsolutePath(origin);
  const isDirectory = fs.lstatSync(path).isDirectory();
  const fileDir = isDirectory ? `${path}/**/*.gql` : path;
  const data = fileLoader(fileDir, {
    recursive: true,
  });
  return data;
}

function clear(path) {
  let files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach(function (file) {
      const curPath = path + '/' + file;
      if (fs.statSync(curPath).isDirectory()) {
        // recurse
        clear(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

const log = {
  success: function (str) {
    console.log(colors.green(str));
  },
  error: function (str) {
    console.log(colors.red(str));
  },
};

function gen(schemaTempDir, outputPath, schemaNames) {
  gqlGenerator(`${schemaTempDir}/index.gql`, outputPath, schemaNames);
}

// 所有 schema 写入一个文件
function writeToFile(dir, data) {
  try {
    const output = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(output)) {
      mkdirp.sync(output);
    }
    fs.writeFileSync(`${output}/index.gql`, data);
    log.success('Write Success!\n');
  } catch (err) {
    log.error(err);
  }
}

module.exports = {
  clear,
  log,
  writeToFile,
  gen,
  loadFile,
  getAbsolutePath,
};
