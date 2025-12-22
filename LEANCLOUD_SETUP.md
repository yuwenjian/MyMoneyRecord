# LeanCloud 配置说明

## 1. 创建 LeanCloud 应用

1. 访问 [LeanCloud 官网](https://www.leancloud.cn/)
2. 注册/登录账号
3. 创建新应用，选择开发版（免费）
4. 记录应用的 App ID 和 App Key

## 2. 配置应用

编辑 `src/config/leancloud.js` 文件，填入你的 LeanCloud 配置：

```javascript
const APP_ID = '你的App ID'
const APP_KEY = '你的App Key'
const SERVER_URL = '你的服务器地址' // 可选，国际版可省略
```

## 3. 创建数据表

在 LeanCloud 控制台中创建以下数据表：

### MyMoney 表
字段结构：
- `date` (String) - 日期，格式：YYYY-MM-DD
- `totalAsset` (Number) - 总资产
- `totalMarketValue` (Number) - 总市值（可选）
- `investmentType` (String) - 投资类型：'stock' 或 'fund'
- `shanghaiIndex` (Number) - 上证指数（可选）
- `notes` (String) - 备注

### Adjustment 表
字段结构：
- `date` (String) - 日期，格式：YYYY-MM-DD
- `amount` (Number) - 金额（正数为加仓，负数为减仓）
- `notes` (String) - 备注

## 4. 设置数据表权限

在 LeanCloud 控制台的「数据存储」->「结构化数据」中：

1. 选择 `MyMoney` 表
2. 进入「权限」设置
3. 设置「所有用户」可读可写（或根据需要设置）

对 `Adjustment` 表执行相同操作。

## 5. 安装依赖

确保已安装 leancloud-storage：

```bash
npm install
```

## 注意事项

- 开发环境建议使用开发版（免费）
- 生产环境建议使用生产版以获得更好的性能
- 注意保护 App Key，不要提交到公开仓库
- 可以使用环境变量来存储敏感信息

