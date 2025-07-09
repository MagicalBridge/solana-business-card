## 执行 anchor build 报错：

```
error: not a directory: '/Users/chupengfei/.local/share/solana/install/releases/stable-3861dcebbc15c3d6022208b227bdf13e797af941/solana-release/bin/sdk/sbf/dependencies/platform-tools/rust/lib'
```

- 1. 一定要删除 solana的编译缓存，rm -rf ~/.cache/solana/*
- 2. 执行 anchor build 命令；
- 3. 如果不行，尝试重新安装 solana 工具链；
- 4. 执行 anchor build 命令；