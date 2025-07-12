## 执行 anchor build 报错：

```shell
error: not a directory: '/Users/chupengfei/.local/share/solana/install/releases/stable-3861dcebbc15c3d6022208b227bdf13e797af941/solana-release/bin/sdk/sbf/dependencies/platform-tools/rust/lib'
```

- 1. 一定要删除 solana的编译缓存，rm -rf ~/.cache/solana/*
- 2. 执行 anchor build 命令；
- 3. 如果不行，尝试重新安装 solana 工具链；
- 4. 执行 anchor build 命令；

## 执行 anchor build 时候报了警告：

```shell
➜  solana_business_card git:(main) anchor test
warning: unexpected `cfg` condition value: `custom-heap`
  --> programs/solana_business_card/src/lib.rs:10:1
   |
10 | #[program]
   | ^^^^^^^^^^
   |
   = note: expected values for `feature` are: `cpi`, `default`, `idl-build`, `no-entrypoint`, `no-idl`, and `no-log-ix-name`
   = help: consider adding `custom-heap` as a feature in `Cargo.toml`
   = note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
   = note: `#[warn(unexpected_cfgs)]` on by default
   = note: this warning originates in the macro `$crate::custom_heap_default` which comes from the expansion of the attribute macro `program` (in Nightly builds, run with -Z macro-backtrace for more info)
```
警告原因分析
- 1. unexpected cfg condition value 警告
这些警告是因为 Anchor 框架在编译时检查某些特性配置：
custom-heap
custom-panic
anchor-debug

但这些特性在你的 programs/solana_business_card/Cargo.toml 文件中没有定义。这些是 Anchor 框架内部使用的特性标志，用于控制编译时的行为。

添加缺失的特性到 Cargo.toml
```
custom-heap = []
custom-panic = []
anchor-debug = []
```