import { ApolloClient, InMemoryCache, NormalizedCacheObject } from '@apollo/client/core' // use '@apollo/client' in a react-based app
import { AptosClient } from 'aptos' // we use Aptos SDK v1 in the Ledger Live app
import { AptosApiType, AptosConfig } from '@aptos-labs/ts-sdk'
import { GetDelegatedStakingActivities } from './queries'
import {
  DelegatedStakingActivity,
  GetDelegatedStakingActivitiesQuery,
  PartitionedDelegatedStakingActivities,
  StakeDetails,
  StakePrincipals,
} from './types'

export class Staking {
  private client: ApolloClient<NormalizedCacheObject>
  private aptos: AptosClient

  constructor(config: AptosConfig) {
    this.client = new ApolloClient({
      uri: config.getRequestUrl(AptosApiType.INDEXER),
      cache: new InMemoryCache(),
    })
    this.aptos = new AptosClient(config.getRequestUrl(AptosApiType.FULLNODE))
  }

  async getDelegatedStakingActivitiesForAllPools(delegatorAddress: string): Promise<PartitionedDelegatedStakingActivities> {
    const response = await this.client.query({
      query: GetDelegatedStakingActivities,
      variables: { delegatorAddress },
    })

    const data = response.data as GetDelegatedStakingActivitiesQuery
    return data.delegated_staking_activities.reduce((acc: PartitionedDelegatedStakingActivities, item) => {
      acc[item.pool_address] = acc[item.pool_address] || []
      acc[item.pool_address].push(item)
      return acc
    }, {})
  }

  // https://github.com/aptos-labs/explorer/blob/5c9854e9f3ff97b6c1dcf07c930e53ffead6cedc/src/pages/DelegatoryValidator/utils.tsx#L64
  getStakeOperationPrincipals(activities: DelegatedStakingActivity[]): StakePrincipals {
    let activePrincipals = 0
    let pendingInactivePrincipals = 0

    const activitiesCopy: DelegatedStakingActivity[] = JSON.parse(JSON.stringify(activities))

    activitiesCopy
      .sort((a, b) => Number(a.transaction_version) - Number(b.transaction_version))
      .map((activity: DelegatedStakingActivity) => {
        const eventType = activity.event_type.split('::')[2]
        const amount = activity.amount
        switch (eventType) {
          case 'AddStakeEvent':
            activePrincipals += amount
            break
          case 'UnlockStakeEvent':
            activePrincipals -= amount
            pendingInactivePrincipals += amount
            break
          case 'ReactivateStakeEvent':
            activePrincipals += amount
            pendingInactivePrincipals -= amount
            break
          case 'WithdrawStakeEvent':
            pendingInactivePrincipals -= amount
            break
        }
        activePrincipals = activePrincipals < 0 ? 0 : activePrincipals
        pendingInactivePrincipals = pendingInactivePrincipals < 0 ? 0 : pendingInactivePrincipals
      })

    return { activePrincipals, pendingInactivePrincipals }
  }

  async getStake(delegatorAddress: string, poolAddress: string): Promise<StakeDetails> {
    const getStakePromise = this.aptos.view({
      function: '0x1::delegation_pool::get_stake',
      type_arguments: [],
      arguments: [poolAddress, delegatorAddress],
    })
    const canWithdrawPromise = this.aptos.view({
      function: '0x1::delegation_pool::can_withdraw_pending_inactive',
      type_arguments: [],
      arguments: [poolAddress],
    })
    const [stake, canWithdraw] = await Promise.all([getStakePromise, canWithdrawPromise])

    return {
      active: parseInt(stake[0].toString()),
      inactive: parseInt(stake[1].toString()),
      pendingInactive: parseInt(stake[2].toString()),
      canWithdrawPendingInactive: canWithdraw[0].valueOf() as boolean,
      poolAddress,
    }
  }

  async getTotalStakedAmount(delegatorAddress: string): Promise<number> {
    const partitionedData = await this.getDelegatedStakingActivitiesForAllPools(delegatorAddress)

    const stakePromises = Object.keys(partitionedData).map((poolAddress) => this.getStake(delegatorAddress, poolAddress))
    const stakes: StakeDetails[] = await Promise.all(stakePromises)

    return stakes.reduce((total, stake) => {
      const { activePrincipals, pendingInactivePrincipals } = this.getStakeOperationPrincipals(partitionedData[stake.poolAddress])
      const { active, pendingInactive } = stake
      const activeRewards = Math.max(0, active - activePrincipals)
      const pendingInactiveRewards = Math.abs(pendingInactive - pendingInactivePrincipals)

      return total + activeRewards + pendingInactiveRewards + activePrincipals + pendingInactivePrincipals
    }, 0)
  }
}
