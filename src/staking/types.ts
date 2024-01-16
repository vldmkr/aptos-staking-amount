export type DelegatedStakingActivity = {
  amount: number
  delegator_address: string
  event_index: number
  event_type: string
  pool_address: string
  transaction_version: bigint
}

export type GetDelegatedStakingActivitiesQuery = {
  delegated_staking_activities: Array<DelegatedStakingActivity>
}

export type PartitionedDelegatedStakingActivities = Record<string, DelegatedStakingActivity[]>

export type StakePrincipals = {
  activePrincipals: number
  pendingInactivePrincipals: number
}
