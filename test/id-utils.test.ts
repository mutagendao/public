import { expect } from "chai";
import { ethers } from "hardhat";

describe("IdUtils", () => {
  async function makeContract() {
    const Contract = await ethers.getContractFactory("IdUtils");
    const contract = await Contract.deploy();
    await contract.deployed();
    return contract;
  }

  describe("Geneses", () => {
    it("Should pack indexes into IDs", async () => {
      const contract = await makeContract();

      expect(await contract.packGenesisId(0)).to.equal(0);
      expect(await contract.packGenesisId(1)).to.equal(4);
      expect(await contract.packGenesisId(2)).to.equal(8);
    });

    it("Should unpack IDs into indexes", async () => {
      const contract = await makeContract();

      expect(await contract.unpackGenesisId(0)).to.equal(0);
      expect(await contract.unpackGenesisId(4)).to.equal(1);
      expect(await contract.unpackGenesisId(8)).to.equal(2);
    });
  });

  describe("Prints", () => {
    const testCases: number[][] = [
      [0, 0, 0, 1],
      [1, 1, 1, 1048837],
      [1, 0, 1, 1048581],
      [1, 1, 0, 1048833],
      [0, 1, 1, 261],
      [2, 2, 2, 2097673],
      [2, 0, 2, 2097161],
      [2, 2, 0, 2097665],
      [0, 2, 2, 521],
      [1023, 3999, 39, 1073717149],
      [0, 3999, 39, 1023901],
      [1023, 0, 39, 1072693405],
      [1023, 3999, 0, 1073716993],
      [2049, 0, 0, 2148532225],
    ];

    it("Should pack properties into valid IDs", async () => {
      const contract = await makeContract();

      for (const testCase of testCases) {
        const [printNonce, printGeneration, genesisIdx, expectedId] = testCase;
        const printId = await contract.packPrintId(
          genesisIdx,
          printNonce,
          printGeneration
        );

        expect(printId).to.equal(expectedId);
      }
    });

    it("Should unpack IDs into valid properties", async () => {
      const contract = await makeContract();

      for (const testCase of testCases) {
        const [expectedNonce, expectedGeneration, expectedGenesisIdx, printId] =
          testCase;
        const [genesisIdx, printNonce, printGeneration] =
          await contract.unpackPrintId(printId);

        expect(genesisIdx).to.equal(expectedGenesisIdx);
        expect(printNonce).to.equal(expectedNonce);
        expect(printGeneration).to.equal(expectedGeneration);
      }
    });
  });

  describe("Mutagens", () => {
    const testCases: number[][] = [
      [0, 0, 0, 2],
      [0, 0, 1, 6],
      [0, 1, 0, 16386],
      [1, 0, 0, 2097154],
      [0, 1, 1, 16390],
      [1, 0, 1, 2097158],
      [1, 1, 0, 2113538],
      [2, 2, 2, 4227082],
      [2, 0, 2, 4194314],
      [2, 2, 0, 4227074],
      [0, 2, 2, 32778],
      [3, 99, 3999, 7929470],
      [3, 0, 3999, 6307454],
      [3, 99, 0, 7913474],
      [0, 99, 3999, 1638014],
    ];

    it("Should pack properties into valid IDs", async () => {
      const contract = await makeContract();

      for (const testCase of testCases) {
        const [layer, variant, mutagenIdx, expectedId] = testCase;
        const mutagenId = await contract.packMutagenId(
          layer,
          variant,
          mutagenIdx
        );

        expect(mutagenId).to.equal(expectedId);
      }
    });

    it("Should unpack IDs into valid properties", async () => {
      const contract = await makeContract();

      for (const testCase of testCases) {
        const [expectedLayer, expectedVariant, expectedIdx, mutagenId] =
          testCase;
        const [layer, variant, mutagenIdx] = await contract.unpackMutagenId(
          mutagenId
        );

        expect(layer).to.equal(expectedLayer);
        expect(variant).to.equal(expectedVariant);
        expect(mutagenIdx).to.equal(expectedIdx);
      }
    });
  });
});
