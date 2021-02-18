### 作用

根据 schema 生成对应的客户端查询语句。
注意：仅支持转换 Query、Mutation，普通的 type 不支持。
例子 🌰：
schema

```
type Query {
  getLoadBalancerStats(cid: String!, name: String!): LoadBalancerStats @fetch
}
```

生成的查询语句：

```
query getLoadBalancerStats($cid: String!, $name: String!){
    getLoadBalancerStats(cid: $cid, name: $name){
        cluster
        ingressTotalReadBytesPerSeconds
        ingressTotalWriteBytesPerSeconds
        loadBalancer
    }
}
```

### 详细用法

#### 全局安装

```
npm install gengql -g
```

or

```
yarn global add gengql
```

#### 执行命令

##### 命令行执行：

```
genGql --schema schemaPath --dist distPath --schemaNames getLoadBalancerStats
```

##### 参数：

- schema

作用：指定从何处读取 schema

格式：支持绝对路径和相对路径；可以是指向目录也可以是指向文件。

默认值：'../graphql/schema'

- dist

作用：指定生成的客户端查询语句存储在哪里  
格式：支持绝对路径和相对路径；需要指向目录。  
默认值：./output

- schemaNames

作用：指定转换哪些 schema。
格式：可以是单个 Mutation 或者 Query 的名字，也可以是由这些名字组成的数组。  
默认值：无  
例子：

- 单个：

```
genGql --schemaNames getLoadBalancerStats
```

- 多个：

```
genGql --schemaNames [getLoadBalancerStats,lbDetail]
```

#### 备注

其中部分代码来源于 https://github.com/timqian/gql-generator
