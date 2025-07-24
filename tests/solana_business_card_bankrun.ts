import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { SolanaBusinessCard } from "../target/types/solana_business_card";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { BankrunProvider, startAnchor } from "anchor-bankrun";

describe("solana_business_card (Bankrun 版本)", () => {
  let context: any;
  let provider: BankrunProvider;
  let program: Program<SolanaBusinessCard>;
  
  // 创建测试用户
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();

  // 初始化 bankrun 环境
  before(async () => {
    // 启动 anchor bankrun 环境，预设测试用户账户余额
    context = await startAnchor(".", [], [
      {
        address: user1.publicKey,
        info: {
          lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
          data: Buffer.alloc(0),
          owner: anchor.web3.SystemProgram.programId,
          executable: false,
        },
      },
      {
        address: user2.publicKey,
        info: {
          lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
          data: Buffer.alloc(0),
          owner: anchor.web3.SystemProgram.programId,
          executable: false,
        },
      },
    ]);
    
    provider = new BankrunProvider(context);
    program = new Program<SolanaBusinessCard>(
      require("../target/idl/solana_business_card.json"),
      provider
    );
  });

  // 辅助函数：获取 favorites PDA
  const getFavoritesPDA = (userPublicKey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("solana_business_card"), userPublicKey.toBuffer()],
      program.programId
    )[0];
  };

  describe("基本功能测试", () => {
    it("应该能够成功设置用户偏好", async () => {
      const favoritesPDA = getFavoritesPDA(user1.publicKey);
      
      const tx = await program.methods
        .setFavorites(
          new BN(42),
          "蓝色",
          ["编程", "音乐", "游戏"]
        )
        .accountsPartial({
          user: user1.publicKey,
        })
        .signers([user1])
        .rpc();

      console.log("交易签名:", tx);

      // 验证数据是否正确存储
      const favoritesAccount = await program.account.favorites.fetch(favoritesPDA);
      expect(favoritesAccount.number.toNumber()).to.equal(42);
      expect(favoritesAccount.color).to.equal("蓝色");
      expect(favoritesAccount.hobbies).to.deep.equal(["编程", "音乐", "游戏"]);
    });

    it("应该能够更新已存在的用户偏好", async () => {
      const favoritesPDA = getFavoritesPDA(user1.publicKey);
      
      // 更新用户偏好
      await program.methods
        .setFavorites(
          new BN(100),
          "红色",
          ["阅读", "旅行"]
        )
        .accountsPartial({
          user: user1.publicKey,
        })
        .signers([user1])
        .rpc();

      // 验证更新后的数据
      const favoritesAccount = await program.account.favorites.fetch(favoritesPDA);
      expect(favoritesAccount.number.toNumber()).to.equal(100);
      expect(favoritesAccount.color).to.equal("红色");
      expect(favoritesAccount.hobbies).to.deep.equal(["阅读", "旅行"]);
    });

    it("不同用户应该有独立的偏好存储", async () => {
      const user1FavoritesPDA = getFavoritesPDA(user1.publicKey);
      const user2FavoritesPDA = getFavoritesPDA(user2.publicKey);

      // 为用户2设置偏好
      await program.methods
        .setFavorites(
          new BN(777),
          "绿色",
          ["运动", "电影"]
        )
        .accountsPartial({
          user: user2.publicKey,
        })
        .signers([user2])
        .rpc();

      // 验证两个用户的数据是独立的
      const user1Favorites = await program.account.favorites.fetch(user1FavoritesPDA);
      const user2Favorites = await program.account.favorites.fetch(user2FavoritesPDA);

      expect(user1Favorites.number.toNumber()).to.equal(100);
      expect(user1Favorites.color).to.equal("红色");
      
      expect(user2Favorites.number.toNumber()).to.equal(777);
      expect(user2Favorites.color).to.equal("绿色");
    });
  });

  describe("边界条件测试", () => {
    it("应该能够处理最大长度的颜色字符串", async () => {
      const user3 = Keypair.generate();
      // 为测试用户设置账户余额
      context.setAccount(user3.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      const favoritesPDA = getFavoritesPDA(user3.publicKey);
      const maxLengthColor = "a".repeat(50); // 最大长度50

      await program.methods
        .setFavorites(
          new BN(1),
          maxLengthColor,
          ["爱好1"]
        )
        .accountsPartial({
          user: user3.publicKey,
        })
        .signers([user3])
        .rpc();

      const favoritesAccount = await program.account.favorites.fetch(favoritesPDA);
      expect(favoritesAccount.color).to.equal(maxLengthColor);
    });

    it("应该能够处理最大数量和长度的爱好", async () => {
      const user4 = Keypair.generate();
      context.setAccount(user4.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      const favoritesPDA = getFavoritesPDA(user4.publicKey);
      const maxHobbies = [
        "a".repeat(50), // 最大长度50
        "b".repeat(50),
        "c".repeat(50),
        "d".repeat(50),
        "e".repeat(50)  // 最多5个爱好
      ];

      await program.methods
        .setFavorites(
          new BN(1),
          "颜色",
          maxHobbies
        )
        .accountsPartial({
          user: user4.publicKey,
        })
        .signers([user4])
        .rpc();

      const favoritesAccount = await program.account.favorites.fetch(favoritesPDA);
      expect(favoritesAccount.hobbies).to.deep.equal(maxHobbies);
    });

    it("应该能够处理空爱好数组", async () => {
      const user5 = Keypair.generate();
      context.setAccount(user5.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      const favoritesPDA = getFavoritesPDA(user5.publicKey);

      await program.methods
        .setFavorites(
          new BN(0),
          "",
          []
        )
        .accountsPartial({
          user: user5.publicKey,
        })
        .signers([user5])
        .rpc();

      const favoritesAccount = await program.account.favorites.fetch(favoritesPDA);
      expect(favoritesAccount.hobbies).to.deep.equal([]);
    });

    it("应该能够处理最大u64数值", async () => {
      const user6 = Keypair.generate();
      context.setAccount(user6.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      const favoritesPDA = getFavoritesPDA(user6.publicKey);
      const maxU64 = new BN("18446744073709551615"); // 最大u64值

      await program.methods
        .setFavorites(
          maxU64,
          "颜色",
          ["爱好"]
        )
        .accountsPartial({
          user: user6.publicKey,
        })
        .signers([user6])
        .rpc();

      const favoritesAccount = await program.account.favorites.fetch(favoritesPDA);
      expect(favoritesAccount.number.toString()).to.equal(maxU64.toString());
    });
  });

  describe("安全性测试", () => {
    it("应该拒绝未签名的交易", async () => {
      const user7 = Keypair.generate();
      context.setAccount(user7.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      const favoritesPDA = getFavoritesPDA(user7.publicKey);

      try {
        await program.methods
          .setFavorites(
            new BN(1),
            "颜色",
            ["爱好"]
          )
          .accountsPartial({
            user: user7.publicKey,
          })
          .rpc(); // 不提供签名者

        expect.fail("应该抛出错误");
      } catch (error: any) {
        expect(error.message).to.include("Signature verification failed");
      }
    });

    it("应该拒绝用错误的用户修改他人的偏好", async () => {
      const user8 = Keypair.generate();
      const maliciousUser = Keypair.generate();
      
      context.setAccount(user8.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });
      context.setAccount(maliciousUser.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      // 先为user8创建偏好
      const user8FavoritesPDA = getFavoritesPDA(user8.publicKey);
      await program.methods
        .setFavorites(
          new BN(123),
          "原始颜色",
          ["原始爱好"]
        )
        .accountsPartial({
          user: user8.publicKey,
        })
        .signers([user8])
        .rpc();

      // 恶意用户尝试修改user8的偏好
      try {
        await program.methods
          .setFavorites(
            new BN(456),
            "恶意颜色",
            ["恶意爱好"]
          )
          .accountsPartial({
            user: user8.publicKey, // 使用user8的账户
          })
          .signers([maliciousUser]) // 但用恶意用户签名
          .rpc();

        expect.fail("应该抛出错误");
      } catch (error: any) {
        expect(error.message).to.include("unknown signer");
      }
    });

    it("应该验证PDA地址的正确性", async () => {
      const user9 = Keypair.generate();
      context.setAccount(user9.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      // 使用错误的PDA地址
      const wrongPDA = Keypair.generate().publicKey;

      try {
        await program.methods
          .setFavorites(
            new BN(1),
            "颜色",
            ["爱好"]
          )
          .accountsPartial({
            user: user9.publicKey,
            favorites: wrongPDA, // 错误的PDA
          })
          .signers([user9])
          .rpc();

        expect.fail("应该抛出错误");
      } catch (error: any) {
        expect(error.message).to.include("A seeds constraint was violated");
      }
    });
  });

  describe("错误处理测试", () => {
    it("应该拒绝超过长度限制的颜色字符串", async () => {
      const user10 = Keypair.generate();
      context.setAccount(user10.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      const favoritesPDA = getFavoritesPDA(user10.publicKey);
      const tooLongColor = "a".repeat(51); // 超过最大长度50

      try {
        await program.methods
          .setFavorites(
            new BN(1),
            tooLongColor,
            ["爱好"]
          )
          .accountsPartial({
            user: user10.publicKey,
          })
          .signers([user10])
          .rpc();

        expect.fail("应该抛出错误");
      } catch (error: any) {
        expect(error.message).to.include("Color string is too long");
      }
    });

    it("应该拒绝超过数量限制的爱好", async () => {
      const user11 = Keypair.generate();
      context.setAccount(user11.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      const favoritesPDA = getFavoritesPDA(user11.publicKey);
      const tooManyHobbies = ["爱好1", "爱好2", "爱好3", "爱好4", "爱好5", "爱好6"]; // 超过最大数量5

      try {
        await program.methods
          .setFavorites(
            new BN(1),
            "颜色",
            tooManyHobbies
          )
          .accountsPartial({
            user: user11.publicKey,
          })
          .signers([user11])
          .rpc();

        expect.fail("应该抛出错误");
      } catch (error: any) {
        expect(error.message).to.include("Too many hobbies");
      }
    });

    it("应该拒绝超过长度限制的单个爱好", async () => {
      const user12 = Keypair.generate();
      context.setAccount(user12.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      const favoritesPDA = getFavoritesPDA(user12.publicKey);
      const tooLongHobby = "a".repeat(51); // 超过最大长度50

      try {
        await program.methods
          .setFavorites(
            new BN(1),
            "颜色",
            [tooLongHobby]
          )
          .accountsPartial({
            user: user12.publicKey,
          })
          .signers([user12])
          .rpc();

        expect.fail("应该抛出错误");
      } catch (error: any) {
        expect(error.message).to.include("Hobby string is too long");
      }
    });
  });

  describe("状态一致性测试", () => {
    it("应该在多次调用后保持数据一致性", async () => {
      const user13 = Keypair.generate();
      context.setAccount(user13.publicKey, {
        lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      const favoritesPDA = getFavoritesPDA(user13.publicKey);

      // 第一次设置
      await program.methods
        .setFavorites(
          new BN(111),
          "第一次颜色",
          ["第一次爱好"]
        )
        .accountsPartial({
          user: user13.publicKey,
        })
        .signers([user13])
        .rpc();

      let favoritesAccount = await program.account.favorites.fetch(favoritesPDA);
      expect(favoritesAccount.number.toNumber()).to.equal(111);

      // 第二次更新
      await program.methods
        .setFavorites(
          new BN(222),
          "第二次颜色",
          ["第二次爱好1", "第二次爱好2"]
        )
        .accountsPartial({
          user: user13.publicKey,
        })
        .signers([user13])
        .rpc();

      favoritesAccount = await program.account.favorites.fetch(favoritesPDA);
      expect(favoritesAccount.number.toNumber()).to.equal(222);
      expect(favoritesAccount.color).to.equal("第二次颜色");
      expect(favoritesAccount.hobbies).to.deep.equal(["第二次爱好1", "第二次爱好2"]);

      // 第三次更新
      await program.methods
        .setFavorites(
          new BN(333),
          "第三次颜色",
          []
        )
        .accountsPartial({
          user: user13.publicKey,
        })
        .signers([user13])
        .rpc();

      favoritesAccount = await program.account.favorites.fetch(favoritesPDA);
      expect(favoritesAccount.number.toNumber()).to.equal(333);
      expect(favoritesAccount.color).to.equal("第三次颜色");
      expect(favoritesAccount.hobbies).to.deep.equal([]);
    });
  });

  describe("Bankrun 特有的测试功能", () => {
    it("应该能够获取账户信息和余额", async () => {
      const user14 = Keypair.generate();
      context.setAccount(user14.publicKey, {
        lamports: 5 * anchor.web3.LAMPORTS_PER_SOL,
        data: Buffer.alloc(0),
        owner: anchor.web3.SystemProgram.programId,
        executable: false,
      });

      // 获取账户余额
      const balance = await context.banksClient.getBalance(user14.publicKey);
      expect(Number(balance)).to.be.greaterThan(4 * anchor.web3.LAMPORTS_PER_SOL);

      // 设置偏好
      const favoritesPDA = getFavoritesPDA(user14.publicKey);
      await program.methods
        .setFavorites(
          new BN(999),
          "Bankrun测试颜色",
          ["Bankrun爱好"]
        )
        .accountsPartial({
          user: user14.publicKey,
        })
        .signers([user14])
        .rpc();

      // 获取PDA账户信息
      const accountInfo = await context.banksClient.getAccount(favoritesPDA);
      expect(accountInfo).to.not.be.null;
      expect(accountInfo!.owner.toString()).to.equal(program.programId.toString());
    });

    it("应该能够快速创建多个用户和测试交互", async () => {
      // Bankrun 的优势：快速创建多个测试用户
      const users = Array.from({ length: 10 }, () => Keypair.generate());
      
      // 批量设置账户余额
      users.forEach(user => {
        context.setAccount(user.publicKey, {
          lamports: 2 * anchor.web3.LAMPORTS_PER_SOL,
          data: Buffer.alloc(0),
          owner: anchor.web3.SystemProgram.programId,
          executable: false,
        });
      });

      // 批量设置偏好
      const promises = users.map((user, index) => 
        program.methods
          .setFavorites(
            new BN(index),
            `颜色${index}`,
            [`爱好${index}`]
          )
          .accountsPartial({
            user: user.publicKey,
          })
          .signers([user])
          .rpc()
      );

      await Promise.all(promises);

      // 验证所有用户的数据
      for (let i = 0; i < users.length; i++) {
        const favoritesPDA = getFavoritesPDA(users[i].publicKey);
        const favoritesAccount = await program.account.favorites.fetch(favoritesPDA);
        expect(favoritesAccount.number.toNumber()).to.equal(i);
        expect(favoritesAccount.color).to.equal(`颜色${i}`);
        expect(favoritesAccount.hobbies).to.deep.equal([`爱好${i}`]);
      }
    });
  });
}); 