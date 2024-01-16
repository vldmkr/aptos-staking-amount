import { AptosConfig, Network } from '@aptos-labs/ts-sdk'
import { Staking } from './staking'

const config = new AptosConfig({ network: Network.MAINNET })
const staking = new Staking(config)

const main = async (): Promise<void> => {
  const totalStaked = await staking.getTotalStakedAmount('0xf9a2fc9aa77432569caa5b9014e7abf688bf9ab53feeb6691020fd051248916b')
  console.log(`Total Staked: ${totalStaked / 1e8} APT`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
