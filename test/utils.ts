import { ethers } from "hardhat";

export function createSampleGenesis(genesisIdx: number) {
  return [genesisIdx, [2, 3], [3, 3], [0, 0, 0, 0]];
}

interface ContractInitOptions {
  activatePool?: boolean;
  initGeneses?: boolean;
  initMinter?: boolean;
}

export async function makeMutagenContract(options: ContractInitOptions = {}) {
  const [signer, owner] = await ethers.getSigners();

  for (let i = 0; i < 256; i++) {
    signer.sendTransaction({
      to: signer.address,
      value: ethers.utils.parseEther("1.0"),
    });
  }

  const { initMinter = true } = options;

  const Mutagen = await ethers.getContractFactory("MutagenToken");
  const mutagen = await Mutagen.deploy(
    "ipfs://mutagen-assets",
    0,
    "https://mutagen-api/mutagenMetadata"
  );
  await mutagen.deployed();
  await mutagen.transferOwnership(owner.address);

  if (initMinter) {
    await mutagen.connect(owner).setMinter(owner.address);
  }

  return mutagen;
}

export async function makeEVPoolContract(options: ContractInitOptions = {}) {
  const [_, owner] = await ethers.getSigners();
  const mutagen = await makeMutagenContract();

  const EVPool = await ethers.getContractFactory("EVPool");
  const evpool = await EVPool.deploy(mutagen.address, 0);
  await evpool.deployed();

  await evpool.transferOwnership(owner.address);
  await mutagen.connect(owner).setMinter(evpool.address);

  return [evpool, mutagen];
}

export async function getBalance(address: string | undefined = undefined) {
  const [owner] = await ethers.getSigners();
  return ethers.provider.getBalance(address ?? owner.address);
}
