import { expect } from "chai";
import { ethers } from "hardhat";

import * as utils from "./utils";

describe("MutagenToken", () => {
  describe("Block number trigger for activating the contract", () => {
    it("Should let you query starting block number", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(await mutagen.startingBlock()).to.equal(0);
    });

    it("Should let contract owner update starting block", async () => {
      const [_, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      expect(
        mutagen
          .connect(owner)
          .setStartingBlock((await ethers.provider.getBlockNumber()) + 1000)
      ).not.to.be.reverted;
    });

    it("Should not let anyone else update starting block", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(
        mutagen.setStartingBlock(
          (await ethers.provider.getBlockNumber()) + 1000
        )
      ).to.be.reverted;
    });

    it("Should not let users create prints if the starting block hasn't been reached", async () => {
      const [_, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen
        .connect(owner)
        .setStartingBlock((await ethers.provider.getBlockNumber()) + 1000);

      expect(
        mutagen.print(0, {
          value: ethers.utils.parseEther("0.2"),
        })
      ).to.be.reverted;
    });

    it("Should let users create prints once the starting block has been reached", async () => {
      const [_, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      const targetBlock = (await ethers.provider.getBlockNumber()) + 10;

      // This increments the current block by 1 already
      await mutagen.connect(owner).setStartingBlock(targetBlock);

      expect(
        mutagen.print(0, {
          value: ethers.utils.parseEther("0.2"),
        })
      ).to.be.reverted;

      while ((await ethers.provider.getBlockNumber()) < targetBlock) {
        // Create transactions to increment block number
        await mutagen.connect(owner).setStartingBlock(targetBlock);
      }

      expect(
        mutagen.print(0, {
          value: ethers.utils.parseEther("0.2"),
        })
      ).not.to.be.reverted;
    });
  });

  describe("Token URI", () => {
    it("Should let contract owner update base URI", async () => {
      const [_, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      expect(
        mutagen.connect(owner).setMetadataBaseURL("http://api.com/metadata")
      ).not.to.be.reverted;
    });

    it("Should not let non-owner address update base URI", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(mutagen.setMetadataBaseURL("http://api.com/metadata")).to.be
        .reverted;
    });

    it("Should let the contract owner set static URIs for tokens", async () => {
      const [_, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      expect(mutagen.connect(owner).setTokenURI(0, "ipfs://metadata-hash")).not
        .to.be.reverted;
    });

    it("Should not let a non-owner set static URIs for tokens", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(mutagen.setTokenURI(0, "ipfs://metadata-hash")).to.be.reverted;
    });

    it("Should not let you set static URIs more than once", async () => {
      const [_, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      expect(mutagen.connect(owner).setTokenURI(0, "ipfs://metadata-hash")).not
        .to.be.reverted;
      expect(mutagen.connect(owner).setTokenURI(0, "ipfs://metadata-hash-2")).to
        .be.reverted;
    });

    it("Should return a static URI if one has been set", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.connect(owner).setTokenURI(0, "ipfs://metadata-hash");
      expect(await mutagen.tokenURI(0)).to.eq("ipfs://metadata-hash");
    });

    it("Should return a dynamic URI if a static one hasn't been set", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen
        .connect(owner)
        .setMetadataBaseURL("http://api.com/metadata");
      await mutagen.connect(owner).mintGenesis(signer.address, 0);

      expect(await mutagen.tokenURI(0)).to.eq(
        `http://api.com/metadata?contractAddress=${mutagen.address.toLowerCase()}&tokenId=0`
      );
    });
  });

  describe("Token assets", () => {
    it("Should return an SVG path for Mutagens", async () => {
      const mutagen = await utils.makeMutagenContract();
      const mutagenIdx = Math.floor(Math.random() * 4095);

      const assets = await mutagen.tokenAssets((mutagenIdx << 2) + 2);

      expect(assets[0]).to.equal(
        `ipfs://mutagen-assets/mutagen/${mutagenIdx}.svg`
      );
    });

    it("Should return layer PNGs for Geneses", async () => {
      const mutagen = await utils.makeMutagenContract();

      for (let genesisIdx = 0; genesisIdx < 39; genesisIdx++) {
        const assets = await mutagen.tokenAssets(genesisIdx << 2);
        const genesisState = await mutagen.getGenesisState(genesisIdx);
        const lastGeneration =
          genesisState.generations[genesisState.generations.length - 1];

        for (let i = 0; i < 4; i++) {
          expect(assets[i]).to.equal(
            `ipfs://mutagen-assets/genesis/${genesisIdx}/l${i}v${lastGeneration[i]}.png`
          );
        }
      }
    });

    it("Should return updated layer PNGs after a mutation", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).setMinter(signer.address);
      await mutagen.mintGenesis(signer.address, 0);
      await mutagen.mintMutagen(signer.address, 0, 1, 0);
      await mutagen.mutate(0, (1 << 14) + 2);

      const assets = await mutagen.tokenAssets(0);
      const genesisState = await mutagen.getGenesisState(0);
      const lastGeneration =
        genesisState.generations[genesisState.generations.length - 1];

      for (let i = 0; i < 4; i++) {
        expect(assets[i]).to.equal(
          `ipfs://mutagen-assets/genesis/0/l${i}v${lastGeneration[i]}.png`
        );
      }
    });

    it("Should return layer PNGs for prints", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).setMinter(signer.address);
      await mutagen.mintGenesis(signer.address, 0);
      await mutagen.mintMutagen(signer.address, 0, 1, 0);
      await mutagen.mutate(0, (1 << 14) + 2);
      const genesisState = await mutagen.getGenesisState(0);

      for (let g = 0; g < genesisState.generations.length; g++) {
        const assets = await mutagen.tokenAssets((g << 20) + (g << 8) + 1);
        const generation = genesisState.generations[g];

        for (let i = 0; i < 4; i++) {
          expect(assets[i]).to.equal(
            `ipfs://mutagen-assets/genesis/0/l${i}v${generation[i]}.png`
          );
        }
      }
    });
  });

  describe("Minting", () => {
    it("Should let the contract owner update minter address", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      expect(mutagen.connect(owner).setMinter(signer.address)).not.to.be
        .reverted;
    });

    it("Should not let anyone else update minter address", async () => {
      const [signer] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      expect(mutagen.setMinter(signer.address)).to.be.reverted;
    });

    it("Should let the minter address mint Genesis tokens", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract({ initMinter: false });
      await mutagen.connect(owner).setMinter(signer.address);

      expect(mutagen.mintGenesis(signer.address, 0)).not.to.be.reverted;
    });

    it("Should not let a non-minter address mint Genesis tokens", async () => {
      const [signer] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract({ initMinter: false });

      expect(mutagen.mintGenesis(signer.address, 0)).to.be.reverted;
    });

    it("Should not let invalid Geneses to be minted", async () => {
      const [_, owner] = await ethers.getSigners();
      const [account] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      expect(mutagen.connect(owner).mintGenesis(account.address, 40)).to.be
        .reverted;
    });

    it("Should let the minter address mint Mutagen tokens", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract({ initMinter: false });
      await mutagen.connect(owner).setMinter(signer.address);

      expect(mutagen.mintMutagen(signer.address, 0, 0, 0)).not.to.be.reverted;
    });

    it("Should not let a non-minter address mint Mutagen tokens", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract({ initMinter: false });

      expect(mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0)).to.be
        .reverted;
      expect(mutagen.connect(owner).mintMutagen(signer.address, 1, 0, 0)).to.be
        .reverted;
      expect(mutagen.connect(owner).mintMutagen(signer.address, 3, 0, 0)).to.be
        .reverted;
    });

    it("Should not let invalid Mutagen IDs to be minted", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      expect(mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 4096)).to
        .be.reverted;
      expect(mutagen.connect(owner).mintMutagen(signer.address, 4, 0, 0)).to.be
        .reverted;
      expect(mutagen.connect(owner).mintMutagen(signer.address, 0, 100, 0)).to
        .be.reverted;
    });
  });

  describe("Printing", () => {
    it("Should let you query values", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(await mutagen.getPrintValue(1)).to.equal(
        ethers.utils.parseEther("0.2")
      );

      expect(await mutagen.getPrintValue(2)).to.equal(
        ethers.utils.parseEther("0.20000002")
      );

      expect(await mutagen.getPrintValue(3)).to.equal(
        ethers.utils.parseEther("0.20000032")
      );
    });

    it("Should succeed if enough ether is provided", async () => {
      const [signer] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      expect(await mutagen.balanceOf(signer.address)).to.equal(0);
      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });

      expect(await mutagen.balanceOf(signer.address)).to.equal(1);
    });

    it("Should fail if insufficient ether is provided", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(
        mutagen.print(0, {
          value: (await mutagen.getPrintValue(1)).div(2),
        })
      ).to.be.reverted;
    });

    it("Should fail if Genesis does not exist", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(
        mutagen.print(42, {
          value: ethers.utils.parseEther("1"),
        })
      ).to.be.reverted;
    });

    it("Should increase printing price", async () => {
      const mutagen = await utils.makeMutagenContract();

      const firstPrintValue = await mutagen.getPrintValue(1);

      expect(
        mutagen.print(0, {
          value: firstPrintValue,
        })
      ).not.to.be.reverted;

      expect(
        mutagen.print(0, {
          value: firstPrintValue,
        })
      ).to.be.reverted;

      const secondPrintValue = await mutagen.getPrintValue(2);

      expect(
        mutagen.print(0, {
          value: secondPrintValue,
        })
      ).not.to.be.reverted;

      expect(
        mutagen.print(0, {
          value: secondPrintValue,
        })
      ).to.be.reverted;
    });

    it("Should refund you any excess ether", async () => {
      const mutagen = await utils.makeMutagenContract();

      const balanceBefore = await utils.getBalance();

      await mutagen.print(0, {
        value: ethers.utils.parseEther("1"),
      });

      const balanceAfter = await utils.getBalance();

      expect(balanceBefore.sub(balanceAfter)).to.equal(
        await mutagen.getPrintValue(1)
      );
    });

    it("Should increase Genesis fees", async () => {
      const mutagen = await utils.makeMutagenContract();
      expect((await mutagen.getGenesisState(0)).fees).to.equal(0);

      const printValue = await mutagen.getPrintValue(1);
      await mutagen.print(0, {
        value: printValue,
      });

      expect((await mutagen.getGenesisState(0)).fees).to.equal(
        printValue.div(20)
      );
    });

    it("Should increase protocol fees", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(await mutagen.protocolFees()).to.equal(0);

      const printValue = await mutagen.getPrintValue(1);
      await mutagen.print(0, {
        value: printValue,
      });

      expect(await mutagen.protocolFees()).to.equal(printValue.div(20));
    });

    it("Should increase reserves", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(await mutagen.reserve()).to.equal(0);

      const printValue = await mutagen.getPrintValue(1);
      await mutagen.print(0, {
        value: printValue,
      });

      expect(await mutagen.reserve()).to.equal(printValue.div(10).mul(9));
    });

    it("Should increment its generation's print count", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      let genesisBefore = await mutagen.getGenesisState(0);
      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });
      let genesisAfter = await mutagen.getGenesisState(0);

      expect(
        genesisAfter.printCounts[0] - genesisBefore.printCounts[0]
      ).to.equal(1);

      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);
      await mutagen.mutate(0, 2);

      genesisBefore = await mutagen.getGenesisState(0);
      await mutagen.print(0, {
        value: await mutagen.getPrintValue(2),
      });
      genesisAfter = await mutagen.getGenesisState(0);

      expect(
        genesisAfter.printCounts[1] - genesisBefore.printCounts[1]
      ).to.equal(1);
    });

    it("Should increment the Genesis' current print supply", async () => {
      const mutagen = await utils.makeMutagenContract();

      const genesisBefore = await mutagen.getGenesisState(0);
      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });
      const genesisAfter = await mutagen.getGenesisState(0);

      expect(genesisAfter.printSupply - genesisBefore.printSupply).to.equal(1);
    });
  });

  describe("Burning", () => {
    it("Should let you query values", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(await mutagen.getBurnValue(1)).to.equal(
        ethers.utils.parseEther("0.18")
      );

      expect(await mutagen.getBurnValue(2)).to.equal(
        ethers.utils.parseEther("0.180000018")
      );

      expect(await mutagen.getBurnValue(3)).to.equal(
        ethers.utils.parseEther("0.180000288")
      );
    });

    it("Should set the burn value to 90% of the print value", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(await mutagen.getBurnValue(1)).to.equal(
        (await mutagen.getPrintValue(1)).div(10).mul(9)
      );

      expect(await mutagen.getBurnValue(2)).to.equal(
        (await mutagen.getPrintValue(2)).div(10).mul(9)
      );

      expect(await mutagen.getBurnValue(3)).to.equal(
        (await mutagen.getPrintValue(3)).div(10).mul(9)
      );
    });

    it("Should succeed if you own the print", async () => {
      const mutagen = await utils.makeMutagenContract();
      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });

      expect(mutagen.burn(1)).not.to.be.reverted;
    });

    it("Should fail if you do not own the print", async () => {
      const mutagen = await utils.makeMutagenContract();
      const [signer, owner] = await ethers.getSigners();

      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });
      await mutagen.transferFrom(signer.address, owner.address, 1);

      expect(mutagen.burn(1)).to.be.reverted;
    });

    it("Should fail if the print hasn't been created", async () => {
      const mutagen = await utils.makeMutagenContract();

      expect(mutagen.burn(1)).to.be.reverted;
    });

    it("Should fail if you try to burn the same print twice", async () => {
      const mutagen = await utils.makeMutagenContract();

      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });

      await mutagen.burn(1);
      expect(mutagen.burn(1)).to.be.reverted;
    });

    it("Should remove the print from your wallet", async () => {
      const [signer] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });

      expect(await mutagen.balanceOf(signer.address)).to.equal(1);
      await mutagen.burn(1);
      expect(await mutagen.balanceOf(signer.address)).to.equal(0);
    });

    it("Should refund you", async () => {
      const mutagen = await utils.makeMutagenContract();

      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });

      const burnValue = await mutagen.getBurnValue(1);
      const balanceBefore = await utils.getBalance();
      await mutagen.burn(1);
      const balanceAfter = await utils.getBalance();

      expect(balanceAfter.sub(balanceBefore)).to.equal(burnValue);
    });

    it("Should decrease reserves", async () => {
      const mutagen = await utils.makeMutagenContract();

      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });

      const burnValue = await mutagen.getBurnValue(1);
      const reserveBefore = await mutagen.reserve();
      await mutagen.burn(1);
      const reserveAfter = await mutagen.reserve();

      expect(reserveBefore.sub(reserveAfter)).to.equal(burnValue);
    });

    it("Should decrement its generation's print count", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      let genesisBefore;
      let genesisAfter;

      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });
      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);
      await mutagen.mutate(0, 2);
      await mutagen.print(0, {
        value: await mutagen.getPrintValue(2),
      });

      genesisBefore = await mutagen.getGenesisState(0);
      await mutagen.burn(1048833);
      genesisAfter = await mutagen.getGenesisState(0);

      expect(
        genesisBefore.printCounts[1] - genesisAfter.printCounts[1]
      ).to.equal(1);

      genesisBefore = await mutagen.getGenesisState(0);
      await mutagen.burn(1);
      genesisAfter = await mutagen.getGenesisState(0);

      expect(
        genesisBefore.printCounts[0] - genesisAfter.printCounts[0]
      ).to.equal(1);
    });

    it("Should decrement the Genesis' current print supply", async () => {
      const mutagen = await utils.makeMutagenContract();

      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });

      const genesisBefore = await mutagen.getGenesisState(0);
      await mutagen.burn(1);
      const genesisAfter = await mutagen.getGenesisState(0);

      expect(genesisBefore.printSupply - genesisAfter.printSupply).to.equal(1);
    });
  });

  describe("Mutating", () => {
    it("Should succeed if you own the genesis and a Mutagen", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);

      expect(mutagen.mutate(0, 2)).not.to.be.reverted;
    });

    it("Should fail if the Genesis has not been minted", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);

      expect(mutagen.mutate(0, 2)).to.be.reverted;
    });

    it("Should fail if you do not own the Genesis", async () => {
      const mutagen = await utils.makeMutagenContract();
      const [signer, owner] = await ethers.getSigners();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.transferFrom(signer.address, owner.address, 0);
      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);

      expect(mutagen.mutate(0, 2)).to.be.reverted;
    });

    it("Should fail if the Genesis does not exist", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintMutagen(owner.address, 0, 0, 0);

      expect(mutagen.mutate(40, 2)).to.be.reverted;
    });

    it("Should fail if the Mutagen has not been minted", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);

      expect(mutagen.mutate(0, 2)).to.be.reverted;
    });

    it("Should fail if you do not own the Mutagen", async () => {
      const mutagen = await utils.makeMutagenContract();
      const [signer, owner] = await ethers.getSigners();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);
      await mutagen.transferFrom(signer.address, owner.address, 2);

      expect(mutagen.mutate(0, 2)).to.be.reverted;
    });

    it("Should fail if the Mutagen does not exist", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);

      expect(mutagen.mutate(0, 16002)).to.be.reverted;
    });

    it("Should fail if the Mutagen has been used", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);

      await mutagen.mutate(0, 2);
      expect(mutagen.mutate(0, 2)).to.be.reverted;
    });

    it("Should burn the Mutagen", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);

      expect(await mutagen.balanceOf(signer.address)).to.equal(2);
      expect(await mutagen.ownerOf(2)).to.equal(signer.address);

      await mutagen.mutate(0, 2);

      expect(await mutagen.balanceOf(signer.address)).to.equal(1);
      expect(mutagen.ownerOf(2)).to.be.reverted;
    });

    it("Should add a new generation", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);

      const genesisBefore = await mutagen.getGenesisState(0);
      await mutagen.mutate(0, 2);
      const genesisAfter = await mutagen.getGenesisState(0);

      expect(genesisBefore.generations.length).to.equal(1);
      expect(genesisAfter.generations.length).to.equal(2);
    });

    it("Should add a new print counter", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);

      const genesisBefore = await mutagen.getGenesisState(0);
      await mutagen.mutate(0, 2);
      const genesisAfter = await mutagen.getGenesisState(0);

      expect(genesisBefore.printCounts.length).to.equal(1);
      expect(genesisBefore.printCounts[0]).to.equal(0);
      expect(genesisAfter.printCounts.length).to.equal(2);
      expect(genesisAfter.printCounts[1]).to.equal(0);
    });

    it("Should update the layer based on the Mutagen used", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();
      await mutagen.connect(owner).mintGenesis(signer.address, 0);

      const allLayers = [0, 1, 2, 3];
      // Set the Mutagen variant roll to something high that doesn't trigger a rare variant
      const d100 = 98;
      // Calculate the expected variant
      const variant = d100 % 3;

      for (let i = 0; i < allLayers.length; i++) {
        const layer = allLayers[i];

        await mutagen
          .connect(owner)
          .mintMutagen(signer.address, layer, d100, i);
        const mutagenId = await mutagen.packMutagenId(layer, d100, i);
        await mutagen.mutate(0, mutagenId);

        const genesis = await mutagen.getGenesisState(0);
        expect(
          genesis.generations[genesis.generations.length - 1][layer]
        ).to.equal(variant);
      }
    });

    describe("Punk layer", () => {
      it("Should let you query remaining Punk mutations", async () => {
        const mutagen = await utils.makeMutagenContract();
        expect(await mutagen.remainingPunkMutations()).to.equal(2);
      });

      it("Should trigger the Punk variant if a rare Mutagen is used", async () => {
        const [signer, owner] = await ethers.getSigners();
        const mutagen = await utils.makeMutagenContract();
        await mutagen.connect(owner).mintGenesis(signer.address, 0);

        const layer = 1; // Default Punk layer in tests
        await mutagen.connect(owner).mintMutagen(signer.address, layer, 0, 0);
        const mutagenId = await mutagen.packMutagenId(layer, 0, 0);
        await mutagen.mutate(0, mutagenId);

        const genesis = await mutagen.getGenesisState(0);
        expect(
          genesis.generations[genesis.generations.length - 1][layer]
        ).to.equal(3);
      });

      it("Should only trigger non-Punk variants with non-rare Mutagens", async () => {
        const [signer, owner] = await ethers.getSigners();
        const mutagen = await utils.makeMutagenContract();
        await mutagen.connect(owner).mintGenesis(signer.address, 0);

        const layer = 1; // Default Punk layer in tests

        for (let i = 2; i < 100; i++) {
          await mutagen.connect(owner).mintMutagen(signer.address, layer, i, i);
          const mutagenId = await mutagen.packMutagenId(layer, i, i);
          await mutagen.mutate(0, mutagenId);

          const genesis = await mutagen.getGenesisState(0);
          expect(
            genesis.generations[genesis.generations.length - 1][layer]
          ).not.to.equal(3);
        }
      });

      it("Should limit the number of Punk variants", async () => {
        const [signer, owner] = await ethers.getSigners();
        const mutagen = await utils.makeMutagenContract();
        await mutagen.connect(owner).mintGenesis(signer.address, 0);

        const layer = 1; // Default Punk layer in tests

        await mutagen.connect(owner).mintMutagen(signer.address, layer, 0, 0);
        await mutagen.connect(owner).mintMutagen(signer.address, layer, 0, 1);
        await mutagen.connect(owner).mintMutagen(signer.address, layer, 0, 2);

        const mutagenId0 = await mutagen.packMutagenId(layer, 0, 0);
        const mutagenId1 = await mutagen.packMutagenId(layer, 0, 1);
        const mutagenId2 = await mutagen.packMutagenId(layer, 0, 2);

        await mutagen.mutate(0, mutagenId0);
        const genesis0 = await mutagen.getGenesisState(0);
        expect(
          genesis0.generations[genesis0.generations.length - 1][layer]
        ).to.equal(3);

        await mutagen.mutate(0, mutagenId1);
        const genesis1 = await mutagen.getGenesisState(0);
        expect(
          genesis1.generations[genesis1.generations.length - 1][layer]
        ).to.equal(3);

        await mutagen.mutate(0, mutagenId2);
        const genesis2 = await mutagen.getGenesisState(0);
        expect(
          genesis2.generations[genesis2.generations.length - 1][layer]
        ).not.to.equal(3);
      });
    });

    describe("Moon layer", () => {
      it("Should let you query remaining Moon mutations", async () => {
        const mutagen = await utils.makeMutagenContract();
        expect(await mutagen.remainingMoonMutations()).to.equal(4);
      });

      it("Should trigger the Moon variant if a rare Mutagen is used", async () => {
        const [signer, owner] = await ethers.getSigners();
        const mutagen = await utils.makeMutagenContract();
        await mutagen.connect(owner).mintGenesis(signer.address, 0);

        const layer = 2; // Default Moon layer in tests
        await mutagen.connect(owner).mintMutagen(signer.address, layer, 0, 0);
        const mutagenId = await mutagen.packMutagenId(layer, 0, 0);
        await mutagen.mutate(0, mutagenId);

        const genesis = await mutagen.getGenesisState(0);
        expect(
          genesis.generations[genesis.generations.length - 1][layer]
        ).to.equal(3);
      });

      it("Should only trigger non-Moon variants with non-rare Mutagens", async () => {
        const [signer, owner] = await ethers.getSigners();
        const mutagen = await utils.makeMutagenContract();
        await mutagen.connect(owner).mintGenesis(signer.address, 0);

        const layer = 2; // Default Moon layer in tests

        for (let i = 2; i < 100; i++) {
          await mutagen.connect(owner).mintMutagen(signer.address, layer, i, i);
          const mutagenId = await mutagen.packMutagenId(layer, i, i);
          await mutagen.mutate(0, mutagenId);

          const genesis = await mutagen.getGenesisState(0);
          expect(
            genesis.generations[genesis.generations.length - 1][layer]
          ).not.to.equal(3);
        }
      });

      it("Should limit the number of Moon variants", async () => {
        const [signer, owner] = await ethers.getSigners();
        const mutagen = await utils.makeMutagenContract();
        await mutagen.connect(owner).mintGenesis(signer.address, 0);

        const layer = 2; // Default Moon layer in tests

        for (let i = 0; i < 5; i++) {
          await mutagen.connect(owner).mintMutagen(signer.address, layer, 0, i);
        }

        const succeedingMutagens = [
          await mutagen.packMutagenId(layer, 0, 0),
          await mutagen.packMutagenId(layer, 0, 1),
          await mutagen.packMutagenId(layer, 0, 2),
          await mutagen.packMutagenId(layer, 0, 3),
        ];

        const failingMutagen = await mutagen.packMutagenId(layer, 0, 4);

        for (const mutagenId of succeedingMutagens) {
          await mutagen.mutate(0, mutagenId);
          const genesis0 = await mutagen.getGenesisState(0);
          expect(
            genesis0.generations[genesis0.generations.length - 1][layer]
          ).to.equal(3);
        }

        await mutagen.mutate(0, failingMutagen);
        const genesis2 = await mutagen.getGenesisState(0);
        expect(
          genesis2.generations[genesis2.generations.length - 1][layer]
        ).not.to.equal(3);
      });
    });

    describe("Regular layer", () => {
      it("Should trigger a variant according to the variant roll in the Mutagen", async () => {
        const [signer, owner] = await ethers.getSigners();
        const mutagen = await utils.makeMutagenContract();
        await mutagen.connect(owner).mintGenesis(signer.address, 0);

        const layer = 0;

        for (let i = 0; i < 100; i++) {
          await mutagen.connect(owner).mintMutagen(signer.address, layer, i, i);
          const mutagenId = await mutagen.packMutagenId(layer, i, i);
          await mutagen.mutate(0, mutagenId);

          const genesis = await mutagen.getGenesisState(0);
          expect(
            genesis.generations[genesis.generations.length - 1][layer]
          ).to.equal(i % 4);
        }
      });
    });
  });

  describe("Genesis fees", () => {
    it("Should let anyone query", async () => {
      const mutagen = await utils.makeMutagenContract();
      expect((await mutagen.getGenesisState(0)).fees).to.equal(0);
    });

    it("Should be withdrawn after a mutation", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);

      const printValue = await mutagen.getPrintValue(1);
      await mutagen.print(0, {
        value: printValue,
      });

      const balanceBefore = await utils.getBalance();
      await mutagen.mutate(0, 2);
      const balanceAfter = await utils.getBalance();

      // Print fees are 5% of the full print value
      expect(balanceAfter.sub(balanceBefore)).to.equal(printValue.div(20));
    });

    it("Should reset after a mutation", async () => {
      const [signer, owner] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.connect(owner).mintGenesis(signer.address, 0);
      await mutagen.connect(owner).mintMutagen(signer.address, 0, 0, 0);

      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });

      const feesBefore = (await mutagen.getGenesisState(0)).fees;
      await mutagen.mutate(0, 2);
      const feesAfter = (await mutagen.getGenesisState(0)).fees;

      expect(feesBefore > 0).to.be.true;
      expect(feesAfter).to.equal(0);
    });
  });

  describe("Protocol fees", () => {
    it("Should let anyone query", async () => {
      const mutagen = await utils.makeMutagenContract();
      expect(await mutagen.protocolFees()).to.equal(0);
    });

    it("Should let the contract owner withdraw", async () => {
      const [_, owner, recipient] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();
      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });
      expect(mutagen.connect(owner).withdrawProtocolFees(recipient.address)).not
        .to.be.reverted;
    });

    it("Should not let anyone else withdraw", async () => {
      const [_, __, recipient] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });

      expect(mutagen.withdrawProtocolFees(recipient.address)).to.be.reverted;
    });

    it("Should send you ether when withdrawing", async () => {
      const [_, owner, recipient] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });
      const burnValue = await mutagen.getBurnValue(1);

      const balanceBefore = await utils.getBalance(recipient.address);
      await mutagen.connect(owner).withdrawProtocolFees(recipient.address);
      const balanceAfter = await utils.getBalance(recipient.address);

      // You get 90% of the original print value back and the protocol fees are 5%
      // of that original value
      expect(balanceAfter.sub(balanceBefore)).to.equal(burnValue.div(9).div(2));
    });

    it("Should reset after withdrawing", async () => {
      const [_, owner, recipient] = await ethers.getSigners();
      const mutagen = await utils.makeMutagenContract();

      await mutagen.print(0, {
        value: await mutagen.getPrintValue(1),
      });

      expect((await mutagen.protocolFees()).gt(0)).to.be.true;
      await mutagen.connect(owner).withdrawProtocolFees(recipient.address);
      expect(await mutagen.protocolFees()).to.equal(0);
    });
  });
});
