import { ethers } from "hardhat";
import { expect } from "chai";

import * as utils from "./utils";

const MAX_TOKENS_PER_BUY = 10;

describe("EVPool", () => {
  describe("Pool state", () => {
    it("Should let you query Genesis token value", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      expect(await evpool.GENESIS_VALUE()).to.equal(
        ethers.utils.parseEther("8")
      );
    });

    it("Should let you query Mutagen token value", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      expect(await evpool.MUTAGEN_VALUE()).to.equal(
        ethers.utils.parseEther("0.08")
      );
    });

    it("Should let you query Geneses remaining in the pool", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      expect(await evpool.genesesRemaining()).to.equal(40);
    });

    it("Should let you query Mutagens remaining in the pool", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      expect(await evpool.mutagensRemaining()).to.equal(4096);
    });

    it("Should let you query redeemable token count", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      expect(await evpool.redeemableTokens()).to.equal(32);
    });

    it("Should let you query pool price", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      expect(await evpool.getPoolPrice()).to.equal(
        ethers.utils.parseEther("0.156595744680851063")
      );
    });

    it("Should let you query full pool state", async () => {
      const [evpool] = await utils.makeEVPoolContract();
      const pool = await evpool.getPoolState();

      expect(pool.geneses).to.equal(40);
      expect(pool.mutagens).to.equal(4096);
      expect(pool.price).to.equal(
        ethers.utils.parseEther("0.156595744680851063")
      );
    });
  });

  describe("Redeeming tokens", () => {
    it("Should let the contract owner redeem tokens", async () => {
      const [_, owner] = await ethers.getSigners();
      const [evpool] = await utils.makeEVPoolContract();

      expect(evpool.connect(owner).redeem([owner.address])).not.to.be.reverted;
    });

    it("Should not let anyone else redeem tokens", async () => {
      const [signer] = await ethers.getSigners();
      const [evpool] = await utils.makeEVPoolContract();
      expect(evpool.redeem([signer.address])).to.be.reverted;
    });

    it("Should fail if the redeemable token limit has been reached", async () => {
      const [evpool] = await utils.makeEVPoolContract();
      const [signer, owner] = await ethers.getSigners();

      const tokenLimit = 32;
      for (let i = 0; i < tokenLimit; i++) {
        await evpool.connect(owner).redeem([signer.address]);
      }

      expect(evpool.connect(owner).redeem([signer.address])).to.be.reverted;
    });

    it("Should mint the redeemed token to the destination address", async () => {
      const [signer, owner] = await ethers.getSigners();
      const [evpool, mutagen] = await utils.makeEVPoolContract();

      await evpool.connect(owner).redeem([signer.address]);
      // The second redeem mints the queued first one
      await evpool.connect(owner).redeem([signer.address]);

      expect(await mutagen.balanceOf(owner.address)).to.equal(0);
      expect(await mutagen.balanceOf(signer.address)).to.equal(1);
    });

    it("Should let you redeem to multiple addresses", async () => {
      const [signer, owner, destination1, destination2, destination3] =
        await ethers.getSigners();
      const [evpool, mutagen] = await utils.makeEVPoolContract();
      const recipients = [destination1, destination2, destination3];

      await evpool.connect(owner).redeem(recipients.map((x) => x.address));
      // The second redeem mints the last queued one
      await evpool.connect(owner).redeem([signer.address]);

      expect(await mutagen.balanceOf(owner.address)).to.equal(0);
      expect(await mutagen.balanceOf(signer.address)).to.equal(0);

      for (const recipient of recipients) {
        expect(await mutagen.balanceOf(recipient.address)).to.equal(1);
      }
    });
  });

  describe("Block number trigger for activating the contract", () => {
    it("Should let you query starting block number", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      expect(await evpool.startingBlock()).to.equal(0);
    });

    it("Should let contract owner update starting block", async () => {
      const [_, owner] = await ethers.getSigners();
      const [evpool] = await utils.makeEVPoolContract();

      expect(
        evpool
          .connect(owner)
          .setStartingBlock((await ethers.provider.getBlockNumber()) + 1000)
      ).not.to.be.reverted;
    });

    it("Should not let anyone else update starting block", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      expect(
        evpool.setStartingBlock((await ethers.provider.getBlockNumber()) + 1000)
      ).to.be.reverted;
    });

    it("Should not let users buy tokens if the starting block hasn't been reached", async () => {
      const [_, owner] = await ethers.getSigners();
      const [evpool] = await utils.makeEVPoolContract();

      await evpool
        .connect(owner)
        .setStartingBlock((await ethers.provider.getBlockNumber()) + 1000);

      expect(
        evpool.buy(1, {
          value: await evpool.getPoolPrice(),
        })
      ).to.be.reverted;
    });

    it("Should let users buy tokens once the starting block has been reached", async () => {
      const [_, owner] = await ethers.getSigners();
      const [evpool] = await utils.makeEVPoolContract();

      const targetBlock = (await ethers.provider.getBlockNumber()) + 10;

      // This increments the current block by 1 already
      await evpool.connect(owner).setStartingBlock(targetBlock);

      expect(
        evpool.buy(1, {
          value: await evpool.getPoolPrice(),
        })
      ).to.be.reverted;

      while ((await ethers.provider.getBlockNumber()) < targetBlock) {
        // Create transactions to increment block number
        await evpool.connect(owner).setStartingBlock(targetBlock);
      }

      expect(
        evpool.buy(1, {
          value: await evpool.getPoolPrice(),
        })
      ).not.to.be.reverted;
    });
  });

  describe("Buying from the pool", () => {
    it("Should let anyone buy from the pool", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      await evpool.buy(1, {
        value: await evpool.getPoolPrice(),
      });

      expect(
        evpool.buy(1, {
          value: (await evpool.getPoolPrice()).mul(11).div(10),
        })
      ).not.to.be.reverted;
    });

    it(`Should let you buy up to ${MAX_TOKENS_PER_BUY} tokens at a time from the pool`, async () => {
      const [signer] = await ethers.getSigners();
      const [evpool, mutagen] = await utils.makeEVPoolContract();

      for (let i = 1; i <= MAX_TOKENS_PER_BUY; i++) {
        const balanceBefore = await mutagen.balanceOf(signer.address);

        await evpool.buy(i, {
          value: (await evpool.getPoolPrice()).mul(i).mul(12).div(10),
        });
        const balanceAfter = await mutagen.balanceOf(signer.address);

        expect(balanceAfter - balanceBefore).to.equal(i - 1);
      }
    });

    it(`Should not let you buy more than ${MAX_TOKENS_PER_BUY} tokens at a time`, async () => {
      const [evpool] = await utils.makeEVPoolContract();
      expect(
        evpool.buy(11, {
          value: (await evpool.getPoolPrice()).mul(11),
        })
      ).to.be.reverted;
    });

    it("Should not let you buy more tokens than exist in the pool", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      const stateBefore = await evpool.getPoolState();
      const totalTokens = stateBefore.mutagens + stateBefore.geneses;
      let tokensRemaining = totalTokens;

      while (tokensRemaining > 0) {
        const tokenCount = Math.min(
          tokensRemaining,
          Math.ceil(Math.random() * MAX_TOKENS_PER_BUY)
        );
        await evpool.buy(tokenCount, {
          value: (await evpool.getPoolPrice()).mul(13).div(10).mul(tokenCount),
        });
        tokensRemaining -= tokenCount;
      }

      expect(
        evpool.buy(1, {
          value: await evpool.getPoolPrice(),
        })
      ).to.be.reverted;
    });

    it("Should not mint tokens to the caller when buying", async () => {
      const [signer] = await ethers.getSigners();
      const [evpool, mutagen] = await utils.makeEVPoolContract();

      await evpool.buy(1, {
        value: await evpool.getPoolPrice(),
      });
      expect(await mutagen.balanceOf(signer.address)).to.equal(0);
    });

    it("Should mint queued token after the next buy", async () => {
      const [signer] = await ethers.getSigners();
      const [evpool, mutagen] = await utils.makeEVPoolContract();

      const tokenAmount = Math.ceil(Math.random() * MAX_TOKENS_PER_BUY);

      await evpool.buy(tokenAmount, {
        value: (await evpool.getPoolPrice()).mul(11).div(10).mul(tokenAmount),
      });

      await evpool.buy(1, {
        value: (await evpool.getPoolPrice()).mul(11).div(10),
      });

      expect(await mutagen.balanceOf(signer.address)).to.equal(tokenAmount);
    });

    it("Should mint queued token after the last token is bought", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      const stateBefore = await evpool.getPoolState();
      const totalTokens = stateBefore.mutagens + stateBefore.geneses;
      let tokensRemaining = totalTokens;

      while (tokensRemaining > 0) {
        const tokenCount = Math.min(tokensRemaining, MAX_TOKENS_PER_BUY);

        await evpool.buy(tokenCount, {
          value: (await evpool.getPoolPrice()).mul(13).div(10).mul(tokenCount),
        });

        tokensRemaining -= tokenCount;
      }

      const stateAfter = await evpool.getPoolState();
      expect(stateAfter.mutagens + stateAfter.geneses).to.equal(0);
    });

    it("Should update token counts after each buy", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      let lastAmount = 0;
      for (let i = 0; i < 10; i++) {
        const poolBefore = await evpool.getPoolState();
        const tokenAmount = Math.ceil(Math.random() * MAX_TOKENS_PER_BUY);
        await evpool.buy(tokenAmount, {
          value: (await evpool.getPoolPrice()).mul(13).div(10).mul(tokenAmount),
        });
        const poolAfter = await evpool.getPoolState();
        expect(poolAfter.mutagens + poolAfter.geneses).to.equal(
          poolBefore.mutagens + poolBefore.geneses - lastAmount
        );
        lastAmount = tokenAmount;
      }
    });

    it("Should decrease the user's wallet balance after buying", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      const price = await evpool.getPoolPrice();
      const balanceBefore = await utils.getBalance();
      await evpool.buy(1, {
        value: price,
      });
      const balanceAfter = await utils.getBalance();

      expect(balanceBefore.sub(balanceAfter)).to.equal(price);
    });

    it("Should increase the contract balance after buying", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      const price = await evpool.getPoolPrice();
      await evpool.buy(1, {
        value: price,
      });

      expect(await ethers.provider.getBalance(evpool.address)).to.equal(price);
    });

    it("Should refund any excess ether sent when buying from the pool", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      const price = await evpool.getPoolPrice();
      const balanceBefore = await utils.getBalance();
      await evpool.buy(1, {
        value: ethers.utils.parseEther("1"),
      });
      const balanceAfter = await utils.getBalance();

      expect(balanceBefore.sub(balanceAfter)).to.equal(price);
    });

    it("Should decrease price after each Genesis is minted", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      for (let i = 0; i < 50; i++) {
        const stateBefore = await evpool.getPoolState();
        await evpool.buy(1, {
          value: stateBefore.price.mul(12).div(10),
        });
        const stateAfter = await evpool.getPoolState();

        if (i > 0 && stateAfter.geneses < stateBefore.geneses) {
          expect(stateAfter.price.lt(stateBefore.price)).to.be.true;
        }
      }
    });

    it("Should increase price after each Mutagen is minted", async () => {
      const [evpool] = await utils.makeEVPoolContract();

      for (let i = 0; i < 50; i++) {
        const stateBefore = await evpool.getPoolState();
        await evpool.buy(1, {
          value: stateBefore.price.mul(12).div(10),
        });
        const stateAfter = await evpool.getPoolState();

        if (i > 0 && stateAfter.mutagens < stateBefore.mutagens) {
          expect(stateAfter.price.gt(stateBefore.price)).to.be.true;
        }
      }
    });

    it("Should let contract owner withdraw balance", async () => {
      const [_, owner, recipient] = await ethers.getSigners();
      const [evpool] = await utils.makeEVPoolContract();
      await evpool.buy(1, {
        value: await evpool.getPoolPrice(),
      });
      expect(evpool.connect(owner).withdraw(recipient.address)).not.to.be
        .reverted;
    });

    it("Should not let a non-owner address withdraw balance", async () => {
      const [_, __, recipient] = await ethers.getSigners();
      const [evpool] = await utils.makeEVPoolContract();

      await evpool.buy(1, {
        value: await evpool.getPoolPrice(),
      });

      expect(evpool.withdraw(recipient.address)).to.be.reverted;
    });

    it("Should send the recipient all the ether in the contract when withdrawing", async () => {
      const [_, owner, recipient] = await ethers.getSigners();
      const [evpool] = await utils.makeEVPoolContract();

      const poolPrice = await evpool.getPoolPrice();
      await evpool.buy(1, {
        value: poolPrice,
      });

      const recipientBalanceBefore = await utils.getBalance(recipient.address);
      const contractBalanceBefore = await utils.getBalance(evpool.address);
      expect(contractBalanceBefore).to.eq(poolPrice);

      await evpool.connect(owner).withdraw(recipient.address);

      const recipientBalanceAfter = await utils.getBalance(recipient.address);
      const contractBalanceAfter = await utils.getBalance(evpool.address);
      expect(contractBalanceAfter).to.eq(0);

      expect(recipientBalanceAfter.sub(recipientBalanceBefore)).to.eq(
        poolPrice
      );
    });
  });
});
